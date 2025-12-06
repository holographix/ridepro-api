import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimeSlot } from '@prisma/client';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async getAthleteAvailability(athleteId: string) {
    return this.prisma.athleteAvailability.findMany({
      where: { athleteId },
      orderBy: { dayIndex: 'asc' },
    });
  }

  async setDayAvailability(data: {
    athleteId: string;
    dayIndex: number;
    available: boolean;
    timeSlots?: TimeSlot[];
    maxHours?: number;
    notes?: string;
  }) {
    return this.prisma.athleteAvailability.upsert({
      where: {
        athleteId_dayIndex: {
          athleteId: data.athleteId,
          dayIndex: data.dayIndex,
        },
      },
      update: {
        available: data.available,
        timeSlots: data.timeSlots,
        maxHours: data.maxHours,
        notes: data.notes,
      },
      create: {
        dayIndex: data.dayIndex,
        available: data.available,
        timeSlots: data.timeSlots ?? [],
        maxHours: data.maxHours,
        notes: data.notes,
        athlete: { connect: { id: data.athleteId } },
      },
    });
  }

  async setWeekAvailability(
    athleteId: string,
    availability: Array<{
      dayIndex: number;
      available: boolean;
      timeSlots?: TimeSlot[];
      maxHours?: number;
      notes?: string;
    }>,
  ) {
    const operations = availability.map((day) =>
      this.prisma.athleteAvailability.upsert({
        where: {
          athleteId_dayIndex: {
            athleteId,
            dayIndex: day.dayIndex,
          },
        },
        update: {
          available: day.available,
          timeSlots: day.timeSlots,
          maxHours: day.maxHours,
          notes: day.notes,
        },
        create: {
          dayIndex: day.dayIndex,
          available: day.available,
          timeSlots: day.timeSlots ?? [],
          maxHours: day.maxHours,
          notes: day.notes,
          athlete: { connect: { id: athleteId } },
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  async deleteDayAvailability(athleteId: string, dayIndex: number) {
    return this.prisma.athleteAvailability.delete({
      where: {
        athleteId_dayIndex: { athleteId, dayIndex },
      },
    });
  }

  async clearAthleteAvailability(athleteId: string) {
    return this.prisma.athleteAvailability.deleteMany({
      where: { athleteId },
    });
  }
}
