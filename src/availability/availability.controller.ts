import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AvailabilityService } from './availability.service';
import { TimeSlot } from '@prisma/client';

@Public()
@Controller('api/availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // ============================================
  // AVAILABILITY NOTES
  // ============================================

  @Get(':athleteId/notes')
  getAvailabilityNotes(@Param('athleteId') athleteId: string) {
    return this.availabilityService.getAvailabilityNotes(athleteId);
  }

  @Put(':athleteId/notes')
  setAvailabilityNotes(
    @Param('athleteId') athleteId: string,
    @Body() data: { notes: string | null },
  ) {
    return this.availabilityService.setAvailabilityNotes(athleteId, data.notes);
  }

  // ============================================
  // UNAVAILABLE DATES
  // ============================================

  @Get(':athleteId/unavailable-dates')
  getUnavailableDates(
    @Param('athleteId') athleteId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.availabilityService.getUnavailableDates(
      athleteId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Post(':athleteId/unavailable-dates')
  addUnavailableDate(
    @Param('athleteId') athleteId: string,
    @Body() data: { date: string; reason?: string },
  ) {
    return this.availabilityService.addUnavailableDate({
      athleteId,
      date: new Date(data.date),
      reason: data.reason,
    });
  }

  @Post(':athleteId/unavailable-dates/bulk')
  addUnavailableDates(
    @Param('athleteId') athleteId: string,
    @Body() data: { dates: Array<{ date: string; reason?: string }> },
  ) {
    return this.availabilityService.addUnavailableDates(
      athleteId,
      data.dates.map((d) => ({ date: new Date(d.date), reason: d.reason })),
    );
  }

  @Delete(':athleteId/unavailable-dates/:date')
  removeUnavailableDate(
    @Param('athleteId') athleteId: string,
    @Param('date') date: string,
  ) {
    return this.availabilityService.removeUnavailableDate(
      athleteId,
      new Date(date),
    );
  }

  @Delete(':athleteId/unavailable-dates')
  clearUnavailableDates(@Param('athleteId') athleteId: string) {
    return this.availabilityService.clearUnavailableDates(athleteId);
  }

  // ============================================
  // WEEKLY AVAILABILITY (existing)
  // ============================================

  @Get(':athleteId')
  getAthleteAvailability(@Param('athleteId') athleteId: string) {
    return this.availabilityService.getAthleteAvailability(athleteId);
  }

  @Put(':athleteId/day/:dayIndex')
  setDayAvailability(
    @Param('athleteId') athleteId: string,
    @Param('dayIndex') dayIndex: string,
    @Body()
    data: {
      available: boolean;
      timeSlots?: TimeSlot[];
      maxHours?: number;
      notes?: string;
    },
  ) {
    return this.availabilityService.setDayAvailability({
      athleteId,
      dayIndex: parseInt(dayIndex),
      ...data,
    });
  }

  @Put(':athleteId')
  setWeekAvailability(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      availability: Array<{
        dayIndex: number;
        available: boolean;
        timeSlots?: TimeSlot[];
        maxHours?: number;
        notes?: string;
      }>;
    },
  ) {
    return this.availabilityService.setWeekAvailability(
      athleteId,
      data.availability,
    );
  }

  @Delete(':athleteId/day/:dayIndex')
  deleteDayAvailability(
    @Param('athleteId') athleteId: string,
    @Param('dayIndex') dayIndex: string,
  ) {
    return this.availabilityService.deleteDayAvailability(
      athleteId,
      parseInt(dayIndex),
    );
  }

  @Delete(':athleteId')
  clearAthleteAvailability(@Param('athleteId') athleteId: string) {
    return this.availabilityService.clearAthleteAvailability(athleteId);
  }
}
