import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoalPriority } from '@prisma/client';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async getAthleteGoals(athleteId: string) {
    return this.prisma.goal.findMany({
      where: { athleteId },
      orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
    });
  }

  async getGoal(id: string) {
    return this.prisma.goal.findUnique({
      where: { id },
      include: {
        athlete: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async createGoal(data: {
    athleteId: string;
    name: string;
    eventDate?: Date;
    priority?: GoalPriority;
    eventType?: string;
    targetDuration?: string;
    notes?: string;
  }) {
    return this.prisma.goal.create({
      data: {
        name: data.name,
        eventDate: data.eventDate,
        priority: data.priority ?? 'B',
        eventType: data.eventType,
        targetDuration: data.targetDuration,
        notes: data.notes,
        athlete: { connect: { id: data.athleteId } },
      },
    });
  }

  async updateGoal(
    id: string,
    data: {
      name?: string;
      eventDate?: Date | null;
      priority?: GoalPriority;
      eventType?: string;
      targetDuration?: string;
      notes?: string;
    },
  ) {
    return this.prisma.goal.update({
      where: { id },
      data,
    });
  }

  async deleteGoal(id: string) {
    return this.prisma.goal.delete({
      where: { id },
    });
  }

  async getUpcomingGoals(athleteId: string) {
    return this.prisma.goal.findMany({
      where: {
        athleteId,
        eventDate: {
          gte: new Date(),
        },
      },
      orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
    });
  }

  async getGoalsByPriority(athleteId: string, priority: GoalPriority) {
    return this.prisma.goal.findMany({
      where: { athleteId, priority },
      orderBy: { eventDate: 'asc' },
    });
  }
}
