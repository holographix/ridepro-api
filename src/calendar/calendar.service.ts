import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
}
