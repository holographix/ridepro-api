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
import { AssessmentsService } from './assessments.service';
import { AssessmentType } from '@prisma/client';

@Public()
@Controller('api/assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  /**
   * Get all assessments for an athlete
   */
  @Get('athlete/:athleteId')
  getAthleteAssessments(@Param('athleteId') athleteId: string) {
    return this.assessmentsService.getAthleteAssessments(athleteId);
  }

  /**
   * Get latest assessment for an athlete
   */
  @Get('athlete/:athleteId/latest')
  getLatestAssessment(
    @Param('athleteId') athleteId: string,
    @Query('type') testType?: AssessmentType,
  ) {
    return this.assessmentsService.getLatestAssessment(athleteId, testType);
  }

  /**
   * Get a single assessment by ID
   */
  @Get(':id')
  getAssessment(@Param('id') id: string) {
    return this.assessmentsService.getAssessment(id);
  }

  /**
   * Create Sprint + 12min protocol assessment
   * Sprint: 15" all-out effort - record PEAK power
   * Climb: 12' steady climb - record AVERAGE power
   */
  @Post('sprint-12min')
  createSprint12MinAssessment(
    @Body()
    data: {
      athleteId: string;
      testDate: string;
      sprintPeakPower?: number;   // Peak power during 15" sprint (W)
      sprintMaxHR?: number;       // Max HR during sprint (bpm)
      climb12AvgPower?: number;   // Average power during 12' climb (W)
      climb12MaxHR?: number;      // Max HR during 12' climb (bpm)
      notes?: string;
    },
  ) {
    return this.assessmentsService.createSprint12MinAssessment(data.athleteId, {
      testDate: new Date(data.testDate),
      sprintPeakPower: data.sprintPeakPower,
      sprintMaxHR: data.sprintMaxHR,
      climb12AvgPower: data.climb12AvgPower,
      climb12MaxHR: data.climb12MaxHR,
      notes: data.notes,
    });
  }

  /**
   * Create 1/2/5min protocol assessment
   * All efforts record AVERAGE power over the duration
   */
  @Post('power-125min')
  createPower125MinAssessment(
    @Body()
    data: {
      athleteId: string;
      testDate: string;
      effort1minAvgPower?: number;  // Average power during 1' effort (W)
      effort1minMaxHR?: number;     // Max HR during 1' effort (bpm)
      effort2minAvgPower?: number;  // Average power during 2' effort (W)
      effort2minMaxHR?: number;     // Max HR during 2' effort (bpm)
      effort5minAvgPower?: number;  // Average power during 5' effort (W)
      effort5minMaxHR?: number;     // Max HR during 5' effort (bpm)
      notes?: string;
    },
  ) {
    return this.assessmentsService.createPower125MinAssessment(data.athleteId, {
      testDate: new Date(data.testDate),
      effort1minAvgPower: data.effort1minAvgPower,
      effort1minMaxHR: data.effort1minMaxHR,
      effort2minAvgPower: data.effort2minAvgPower,
      effort2minMaxHR: data.effort2minMaxHR,
      effort5minAvgPower: data.effort5minAvgPower,
      effort5minMaxHR: data.effort5minMaxHR,
      notes: data.notes,
    });
  }

  /**
   * Update an assessment
   */
  @Put(':id')
  updateAssessment(
    @Param('id') id: string,
    @Body()
    data: {
      testDate?: string;
      sprintPeakPower?: number;
      sprintMaxHR?: number;
      climb12AvgPower?: number;
      climb12MaxHR?: number;
      effort1minAvgPower?: number;
      effort1minMaxHR?: number;
      effort2minAvgPower?: number;
      effort2minMaxHR?: number;
      effort5minAvgPower?: number;
      effort5minMaxHR?: number;
      notes?: string;
    },
  ) {
    return this.assessmentsService.updateAssessment(id, {
      ...(data.testDate && { testDate: new Date(data.testDate) }),
      sprintPeakPower: data.sprintPeakPower,
      sprintMaxHR: data.sprintMaxHR,
      climb12AvgPower: data.climb12AvgPower,
      climb12MaxHR: data.climb12MaxHR,
      effort1minAvgPower: data.effort1minAvgPower,
      effort1minMaxHR: data.effort1minMaxHR,
      effort2minAvgPower: data.effort2minAvgPower,
      effort2minMaxHR: data.effort2minMaxHR,
      effort5minAvgPower: data.effort5minAvgPower,
      effort5minMaxHR: data.effort5minMaxHR,
      notes: data.notes,
    });
  }

  /**
   * Delete an assessment
   */
  @Delete(':id')
  deleteAssessment(@Param('id') id: string) {
    return this.assessmentsService.deleteAssessment(id);
  }

  /**
   * Update athlete's FTP based on latest assessment
   */
  @Post('athlete/:athleteId/update-ftp')
  updateAthleteFTP(@Param('athleteId') athleteId: string) {
    return this.assessmentsService.updateAthleteFTP(athleteId);
  }

  /**
   * Get assessment status for all athletes of a coach
   * Returns which athletes have assessments, are overdue, or have new submissions
   */
  @Get('coach/:coachId/status')
  getCoachAthletesAssessmentStatus(@Param('coachId') coachId: string) {
    return this.assessmentsService.getCoachAthletesAssessmentStatus(coachId);
  }

  /**
   * Get athlete stats including assessment data
   * Used for the AthleteStatsPage
   */
  @Get('athlete/:athleteId/stats')
  getAthleteStats(@Param('athleteId') athleteId: string) {
    return this.assessmentsService.getAthleteStats(athleteId);
  }
}
