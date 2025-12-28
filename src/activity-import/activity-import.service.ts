import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FitParserService, ParsedCompletedActivity } from './fit-parser.service';
import { Activity, ActivityType, ActivitySource, ActivityFileFormat } from '@prisma/client';
import { addDays } from 'date-fns';

/**
 * Activity Import Service
 *
 * Handles importing completed activities from FIT files
 * - Parses FIT files using FitParserService
 * - Saves activities to database
 * - Pairs activities with scheduled workouts (optional)
 * - Supports batch import
 */

export interface ImportActivityDto {
  athleteId: string;
  buffer: Buffer;
  filename: string;
  autoPairWithScheduled?: boolean; // Auto-match with scheduled workouts
}

export interface ImportedActivity {
  activity: Activity;
  paired: boolean; // Whether it was paired with a scheduled workout
  pairedWorkoutName?: string;
}

@Injectable()
export class ActivityImportService {
  private readonly logger = new Logger(ActivityImportService.name);

  constructor(
    private prisma: PrismaService,
    private fitParser: FitParserService,
  ) {}

  /**
   * Import a single activity from FIT file
   */
  async importActivity(dto: ImportActivityDto): Promise<ImportedActivity> {
    const { athleteId, buffer, filename, autoPairWithScheduled = true } = dto;

    // Verify athlete exists
    const athlete = await this.prisma.user.findUnique({
      where: { id: athleteId },
    });

    if (!athlete) {
      throw new NotFoundException(`Athlete with ID ${athleteId} not found`);
    }

    // Parse FIT file
    const parsed = await this.fitParser.parse(buffer, filename);

    if (parsed.fileType !== 'completed_activity') {
      throw new BadRequestException(
        'This FIT file is a planned workout, not a completed activity. Use the workout import endpoint instead.',
      );
    }

    const activityData = parsed.completedActivity!;

    // Convert to database format
    const activity = await this.saveActivity(athleteId, activityData, filename, buffer.length);

    // Optionally pair with scheduled workout
    let paired = false;
    let pairedWorkoutName: string | undefined;

    if (autoPairWithScheduled) {
      const pairing = await this.autoPairWithScheduledWorkout(athleteId, activity);
      paired = pairing.paired;
      pairedWorkoutName = pairing.workoutName;
    }

    this.logger.log(
      `Imported activity "${activity.name}" for athlete ${athleteId}${paired ? ` (paired with: ${pairedWorkoutName})` : ''}`,
    );

    return {
      activity,
      paired,
      pairedWorkoutName,
    };
  }

