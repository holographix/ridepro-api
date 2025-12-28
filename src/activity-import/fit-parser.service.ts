import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Decoder, Stream } from '@garmin/fitsdk';
import { gunzipSync } from 'zlib';

/**
 * FIT File Parser Service
 *
 * Parses Garmin FIT files from various sources (Garmin, TrainingPeaks, Zwift)
 * Handles two types of FIT files:
 * 1. PLANNED WORKOUTS - workout_step messages (TrainingPeaks structured workouts)
 * 2. COMPLETED ACTIVITIES - record/session messages (GPS, power, HR telemetry)
 */

// ----- Types -----

export interface ParsedFitFile {
  fileType: 'planned_workout' | 'completed_activity';
  plannedWorkout?: ParsedPlannedWorkout;
  completedActivity?: ParsedCompletedActivity;
}

export interface ParsedPlannedWorkout {
  name: string;
  description?: string;
  sportType: 'cycling' | 'running' | 'other';
  steps: WorkoutStep[];
  estimatedDuration: number; // seconds
  estimatedTSS?: number;
  createdDate?: Date;
  author?: string;
}

export interface WorkoutStep {
  type: 'warmup' | 'active' | 'rest' | 'cooldown' | 'repeat';
  name: string;
  durationType: 'time' | 'distance' | 'open';
  durationValue?: number; // seconds or meters
  targetType: 'power' | 'heartRate' | 'cadence' | 'pace' | 'none';
  targetMin?: number; // % of FTP or absolute value
  targetMax?: number;
  repeatCount?: number; // If type is 'repeat'
  repeatSteps?: WorkoutStep[]; // Nested steps for repetitions
}

export interface ParsedCompletedActivity {
  // Metadata
  name: string;
  activityType: 'outdoor_cycling' | 'indoor_cycling' | 'running' | 'other';
  source: 'garmin' | 'trainingpeaks' | 'zwift' | 'unknown';
  startTime: Date;
  endTime?: Date;

  // Summary stats
  durationSeconds: number;
  movingTime?: number;
  distanceMeters?: number;
  elevationGain?: number;
  elevationLoss?: number;

  // Power metrics
  avgPower?: number;
  maxPower?: number;
  normalizedPower?: number;

  // Heart rate
  avgHeartRate?: number;
  maxHeartRate?: number;

  // Cadence
  avgCadence?: number;
  maxCadence?: number;

  // Speed
  avgSpeed?: number; // m/s
  maxSpeed?: number; // m/s

  // Training metrics
  tss?: number;
  intensityFactor?: number;
  calories?: number;

  // GPS
  hasGPS: boolean;
  startLatitude?: number;
  startLongitude?: number;

  // Weather
  temperature?: number; // Celsius

  // Telemetry data (second-by-second)
  records: ActivityRecord[];

  // Lap data
  laps: ActivityLap[];
}

export interface ActivityRecord {
  timestamp: Date;
  latitude?: number; // decimal degrees
  longitude?: number; // decimal degrees
  altitude?: number; // meters
  power?: number; // watts
  heartRate?: number; // bpm
  cadence?: number; // rpm
  speed?: number; // m/s
  distance?: number; // cumulative meters
  temperature?: number; // Celsius
}

export interface ActivityLap {
  startTime: Date;
  endTime?: Date;
  durationSeconds: number;
  distanceMeters?: number;
  avgPower?: number;
  maxPower?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  avgSpeed?: number;
  totalAscent?: number;
  totalDescent?: number;
}

@Injectable()
export class FitParserService {
  private readonly logger = new Logger(FitParserService.name);

