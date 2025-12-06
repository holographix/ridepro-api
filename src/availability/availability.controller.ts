import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { TimeSlot } from '@prisma/client';

@Controller('api/availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

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
