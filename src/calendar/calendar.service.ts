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
}
