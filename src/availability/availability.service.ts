import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimeSlot } from '@prisma/client';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // AVAILABILITY NOTES
  // ============================================

  async getAvailabilityNotes(athleteId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: athleteId },
      select: { availabilityNotes: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${athleteId} not found`);
    }
    return { notes: user.availabilityNotes };
  }

  async setAvailabilityNotes(athleteId: string, notes: string | null) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: { availabilityNotes: notes },
      select: { availabilityNotes: true },
    });
  }

  // ============================================
  // UNAVAILABLE DATES
  // ============================================

  async getUnavailableDates(athleteId: string, startDate?: Date, endDate?: Date) {
    const where: { athleteId: string; date?: { gte?: Date; lte?: Date } } = { athleteId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return this.prisma.unavailableDate.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async addUnavailableDate(data: {
    athleteId: string;
    date: Date;
    reason?: string;
  }) {
    return this.prisma.unavailableDate.upsert({
      where: {
        athleteId_date: {
          athleteId: data.athleteId,
          date: data.date,
        },
      },
      update: { reason: data.reason },
      create: {
        date: data.date,
        reason: data.reason,
        athlete: { connect: { id: data.athleteId } },
      },
    });
  }

  async addUnavailableDates(
    athleteId: string,
    dates: Array<{ date: Date; reason?: string }>,
  ) {
    const operations = dates.map((d) =>
      this.prisma.unavailableDate.upsert({
        where: {
          athleteId_date: {
            athleteId,
            date: d.date,
          },
        },
        update: { reason: d.reason },
        create: {
          date: d.date,
          reason: d.reason,
          athlete: { connect: { id: athleteId } },
        },
      }),
    );
    return this.prisma.$transaction(operations);
  }

  async removeUnavailableDate(athleteId: string, date: Date) {
    return this.prisma.unavailableDate.delete({
      where: {
        athleteId_date: { athleteId, date },
      },
    });
  }

  async clearUnavailableDates(athleteId: string) {
    return this.prisma.unavailableDate.deleteMany({
      where: { athleteId },
    });
  }

  // ============================================
  // WEEKLY AVAILABILITY (existing)
  // ============================================

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
