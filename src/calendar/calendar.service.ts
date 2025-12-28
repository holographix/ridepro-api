import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, WorkoutFeeling } from '@prisma/client';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  // Training Weeks
  async getWeek(athleteId: string, weekStart: Date) {
    return this.prisma.trainingWeek.findUnique({
      where: {
        athleteId_weekStart: { athleteId, weekStart },
      },
      include: {
        scheduledWorkouts: {
          include: {
            workout: {
              include: { category: true },
            },
            activities: true, // Include linked FIT file imports
          },
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
        },
        athlete: {
          select: { id: true, fullName: true, ftp: true },
        },
        coach: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async getWeekById(id: string) {
    return this.prisma.trainingWeek.findUnique({
      where: { id },
      include: {
        scheduledWorkouts: {
          include: {
            workout: {
              include: { category: true },
            },
            activities: true, // Include linked FIT file imports
          },
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
        },
        athlete: {
          select: { id: true, fullName: true, ftp: true },
        },
        coach: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async getWeeksRange(athleteId: string, startDate: Date, endDate: Date) {
    return this.prisma.trainingWeek.findMany({
      where: {
        athleteId,
        weekStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        scheduledWorkouts: {
          include: {
            workout: {
              include: { category: true },
            },
            activities: true, // Include linked FIT file imports
          },
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
        },
      },
      orderBy: { weekStart: 'asc' },
    });
  }

  async createWeek(data: {
    athleteId: string;
    weekStart: Date;
    coachId?: string;
    notes?: string;
  }) {
    return this.prisma.trainingWeek.create({
      data: {
        weekStart: data.weekStart,
        notes: data.notes,
        athlete: { connect: { id: data.athleteId } },
        ...(data.coachId && { coach: { connect: { id: data.coachId } } }),
      },
      include: {
        scheduledWorkouts: {
          include: { workout: true },
        },
      },
    });
  }

  async updateWeek(id: string, data: Prisma.TrainingWeekUpdateInput) {
    return this.prisma.trainingWeek.update({
      where: { id },
      data,
    });
  }

  async deleteWeek(id: string) {
    return this.prisma.trainingWeek.delete({
      where: { id },
    });
  }

  // Scheduled Workouts
  async addWorkoutToDay(data: {
    trainingWeekId: string;
    workoutId: string;
    dayIndex: number;
    sortOrder?: number;
    notes?: string;
  }) {
    return this.prisma.scheduledWorkout.create({
      data: {
        dayIndex: data.dayIndex,
        sortOrder: data.sortOrder ?? 0,
        notes: data.notes,
        trainingWeek: { connect: { id: data.trainingWeekId } },
        workout: { connect: { id: data.workoutId } },
      },
      include: {
        workout: {
          include: { category: true },
        },
      },
    });
  }

  async updateScheduledWorkout(
    id: string,
    data: {
      dayIndex?: number;
      sortOrder?: number;
      notes?: string;
      completed?: boolean;
    },
  ) {
    return this.prisma.scheduledWorkout.update({
      where: { id },
      data: {
        ...data,
        ...(data.completed && { completedAt: new Date() }),
      },
      include: {
        workout: {
          include: { category: true },
        },
      },
    });
  }

  async moveWorkout(id: string, dayIndex: number, sortOrder: number) {
    return this.prisma.scheduledWorkout.update({
      where: { id },
      data: { dayIndex, sortOrder },
    });
  }

  async removeScheduledWorkout(id: string) {
    return this.prisma.scheduledWorkout.delete({
      where: { id },
    });
  }

  async markWorkoutCompleted(id: string, completed: boolean) {
    return this.prisma.scheduledWorkout.update({
      where: { id },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
        // Clear skipped flag when marking as completed
        skipped: completed ? false : undefined,
        skipReason: completed ? null : undefined,
        skippedAt: completed ? null : undefined,
      },
    });
  }

  async skipWorkout(id: string, skipReason?: string) {
    return this.prisma.scheduledWorkout.update({
      where: { id },
      data: {
        skipped: true,
        skipReason,
        skippedAt: new Date(),
        // Clear completed flag when skipping
        completed: false,
        completedAt: null,
      },
    });
  }

  /**
   * Calculate TSS and IF from workout structure
   */
  private calculateWorkoutMetrics(structure: any): {
    durationSeconds: number;
    tss: number;
    if: number;
  } {
    let totalDuration = 0;
    let totalIntensity = 0;
    let segmentCount = 0;

    const processStep = (step: any, multiplier = 1) => {
      const durationSeconds =
        step.length?.unit === 'minute'
          ? step.length.value * 60
          : step.length?.value || 0;

      const target = step.targets?.[0] || { minValue: 50, maxValue: 75 };
      const avgIntensity = (target.minValue + target.maxValue) / 2 / 100; // Convert % to decimal

      totalDuration += durationSeconds * multiplier;
      totalIntensity += avgIntensity * durationSeconds * multiplier;
      segmentCount++;
    };

    const processItem = (item: any, multiplier = 1) => {
      if (item.type === 'repetition') {
        const repeatCount = item.length?.value || 1;
        item.steps?.forEach((step: any) => {
          if (step.type === 'repetition') {
            processItem(step, multiplier * repeatCount);
          } else {
            processStep(step, multiplier * repeatCount);
          }
        });
      } else if (item.type === 'step') {
        item.steps?.forEach((step: any) => processStep(step, multiplier));
      }
    };

    if (structure && structure.structure) {
      structure.structure.forEach((item: any) => processItem(item));
    }

    // Calculate IF (Intensity Factor) = weighted average intensity
    const intensityFactor = totalDuration > 0 ? totalIntensity / totalDuration : 0;

    // Calculate TSS (Training Stress Score) = (duration_hours * NP^2 * IF) / (FTP * 3600) * 100
    // Simplified: TSS ≈ duration_hours * IF^2 * 100
    const durationHours = totalDuration / 3600;
    const tss = durationHours * Math.pow(intensityFactor, 2) * 100;

    return {
      durationSeconds: Math.round(totalDuration),
      tss: Math.round(tss * 10) / 10, // Round to 1 decimal
      if: Math.round(intensityFactor * 100) / 100, // Round to 2 decimals
    };
  }

  /**
   * Modify scheduled workout structure for a specific athlete/day
   */
  async modifyScheduledWorkoutStructure(id: string, structure: any) {
    // Calculate metrics from modified structure
    const metrics = this.calculateWorkoutMetrics(structure);

    return this.prisma.scheduledWorkout.update({
      where: { id },
      data: {
        structureOverride: structure,
        durationOverride: metrics.durationSeconds,
        tssOverride: metrics.tss,
        ifOverride: metrics.if,
        isModified: true,
      },
      include: {
        workout: {
          include: { category: true },
        },
      },
    });
  }

  /**
   * Reset scheduled workout to original structure
   */
  async resetScheduledWorkoutStructure(id: string) {
    return this.prisma.scheduledWorkout.update({
      where: { id },
      data: {
        structureOverride: Prisma.JsonNull,
        durationOverride: null,
        tssOverride: null,
        ifOverride: null,
        isModified: false,
      },
      include: {
        workout: {
          include: { category: true },
        },
      },
    });
  }

  // Reorder workouts within a day
  async reorderDayWorkouts(
    trainingWeekId: string,
    dayIndex: number,
    workoutIds: string[],
  ) {
    const updates = workoutIds.map((id, index) =>
      this.prisma.scheduledWorkout.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  // Get all scheduled workouts for a coach's athletes
  async getCoachCalendar(
    coachId: string,
    startDate: Date,
    endDate: Date,
    athleteIds?: string[],
  ) {
    // First get the coach's athletes
    const relationships = await this.prisma.coachAthleteRelationship.findMany({
      where: {
        coachId,
        status: 'ACTIVE',
        ...(athleteIds?.length ? { athleteId: { in: athleteIds } } : {}),
      },
      select: {
        athleteId: true,
        athlete: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const allAthleteIds = relationships.map((r) => r.athleteId);

    if (allAthleteIds.length === 0) {
      return { athletes: [], workouts: [] };
    }

    // Get all training weeks for these athletes in the date range
    const trainingWeeks = await this.prisma.trainingWeek.findMany({
      where: {
        athleteId: { in: allAthleteIds },
        weekStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        scheduledWorkouts: {
          include: {
            workout: {
              include: { category: true },
            },
            activities: true, // Include linked FIT file imports
          },
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
        },
        athlete: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // Flatten workouts with athlete info and compute actual date
    const workouts = trainingWeeks.flatMap((week) =>
      week.scheduledWorkouts.map((sw) => {
        // Calculate actual date from weekStart + dayIndex
        const date = new Date(week.weekStart);
        date.setDate(date.getDate() + sw.dayIndex);

        return {
          ...sw,
          date: date.toISOString().split('T')[0],
          athleteId: week.athleteId,
          athleteName: week.athlete.fullName || week.athlete.email.split('@')[0],
        };
      }),
    );

    return {
      athletes: relationships.map((r) => ({
        id: r.athlete.id,
        name: r.athlete.fullName || r.athlete.email.split('@')[0],
      })),
      workouts,
    };
  }

  // Get stats for multiple athletes for the current week
  async getAthleteStats(athleteIds: string[], weekStart: Date) {
    // Get all training weeks for these athletes for the given week
    const trainingWeeks = await this.prisma.trainingWeek.findMany({
      where: {
        athleteId: { in: athleteIds },
        weekStart,
      },
      include: {
        scheduledWorkouts: {
          include: {
            workout: {
              select: { tssPlanned: true },
            },
          },
        },
      },
    });

    // Create a map of athleteId -> stats
    const statsMap: Record<
      string,
      { upcomingWorkouts: number; weeklyTSS: number }
    > = {};

    // Initialize all athletes with zero stats
    for (const athleteId of athleteIds) {
      statsMap[athleteId] = { upcomingWorkouts: 0, weeklyTSS: 0 };
    }

    // Calculate stats from training weeks
    for (const week of trainingWeeks) {
      const athleteId = week.athleteId;
      const workouts = week.scheduledWorkouts;

      // Count upcoming (not completed) workouts
      const upcomingCount = workouts.filter((w) => !w.completed).length;

      // Sum TSS from all workouts this week
      const tssSum = workouts.reduce((sum, w) => {
        return sum + (w.workout.tssPlanned || 0);
      }, 0);

      statsMap[athleteId] = {
        upcomingWorkouts: upcomingCount,
        weeklyTSS: Math.round(tssSum),
      };
    }

    return statsMap;
  }

  // Submit workout results (athlete completion with actual data)
  async submitWorkoutResults(
    id: string,
    results: {
      actualDurationSeconds?: number;
      actualTSS?: number;
      actualIF?: number;
      avgPower?: number;
      avgHeartRate?: number;
      rpe?: number;
      feeling?: WorkoutFeeling;
      resultNotes?: string;
    },
  ) {
    return this.prisma.scheduledWorkout.update({
      where: { id },
      data: {
        completed: true,
        completedAt: new Date(),
        actualDurationSeconds: results.actualDurationSeconds,
        actualTSS: results.actualTSS,
        actualIF: results.actualIF,
        avgPower: results.avgPower,
        avgHeartRate: results.avgHeartRate,
        rpe: results.rpe,
        feeling: results.feeling,
        resultNotes: results.resultNotes,
      },
      include: {
        workout: {
          include: { category: true },
        },
      },
    });
  }

  // Get athlete's own calendar (for athlete view)
  async getAthleteCalendar(athleteId: string, startDate: Date, endDate: Date) {
    // Get all training weeks for this athlete in the date range
    const trainingWeeks = await this.prisma.trainingWeek.findMany({
      where: {
        athleteId,
        weekStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        scheduledWorkouts: {
          include: {
            workout: {
              include: { category: true },
            },
            activities: true, // Include linked FIT file imports
          },
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
        },
        coach: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { weekStart: 'asc' },
    });

    // Flatten workouts with computed actual date
    const workouts = trainingWeeks.flatMap((week) =>
      week.scheduledWorkouts.map((sw) => {
        // Calculate actual date from weekStart + dayIndex
        const date = new Date(week.weekStart);
        date.setDate(date.getDate() + sw.dayIndex);

        return {
          ...sw,
          date: date.toISOString().split('T')[0],
          weekStart: week.weekStart,
          coachName: week.coach?.fullName || null,
        };
      }),
    );

    return {
      weeks: trainingWeeks,
      workouts,
    };
  }

  // Get a single scheduled workout by ID (for detail view)
  async getScheduledWorkout(id: string) {
    return this.prisma.scheduledWorkout.findUnique({
      where: { id },
      include: {
        workout: {
          include: { category: true },
        },
        trainingWeek: {
          select: {
            weekStart: true,
            athleteId: true,
            athlete: { select: { id: true, fullName: true, ftp: true } },
            coach: { select: { id: true, fullName: true } },
          },
        },
        activities: {
          select: {
            id: true,
            name: true,
            activityType: true,
            source: true,
            fileFormat: true,
            startTime: true,
            endTime: true,
            durationSeconds: true,
            movingTime: true,
            distanceMeters: true,
            elevationGain: true,
            elevationLoss: true,
            avgPower: true,
            maxPower: true,
            normalizedPower: true,
            avgHeartRate: true,
            maxHeartRate: true,
            avgCadence: true,
            maxCadence: true,
            avgSpeed: true,
            maxSpeed: true,
            tss: true,
            intensityFactor: true,
            calories: true,
            hasGPS: true,
            startLatitude: true,
            startLongitude: true,
            temperature: true,
            telemetryData: true,
            laps: true,
            notes: true,
          },
        },
      },
    });
  }

  // Coach Dashboard - aggregated stats for all athletes
  async getCoachDashboard(coachId: string, weekStart: Date) {
    // Get all active athlete relationships
    const relationships = await this.prisma.coachAthleteRelationship.findMany({
      where: {
        coachId,
        status: 'ACTIVE',
      },
      select: {
        athleteId: true,
        athlete: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const athleteIds = relationships.map((r) => r.athleteId);

    if (athleteIds.length === 0) {
      return {
        overview: {
          totalAthletes: 0,
          totalWorkoutsPlanned: 0,
          totalWorkoutsCompleted: 0,
          overallCompliance: 0,
          totalTSSPlanned: 0,
          totalTSSCompleted: 0,
        },
        athleteProgress: [],
        athletesNeedingAttention: [],
        upcomingGoals: [],
      };
    }

    // Get all training weeks for these athletes for the given week
    const trainingWeeks = await this.prisma.trainingWeek.findMany({
      where: {
        athleteId: { in: athleteIds },
        weekStart,
      },
      include: {
        scheduledWorkouts: {
          include: {
            workout: {
              select: { tssPlanned: true, durationSeconds: true, name: true },
            },
          },
        },
        athlete: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // Calculate per-athlete stats
    const athleteProgress = relationships.map((rel) => {
      const week = trainingWeeks.find((w) => w.athleteId === rel.athleteId);
      const workouts = week?.scheduledWorkouts || [];
      const completedWorkouts = workouts.filter((w) => w.completed);
      const plannedTSS = workouts.reduce(
        (sum, w) => sum + (w.workout.tssPlanned || 0),
        0,
      );
      const completedTSS = completedWorkouts.reduce(
        (sum, w) => sum + (w.actualTSS || w.workout.tssPlanned || 0),
        0,
      );
      const plannedHours = workouts.reduce(
        (sum, w) => sum + (w.workout.durationSeconds || 0) / 3600,
        0,
      );
      const completedHours = completedWorkouts.reduce((sum, w) => {
        if (w.actualDurationSeconds) return sum + w.actualDurationSeconds / 3600;
        return sum + (w.workout.durationSeconds || 0) / 3600;
      }, 0);

      const compliance =
        workouts.length > 0
          ? Math.round((completedWorkouts.length / workouts.length) * 100)
          : 0;

      // Check for missed workouts (past days that weren't completed)
      const today = new Date();
      const missedWorkouts = workouts.filter((w) => {
        const workoutDate = new Date(weekStart);
        workoutDate.setDate(workoutDate.getDate() + w.dayIndex);
        return !w.completed && workoutDate < today;
      });

      return {
        athleteId: rel.athleteId,
        athleteName: rel.athlete.fullName || rel.athlete.email.split('@')[0],
        workoutsPlanned: workouts.length,
        workoutsCompleted: completedWorkouts.length,
        compliance,
        plannedTSS: Math.round(plannedTSS),
        completedTSS: Math.round(completedTSS),
        plannedHours: Math.round(plannedHours * 10) / 10,
        completedHours: Math.round(completedHours * 10) / 10,
        missedWorkouts: missedWorkouts.length,
        lastWorkoutDate: completedWorkouts.length > 0
          ? completedWorkouts.sort((a, b) =>
              new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
            )[0].completedAt
          : null,
      };
    });

    // Athletes needing attention: low compliance or missed workouts
    const athletesNeedingAttention = athleteProgress
      .filter((a) => a.missedWorkouts > 0 || (a.workoutsPlanned > 0 && a.compliance < 50))
      .sort((a, b) => b.missedWorkouts - a.missedWorkouts || a.compliance - b.compliance);

    // Calculate overview totals
    const overview = {
      totalAthletes: athleteIds.length,
      totalWorkoutsPlanned: athleteProgress.reduce(
        (sum, a) => sum + a.workoutsPlanned,
        0,
      ),
      totalWorkoutsCompleted: athleteProgress.reduce(
        (sum, a) => sum + a.workoutsCompleted,
        0,
      ),
      overallCompliance:
        athleteProgress.length > 0
          ? Math.round(
              athleteProgress.reduce((sum, a) => sum + a.compliance, 0) /
                athleteProgress.length,
            )
          : 0,
      totalTSSPlanned: athleteProgress.reduce((sum, a) => sum + a.plannedTSS, 0),
      totalTSSCompleted: athleteProgress.reduce(
        (sum, a) => sum + a.completedTSS,
        0,
      ),
    };

    // Get upcoming goals for all athletes
    const upcomingGoals = await this.prisma.goal.findMany({
      where: {
        athleteId: { in: athleteIds },
        eventDate: {
          gte: new Date(),
        },
      },
      include: {
        athlete: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
      take: 10,
    });

    return {
      overview,
      athleteProgress: athleteProgress.sort((a, b) =>
        a.athleteName.localeCompare(b.athleteName)
      ),
      athletesNeedingAttention,
      upcomingGoals: upcomingGoals.map((g) => ({
        id: g.id,
        name: g.name,
        eventDate: g.eventDate,
        priority: g.priority,
        eventType: g.eventType,
        athleteId: g.athleteId,
        athleteName: g.athlete.fullName || g.athlete.email.split('@')[0],
      })),
    };
  }

  /**
   * Copy a single scheduled workout from one athlete to another
   * Preserves workout modifications (structure overrides, etc.)
   */
  async copyCrossAthleteWorkout(data: {
    sourceScheduledId: string;
    targetAthleteId: string;
    targetWeekStart: Date;
    targetDayIndex: number;
    preserveOverrides?: boolean;
  }) {
    // Fetch source workout with all details
    const sourceWorkout = await this.prisma.scheduledWorkout.findUnique({
      where: { id: data.sourceScheduledId },
      include: {
        workout: true,
      },
    });

    if (!sourceWorkout) {
      throw new Error('Source workout not found');
    }

    // Get or create target training week
    let targetWeek = await this.prisma.trainingWeek.findUnique({
      where: {
        athleteId_weekStart: {
          athleteId: data.targetAthleteId,
          weekStart: data.targetWeekStart,
        },
      },
    });

    if (!targetWeek) {
      // Create new week if it doesn't exist
      targetWeek = await this.prisma.trainingWeek.create({
        data: {
          weekStart: data.targetWeekStart,
          athlete: { connect: { id: data.targetAthleteId } },
        },
      });
    }

    // Get max sort order for target day
    const existingWorkouts = await this.prisma.scheduledWorkout.findMany({
      where: {
        trainingWeekId: targetWeek.id,
        dayIndex: data.targetDayIndex,
      },
      orderBy: { sortOrder: 'desc' },
      take: 1,
    });

    const newSortOrder = existingWorkouts.length > 0
      ? existingWorkouts[0].sortOrder + 1
      : 0;

    // Create new scheduled workout
    const copiedWorkout = await this.prisma.scheduledWorkout.create({
      data: {
        dayIndex: data.targetDayIndex,
        sortOrder: newSortOrder,
        completed: false, // Always start uncompleted
        trainingWeek: { connect: { id: targetWeek.id } },
        workout: { connect: { id: sourceWorkout.workoutId } },
        // Preserve overrides if requested and source has modifications
        ...(data.preserveOverrides &&
          sourceWorkout.isModified && {
            structureOverride: sourceWorkout.structureOverride as Prisma.InputJsonValue,
            durationOverride: sourceWorkout.durationOverride,
            tssOverride: sourceWorkout.tssOverride,
            ifOverride: sourceWorkout.ifOverride,
            isModified: true,
          }),
      },
      include: {
        workout: {
          include: { category: true },
        },
      },
    });

    return copiedWorkout;
  }

  /**
   * Copy an entire week of workouts from one athlete to another
   * Supports merge (add to existing) and overwrite (replace existing) strategies
   */
  async copyCrossAthleteWeek(data: {
    sourceAthleteId: string;
    sourceWeekStart: Date;
    targetAthleteId: string;
    targetWeekStart: Date;
    strategy: 'merge' | 'overwrite';
  }) {
    // Fetch source week with all workouts
    const sourceWeek = await this.prisma.trainingWeek.findUnique({
      where: {
        athleteId_weekStart: {
          athleteId: data.sourceAthleteId,
          weekStart: data.sourceWeekStart,
        },
      },
      include: {
        scheduledWorkouts: {
          include: { workout: true },
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!sourceWeek) {
      throw new Error('Source week not found');
    }

    if (sourceWeek.scheduledWorkouts.length === 0) {
      throw new Error('Source week has no workouts to copy');
    }

    // Get or create target week
    let targetWeek = await this.prisma.trainingWeek.findUnique({
      where: {
        athleteId_weekStart: {
          athleteId: data.targetAthleteId,
          weekStart: data.targetWeekStart,
        },
      },
      include: {
        scheduledWorkouts: true,
      },
    });

    if (!targetWeek) {
      targetWeek = await this.prisma.trainingWeek.create({
        data: {
          weekStart: data.targetWeekStart,
          athlete: { connect: { id: data.targetAthleteId } },
        },
        include: {
          scheduledWorkouts: true,
        },
      });
    }

    let deletedCount = 0;

    // Handle overwrite strategy: delete existing workouts
    if (data.strategy === 'overwrite' && targetWeek.scheduledWorkouts.length > 0) {
      const deleteResult = await this.prisma.scheduledWorkout.deleteMany({
        where: { trainingWeekId: targetWeek.id },
      });
      deletedCount = deleteResult.count;
    }

    // Copy all workouts from source to target
    const copiedWorkouts: any[] = [];

    for (const sourceWorkout of sourceWeek.scheduledWorkouts) {
      // For merge strategy, get max sort order for each day
      let sortOrder = sourceWorkout.sortOrder;

      if (data.strategy === 'merge') {
        const existingOnDay = await this.prisma.scheduledWorkout.findMany({
          where: {
            trainingWeekId: targetWeek.id,
            dayIndex: sourceWorkout.dayIndex,
          },
          orderBy: { sortOrder: 'desc' },
          take: 1,
        });

        sortOrder = existingOnDay.length > 0
          ? existingOnDay[0].sortOrder + 1 + sourceWorkout.sortOrder
          : sourceWorkout.sortOrder;
      }

      const copiedWorkout = await this.prisma.scheduledWorkout.create({
        data: {
          dayIndex: sourceWorkout.dayIndex,
          sortOrder,
          completed: false, // Always start uncompleted
          trainingWeek: { connect: { id: targetWeek.id } },
          workout: { connect: { id: sourceWorkout.workoutId } },
          // Preserve overrides if source has modifications
          ...(sourceWorkout.isModified && {
            structureOverride: sourceWorkout.structureOverride as Prisma.InputJsonValue,
            durationOverride: sourceWorkout.durationOverride,
            tssOverride: sourceWorkout.tssOverride,
            ifOverride: sourceWorkout.ifOverride,
            isModified: true,
          }),
        },
        include: {
          workout: {
            include: { category: true },
          },
        },
      });

      copiedWorkouts.push(copiedWorkout);
    }

    // Get final count
    const finalWeek = await this.prisma.trainingWeek.findUnique({
      where: { id: targetWeek.id },
      include: {
        scheduledWorkouts: true,
      },
    });

    return {
      copiedCount: copiedWorkouts.length,
      deletedCount,
      totalWorkouts: finalWeek?.scheduledWorkouts.length || copiedWorkouts.length,
      trainingWeekId: targetWeek.id,
    };
  }
}
