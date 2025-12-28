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
import { CalendarService } from './calendar.service';

@Public()
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

  @Put('scheduled/:id/structure')
  modifyScheduledWorkoutStructure(
    @Param('id') id: string,
    @Body() data: { structure: any },
  ) {
    return this.calendarService.modifyScheduledWorkoutStructure(id, data.structure);
  }

  @Delete('scheduled/:id/structure')
  resetScheduledWorkoutStructure(@Param('id') id: string) {
    return this.calendarService.resetScheduledWorkoutStructure(id);
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

  // Athlete Stats for Coach Dashboard
  @Get('stats/athletes')
  getAthleteStats(
    @Query('athleteIds') athleteIds: string,
    @Query('weekStart') weekStart: string,
  ) {
    const ids = athleteIds.split(',').filter((id) => id.trim());
    return this.calendarService.getAthleteStats(ids, new Date(weekStart));
  }

  // Coach Dashboard - aggregated stats for all athletes (MUST be before coach/:coachId for route matching)
  @Get('coach/:coachId/dashboard')
  getCoachDashboard(
    @Param('coachId') coachId: string,
    @Query('weekStart') weekStart: string,
  ) {
    return this.calendarService.getCoachDashboard(coachId, new Date(weekStart));
  }

  // Coach Calendar - aggregated view of all athletes' workouts
  @Get('coach/:coachId')
  getCoachCalendar(
    @Param('coachId') coachId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('athleteIds') athleteIds?: string,
  ) {
    const filterAthleteIds = athleteIds
      ? athleteIds.split(',').filter((id) => id.trim())
      : undefined;
    return this.calendarService.getCoachCalendar(
      coachId,
      new Date(start),
      new Date(end),
      filterAthleteIds,
    );
  }

  // Athlete Calendar - athlete's own view of their workouts
  @Get('athlete/:athleteId')
  getAthleteCalendar(
    @Param('athleteId') athleteId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.calendarService.getAthleteCalendar(
      athleteId,
      new Date(start),
      new Date(end),
    );
  }

  // Get single scheduled workout (for detail view)
  @Get('scheduled/:id')
  getScheduledWorkout(@Param('id') id: string) {
    return this.calendarService.getScheduledWorkout(id);
  }

  // Submit workout results (athlete completion with actual data)
  @Put('scheduled/:id/results')
  submitWorkoutResults(
    @Param('id') id: string,
    @Body()
    data: {
      actualDurationSeconds?: number;
      actualTSS?: number;
      actualIF?: number;
      avgPower?: number;
      avgHeartRate?: number;
      rpe?: number;
      feeling?: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'EXHAUSTED';
      resultNotes?: string;
    },
  ) {
    return this.calendarService.submitWorkoutResults(id, data);
  }

  // Cross-athlete workout copy (for head-to-head comparison)
  @Post('scheduled/copy-cross-athlete')
  copyCrossAthleteWorkout(
    @Body()
    data: {
      sourceScheduledId: string;
      targetAthleteId: string;
      targetWeekStart: string;
      targetDayIndex: number;
      preserveOverrides?: boolean;
    },
  ) {
    return this.calendarService.copyCrossAthleteWorkout({
      ...data,
      targetWeekStart: new Date(data.targetWeekStart),
    });
  }

  // Cross-athlete week copy (for head-to-head comparison)
  @Post('week/copy-cross-athlete')
  copyCrossAthleteWeek(
    @Body()
    data: {
      sourceAthleteId: string;
      sourceWeekStart: string;
      targetAthleteId: string;
      targetWeekStart: string;
      strategy: 'merge' | 'overwrite';
    },
  ) {
    return this.calendarService.copyCrossAthleteWeek({
      ...data,
      sourceWeekStart: new Date(data.sourceWeekStart),
      targetWeekStart: new Date(data.targetWeekStart),
    });
  }
}