  /**
   * Parse a FIT file buffer
   * Automatically detects if it's a planned workout or completed activity
   */
  async parse(buffer: Buffer, filename?: string): Promise<ParsedFitFile> {
    try {
      // Check if gzipped and decompress
      const decompressed = this.decompressIfNeeded(buffer);

      // Decode FIT file using Garmin SDK
      const stream = Stream.fromBuffer(decompressed);
      const decoder = new Decoder(stream);

      if (!decoder.isFIT()) {
        throw new BadRequestException('Invalid FIT file format');
      }

      const { messages, errors } = decoder.read();

      if (errors && errors.length > 0) {
        this.logger.warn(`FIT parsing errors: ${errors.join(', ')}`);
      }

      // Determine file type by checking which messages exist
      const hasWorkoutMessages = messages.workoutMesgs?.length > 0;
      const hasWorkoutStepMessages = messages.workoutStepMesgs?.length > 0;
      const hasRecordMessages = messages.recordMesgs?.length > 0;
      const hasSessionMessages = messages.sessionMesgs?.length > 0;

      // IMPORTANT: Some TrainingPeaks files contain BOTH the planned workout AND the completed activity
      // In this case, prioritize the completed activity (recordMesgs) over the planned workout
      if (hasRecordMessages || hasSessionMessages) {
        // This is a COMPLETED ACTIVITY (Garmin, Zwift, TrainingPeaks completed)
        const completedActivity = this.parseCompletedActivity(messages, filename);
        return {
          fileType: 'completed_activity',
          completedActivity,
        };
      } else if (hasWorkoutMessages || hasWorkoutStepMessages) {
        // This is a PLANNED WORKOUT from TrainingPeaks (no activity data)
        const plannedWorkout = this.parsePlannedWorkout(messages);
        return {
          fileType: 'planned_workout',
          plannedWorkout,
        };
      } else {
        throw new BadRequestException(
          'Unrecognized FIT file type - no workout or activity data found',
        );
      }
    } catch (error) {
      this.logger.error(`FIT parsing failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse FIT file: ${error.message}`);
    }
  }

