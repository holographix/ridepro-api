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
import { CalendarService } from './calendar.service';

@Controller('api/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // Training Weeks
  @Get('week/:athleteId')
  getWeek(
    @Param('athleteId') athleteId: string,
    @Query('weekStart') weekStart: string,
  ) {
    return this.calendarService.getWeek(athleteId, new Date(weekStart));
  }

  @Get('week/id/:id')
  getWeekById(@Param('id') id: string) {
    return this.calendarService.getWeekById(id);
  }

  @Get('weeks/:athleteId')
  getWeeksRange(
    @Param('athleteId') athleteId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.calendarService.getWeeksRange(
      athleteId,
      new Date(start),
      new Date(end),
    );
  }

  @Post('week')
  createWeek(
    @Body()
    data: {
      athleteId: string;
      weekStart: string;
      coachId?: string;
      notes?: string;
    },
  ) {
    return this.calendarService.createWeek({
      ...data,
      weekStart: new Date(data.weekStart),
    });
  }

  @Put('week/:id')
  updateWeek(@Param('id') id: string, @Body() data: { notes?: string }) {
    return this.calendarService.updateWeek(id, data);
  }

  @Delete('week/:id')
  deleteWeek(@Param('id') id: string) {
    return this.calendarService.deleteWeek(id);
  }

  // Scheduled Workouts
  @Post('scheduled')
  addWorkoutToDay(
    @Body()
    data: {
      trainingWeekId: string;
      workoutId: string;
      dayIndex: number;
      sortOrder?: number;
      notes?: string;
    },
  ) {
    return this.calendarService.addWorkoutToDay(data);
  }

  @Put('scheduled/:id')
  updateScheduledWorkout(
    @Param('id') id: string,
    @Body()
    data: {
      dayIndex?: number;
      sortOrder?: number;
      notes?: string;
      completed?: boolean;
    },
  ) {
    return this.calendarService.updateScheduledWorkout(id, data);
  }

  @Put('scheduled/:id/move')
  moveWorkout(
    @Param('id') id: string,
    @Body() data: { dayIndex: number; sortOrder: number },
  ) {
    return this.calendarService.moveWorkout(id, data.dayIndex, data.sortOrder);
  }

  @Delete('scheduled/:id')
  removeScheduledWorkout(@Param('id') id: string) {
    return this.calendarService.removeScheduledWorkout(id);
  }

  @Put('scheduled/:id/complete')
  markWorkoutCompleted(
    @Param('id') id: string,
    @Body() data: { completed: boolean },
  ) {
    return this.calendarService.markWorkoutCompleted(id, data.completed);
  }

  @Put('week/:weekId/day/:dayIndex/reorder')
  reorderDayWorkouts(
    @Param('weekId') weekId: string,
    @Param('dayIndex') dayIndex: string,
    @Body() data: { workoutIds: string[] },
  ) {
    return this.calendarService.reorderDayWorkouts(
      weekId,
      parseInt(dayIndex),
      data.workoutIds,
    );
  }
}