  /**
   * Import multiple activities in batch
   */
  async importBatch(
    athleteId: string,
    files: Array<{ buffer: Buffer; filename: string }>,
    autoPairWithScheduled = true,
  ): Promise<ImportedActivity[]> {
    this.logger.log(`Starting batch import of ${files.length} activities for athlete ${athleteId}`);

    const results: ImportedActivity[] = [];

    for (const file of files) {
      try {
        const result = await this.importActivity({
          athleteId,
          buffer: file.buffer,
          filename: file.filename,
          autoPairWithScheduled,
        });
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to import ${file.filename}: ${error.message}`);
        // Continue with other files
      }
    }

    this.logger.log(`Batch import completed: ${results.length}/${files.length} activities imported`);

    return results;
  }

  /**
   * Save parsed activity to database
   */
  private async saveActivity(
    athleteId: string,
    data: ParsedCompletedActivity,
    filename: string,
    fileSize: number,
  ): Promise<Activity> {
    // Map source
    const source = this.mapSource(data.source);
    const activityType = this.mapActivityType(data.activityType);

    // Prepare telemetry data (JSONB)
    const telemetryData = {
      records: data.records.map(r => ({
        timestamp: r.timestamp.toISOString(),
        lat: r.latitude,
        lng: r.longitude,
        altitude: r.altitude,
        power: r.power,
        hr: r.heartRate,
        cadence: r.cadence,
        speed: r.speed,
        distance: r.distance,
        temp: r.temperature,
      })),
    };

    // Prepare lap data (JSONB)
    const laps = {
      laps: data.laps.map(l => ({
        startTime: l.startTime.toISOString(),
        endTime: l.endTime?.toISOString(),
        duration: l.durationSeconds,
        distance: l.distanceMeters,
        avgPower: l.avgPower,
        maxPower: l.maxPower,
        avgHR: l.avgHeartRate,
        maxHR: l.maxHeartRate,
        avgCadence: l.avgCadence,
        avgSpeed: l.avgSpeed,
        ascent: l.totalAscent,
        descent: l.totalDescent,
      })),
    };

    // Create activity record
    return this.prisma.activity.create({
      data: {
        athleteId,
        name: data.name,
        activityType,
        source,
        fileFormat: ActivityFileFormat.FIT,
        startTime: data.startTime,
        endTime: data.endTime,
        durationSeconds: data.durationSeconds,
        movingTime: data.movingTime,
        distanceMeters: data.distanceMeters,
        elevationGain: data.elevationGain,
        elevationLoss: data.elevationLoss,
        avgPower: data.avgPower,
        maxPower: data.maxPower,
        normalizedPower: data.normalizedPower,
        avgHeartRate: data.avgHeartRate,
        maxHeartRate: data.maxHeartRate,
        avgCadence: data.avgCadence,
        maxCadence: data.maxCadence,
        avgSpeed: data.avgSpeed,
        maxSpeed: data.maxSpeed,
        tss: data.tss,
        intensityFactor: data.intensityFactor,
        calories: data.calories,
        hasGPS: data.hasGPS,
        startLatitude: data.startLatitude,
        startLongitude: data.startLongitude,
        temperature: data.temperature,
        telemetryData,
        laps,
        originalFilename: filename,
        fileSize,
      },
    });
  }

  /**
   * Automatically pair activity with scheduled workout
   * Logic: Find scheduled workout on the same day that hasn't been completed
   */
  private async autoPairWithScheduledWorkout(
    athleteId: string,
    activity: Activity,
  ): Promise<{ paired: boolean; workoutName?: string }> {
    // Find training weeks that overlap with the activity date
    const activityDate = activity.startTime;

    // Get the week start (Monday) for this activity
    const dayOfWeek = activityDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0 = Monday
    const weekStart = addDays(activityDate, -daysFromMonday);

    // Find training week for this athlete and week
    const trainingWeek = await this.prisma.trainingWeek.findFirst({
      where: {
        athleteId,
        weekStart: {
          lte: activityDate,
          gt: addDays(weekStart, -7), // Previous week's start
        },
      },
      include: {
        scheduledWorkouts: {
          where: {
            completed: false, // Only consider incomplete workouts
            activities: {
              none: {}, // No activity already linked
            },
          },
          include: {
            workout: true,
          },
        },
      },
    });

    if (!trainingWeek || trainingWeek.scheduledWorkouts.length === 0) {
      return { paired: false };
    }

    // Find workouts scheduled on the same day of week
    const activityDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = Monday, 6 = Sunday

    const matchingWorkouts = trainingWeek.scheduledWorkouts.filter(
      sw => sw.dayIndex === activityDayIndex,
    );

    if (matchingWorkouts.length === 0) {
      return { paired: false };
    }

    // If multiple workouts on same day, try to match by activity type
    let bestMatch = matchingWorkouts[0];

    if (matchingWorkouts.length > 1 && activity.activityType) {
      const typeMatch = matchingWorkouts.find(sw => {
        const workoutType = sw.workout.workoutType?.toLowerCase() || '';
        const activityTypeStr = activity.activityType.toLowerCase();

        if (activityTypeStr.includes('indoor') && workoutType.includes('indoor')) return true;
        if (activityTypeStr.includes('outdoor') && workoutType.includes('outdoor')) return true;
        if (activityTypeStr.includes('cycling') && workoutType.includes('cycling')) return true;

        return false;
      });

      if (typeMatch) {
        bestMatch = typeMatch;
      }
    }

    // Pair activity with scheduled workout
    await this.prisma.activity.update({
      where: { id: activity.id },
      data: {
        scheduledWorkoutId: bestMatch.id,
      },
    });

    // Optionally mark workout as completed
    await this.prisma.scheduledWorkout.update({
      where: { id: bestMatch.id },
      data: {
        completed: true,
        completedAt: activity.startTime,
        actualDurationSeconds: activity.durationSeconds,
        actualTSS: activity.tss,
        actualIF: activity.intensityFactor,
        avgPower: activity.avgPower,
        avgHeartRate: activity.avgHeartRate,
      },
    });

    this.logger.log(
      `Paired activity "${activity.name}" with scheduled workout "${bestMatch.workout.name}"`,
    );

    return {
      paired: true,
      workoutName: bestMatch.workout.name,
    };
  }

  /**
   * Get all activities for an athlete
   */
  async getAthleteActivities(
    athleteId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ activities: Activity[]; total: number }> {
    const where: any = { athleteId };

    if (options?.startDate || options?.endDate) {
      where.startTime = {};
      if (options.startDate) where.startTime.gte = options.startDate;
      if (options.endDate) where.startTime.lte = options.endDate;
    }

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { startTime: 'desc' },
        take: options?.limit,
        skip: options?.offset,
        include: {
          scheduledWorkout: {
            include: {
              workout: true,
            },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { activities, total };
  }

  /**
   * Get single activity with full telemetry
   */
  async getActivity(activityId: string): Promise<Activity> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true,
            email: true,
            ftp: true,
            maxHR: true,
          },
        },
        scheduledWorkout: {
          include: {
            workout: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException(`Activity with ID ${activityId} not found`);
    }

    return activity;
  }

  /**
   * Delete activity
   */
  async deleteActivity(activityId: string): Promise<void> {
    await this.prisma.activity.delete({
      where: { id: activityId },
    });

    this.logger.log(`Deleted activity ${activityId}`);
  }

  // ----- Helper Methods -----

  private mapSource(source: string): ActivitySource {
    const mapping: Record<string, ActivitySource> = {
      garmin: ActivitySource.GARMIN,
      trainingpeaks: ActivitySource.TRAININGPEAKS,
      zwift: ActivitySource.ZWIFT,
      wahoo: ActivitySource.WAHOO,
      strava: ActivitySource.STRAVA,
    };

    return mapping[source.toLowerCase()] || ActivitySource.MANUAL;
  }

  private mapActivityType(type: string): ActivityType {
    const mapping: Record<string, ActivityType> = {
      outdoor_cycling: ActivityType.OUTDOOR_CYCLING,
      indoor_cycling: ActivityType.INDOOR_CYCLING,
      running: ActivityType.CROSS_RUNNING,
    };

    return mapping[type] || ActivityType.OUTDOOR_CYCLING;
  }
}