  /**
   * Decompress gzipped buffer if needed
   */
  private decompressIfNeeded(buffer: Buffer): Buffer {
    // Check for gzip magic number (1f 8b)
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      this.logger.log('Decompressing gzipped FIT file');
      return gunzipSync(buffer);
    }
    return buffer;
  }

  /**
   * Parse PLANNED WORKOUT from TrainingPeaks FIT file
   */
  private parsePlannedWorkout(messages: any): ParsedPlannedWorkout {
    const workoutMsg = messages.workoutMesgs?.[0];
    const workoutSteps = messages.workoutStepMesgs || [];

    if (!workoutMsg && workoutSteps.length === 0) {
      throw new BadRequestException('No workout data found in FIT file');
    }

    const name = workoutMsg?.wktName || 'Imported Workout';
    const sportType = this.mapSportType(workoutMsg?.sport);

    // Parse workout steps
    const steps: WorkoutStep[] = workoutSteps.map((step: any) => this.parseWorkoutStep(step));

    // Calculate total duration
    const estimatedDuration = steps.reduce((total, step) => {
      if (step.durationType === 'time' && step.durationValue) {
        return total + step.durationValue;
      }
      return total;
    }, 0);

    return {
      name,
      sportType,
      steps,
      estimatedDuration,
      createdDate: workoutMsg?.timestamp,
    };
  }

  /**
   * Parse individual workout step
   */
  private parseWorkoutStep(stepMsg: any): WorkoutStep {
    const intensityClass = stepMsg.intensity || 'active';
    const type = this.mapIntensityToStepType(intensityClass);

    // Duration
    const durationType = this.mapDurationType(stepMsg.durationType);
    const durationValue = stepMsg.durationValue;

    // Target (power zones, HR zones, etc.)
    const targetType = this.mapTargetType(stepMsg.targetType);
    const targetMin = stepMsg.customTargetValueLow;
    const targetMax = stepMsg.customTargetValueHigh;

    return {
      type,
      name: stepMsg.wktStepName || type,
      durationType,
      durationValue,
      targetType,
      targetMin,
      targetMax,
    };
  }

  /**
   * Parse COMPLETED ACTIVITY from Garmin/Zwift/TrainingPeaks FIT file
   */
  private parseCompletedActivity(
    messages: any,
    filename?: string,
  ): ParsedCompletedActivity {
    const sessionMsg = messages.sessionMesgs?.[0];
    const recordMsgs = messages.recordMesgs || [];
    const lapMsgs = messages.lapMesgs || [];

    if (!sessionMsg && recordMsgs.length === 0) {
      throw new BadRequestException('No activity data found in FIT file');
    }

    // Determine source from filename
    const source = this.detectSource(filename);

    // Activity name
    const name = sessionMsg?.sport
      ? `${this.mapSportType(sessionMsg.sport)} Activity`
      : 'Imported Activity';

    // Activity type
    const activityType = this.mapActivityType(sessionMsg?.sport, sessionMsg?.subSport);

    // Parse telemetry records
    const records = this.parseRecords(recordMsgs);

    // Parse laps
    const laps = this.parseLaps(lapMsgs);

    // Calculate summary stats
    const summary = this.calculateSummaryStats(sessionMsg, records);

    // Check if has GPS
    const hasGPS = records.some(r => r.latitude !== undefined && r.longitude !== undefined);
    const firstGPSRecord = records.find(r => r.latitude && r.longitude);

    return {
      name,
      activityType,
      source,
      startTime: sessionMsg?.startTime || records[0]?.timestamp || new Date(),
      endTime: sessionMsg?.timestamp,
      hasGPS,
      startLatitude: firstGPSRecord?.latitude,
      startLongitude: firstGPSRecord?.longitude,
      durationSeconds: summary.durationSeconds || 0,
      records,
      laps,
      ...summary,
    };
  }

  /**
   * Parse individual telemetry records (second-by-second data)
   */
  private parseRecords(recordMsgs: any[]): ActivityRecord[] {
    return recordMsgs.map((record: any) => ({
      timestamp: record.timestamp,
      latitude: this.semicirclesToDegrees(record.positionLat),
      longitude: this.semicirclesToDegrees(record.positionLong),
      altitude: record.enhancedAltitude ?? record.altitude,
      power: record.power,
      heartRate: record.heartRate,
      cadence: record.cadence,
      speed: record.enhancedSpeed ?? record.speed,
      distance: record.distance,
      temperature: record.temperature,
    }));
  }

  /**
   * Parse lap/segment data
   */
  private parseLaps(lapMsgs: any[]): ActivityLap[] {
    return lapMsgs.map((lap: any) => ({
      startTime: lap.startTime,
      endTime: lap.timestamp,
      durationSeconds: lap.totalElapsedTime || lap.totalTimerTime || 0,
      distanceMeters: lap.totalDistance,
      avgPower: lap.avgPower,
      maxPower: lap.maxPower,
      avgHeartRate: lap.avgHeartRate,
      maxHeartRate: lap.maxHeartRate,
      avgCadence: lap.avgCadence,
      avgSpeed: lap.enhancedAvgSpeed ?? lap.avgSpeed,
      totalAscent: lap.totalAscent,
      totalDescent: lap.totalDescent,
    }));
  }

  /**
   * Calculate summary statistics from session message and records
   */
  private calculateSummaryStats(sessionMsg: any, records: ActivityRecord[]): Partial<ParsedCompletedActivity> {
    // Use session message data if available, otherwise calculate from records
    const durationSeconds = sessionMsg?.totalElapsedTime ?? sessionMsg?.totalTimerTime ?? 0;
    const movingTime = sessionMsg?.totalTimerTime;
    const distanceMeters = sessionMsg?.totalDistance;

    // Power metrics
    const avgPower = sessionMsg?.avgPower;
    const maxPower = sessionMsg?.maxPower;
    const normalizedPower = sessionMsg?.normalizedPower;

    // Heart rate
    const avgHeartRate = sessionMsg?.avgHeartRate;
    const maxHeartRate = sessionMsg?.maxHeartRate;

    // Cadence
    const avgCadence = sessionMsg?.avgCadence;
    const maxCadence = sessionMsg?.maxCadence;

    // Speed
    const avgSpeed = sessionMsg?.enhancedAvgSpeed ?? sessionMsg?.avgSpeed;
    const maxSpeed = sessionMsg?.enhancedMaxSpeed ?? sessionMsg?.maxSpeed;

    // Elevation
    const elevationGain = sessionMsg?.totalAscent;
    const elevationLoss = sessionMsg?.totalDescent;

    // Training metrics
    const tss = sessionMsg?.trainingStressScore;
    const intensityFactor = sessionMsg?.intensityFactor;
    const calories = sessionMsg?.totalCalories;

    // Temperature
    const temperature = sessionMsg?.avgTemperature;

    return {
      durationSeconds,
      movingTime,
      distanceMeters,
      avgPower,
      maxPower,
      normalizedPower,
      avgHeartRate,
      maxHeartRate,
      avgCadence,
      maxCadence,
      avgSpeed,
      maxSpeed,
      elevationGain,
      elevationLoss,
      tss,
      intensityFactor,
      calories,
      temperature,
    };
  }

  // ----- Utility Functions -----

  /**
   * Convert FIT semicircles to decimal degrees
   * FIT stores GPS as semicircles (2^31 semicircles = 180 degrees)
   */
  private semicirclesToDegrees(semicircles: number | undefined): number | undefined {
    if (semicircles === undefined || semicircles === null) return undefined;
    return semicircles * (180 / Math.pow(2, 31));
  }

  /**
   * Map FIT sport type to our enum
   */
  private mapSportType(sport: string): 'cycling' | 'running' | 'other' {
    const normalized = sport?.toLowerCase() || '';
    if (normalized.includes('cycling') || normalized.includes('bike')) return 'cycling';
    if (normalized.includes('running') || normalized.includes('run')) return 'running';
    return 'other';
  }

  /**
   * Map FIT sport/subsport to ActivityType
   */
  private mapActivityType(
    sport: string,
    subSport?: string,
  ): 'outdoor_cycling' | 'indoor_cycling' | 'running' | 'other' {
    const sportNorm = sport?.toLowerCase() || '';
    const subSportNorm = subSport?.toLowerCase() || '';

    if (sportNorm.includes('cycling') || sportNorm.includes('bike')) {
      if (
        subSportNorm.includes('indoor') ||
        subSportNorm.includes('virtual') ||
        subSportNorm.includes('trainer')
      ) {
        return 'indoor_cycling';
      }
      return 'outdoor_cycling';
    }

    if (sportNorm.includes('running')) return 'running';
    return 'other';
  }

  /**
   * Detect activity source from filename
   */
  private detectSource(filename?: string): 'garmin' | 'trainingpeaks' | 'zwift' | 'unknown' {
    if (!filename) return 'unknown';
    const lower = filename.toLowerCase();
    if (lower.includes('zwift')) return 'zwift';
    if (lower.includes('tp-') || lower.includes('trainingpeaks')) return 'trainingpeaks';
    if (lower.includes('garmin')) return 'garmin';
    return 'unknown';
  }

  /**
   * Map FIT intensity class to our step type
   */
  private mapIntensityToStepType(
    intensity: string,
  ): 'warmup' | 'active' | 'rest' | 'cooldown' | 'repeat' {
    const normalized = intensity?.toLowerCase() || '';
    if (normalized.includes('warmup') || normalized.includes('warm_up')) return 'warmup';
    if (normalized.includes('cooldown') || normalized.includes('cool_down')) return 'cooldown';
    if (normalized.includes('rest') || normalized.includes('recovery')) return 'rest';
    if (normalized.includes('repeat')) return 'repeat';
    return 'active';
  }

  /**
   * Map FIT duration type
   */
  private mapDurationType(durationType: string): 'time' | 'distance' | 'open' {
    const normalized = durationType?.toLowerCase() || '';
    if (normalized.includes('time')) return 'time';
    if (normalized.includes('distance')) return 'distance';
    if (normalized.includes('open') || normalized.includes('lap')) return 'open';
    return 'time';
  }

  /**
   * Map FIT target type
   */
  private mapTargetType(
    targetType: string,
  ): 'power' | 'heartRate' | 'cadence' | 'pace' | 'none' {
    const normalized = targetType?.toLowerCase() || '';
    if (normalized.includes('power')) return 'power';
    if (normalized.includes('heart') || normalized.includes('hr')) return 'heartRate';
    if (normalized.includes('cadence')) return 'cadence';
    if (normalized.includes('pace') || normalized.includes('speed')) return 'pace';
    return 'none';
  }
}
