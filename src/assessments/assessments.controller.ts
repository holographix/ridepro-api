import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AssessmentsService } from './assessments.service';
import type { Day1Data, Day2Data } from './assessments.service';

@Public()
@Controller('api/assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  // ============================================
  // 2-DAY ASSESSMENT WORKFLOW
  // ============================================

  /**
   * Start a new 2-day assessment test
   * Creates assessment with status DAY1_PENDING
   *
   * POST /api/assessments/start
   * Body: { athleteId: string }
   */
  @Post('start')
  startTest(@Body() data: { athleteId: string }) {
    return this.assessmentsService.startTest(data.athleteId);
  }

  /**
   * Complete Day 1 of the assessment (1'/2'/5' efforts)
   * Transitions from DAY1_PENDING → DAY1_COMPLETED
   * Sets expiration date (15 days from now)
   *
   * POST /api/assessments/:id/complete-day1
   * Body: Day1Data
   */
  @Post(':id/complete-day1')
  completeDay1(
    @Param('id') id: string,
    @Body() data: Day1Data,
  ) {
    return this.assessmentsService.completeDay1(id, data);
  }

  /**
   * Start Day 2 of the assessment
   * Validates Day 1 is complete and test hasn't expired
   * Transitions from DAY1_COMPLETED → DAY2_PENDING
   *
   * POST /api/assessments/:id/start-day2
   */
  @Post(':id/start-day2')
  startDay2(@Param('id') id: string) {
    return this.assessmentsService.startDay2(id);
  }

  /**
   * Complete Day 2 of the assessment (5" sprint + 12' climb)
   * Transitions from DAY2_PENDING → COMPLETED
   * Calculates FTP and maxHR
   * Auto-updates athlete's profile
   *
   * POST /api/assessments/:id/complete-day2
   * Body: Day2Data
   */
  @Post(':id/complete-day2')
  completeDay2(
    @Param('id') id: string,
    @Body() data: Day2Data,
  ) {
    return this.assessmentsService.completeDay2(id, data);
  }

  /**
   * Get ongoing test for an athlete (if any)
   * Returns test that is not COMPLETED or EXPIRED
   *
   * GET /api/assessments/athlete/:athleteId/ongoing
   */
  @Get('athlete/:athleteId/ongoing')
  getOngoingTest(@Param('athleteId') athleteId: string) {
    return this.assessmentsService.getOngoingTest(athleteId);
  }

  /**
   * Check for expired tests and mark them as EXPIRED
   * Background job endpoint or on-demand check
   *
   * POST /api/assessments/check-expired
   */
  @Post('check-expired')
  checkExpiredTests() {
    return this.assessmentsService.checkExpiredTests();
  }

  // ============================================
  // QUERY ENDPOINTS
  // ============================================

  /**
   * Get all completed assessments for an athlete
   *
   * GET /api/assessments/athlete/:athleteId
   */
  @Get('athlete/:athleteId')
  getAthleteAssessments(@Param('athleteId') athleteId: string) {
    return this.assessmentsService.getAthleteAssessments(athleteId);
  }

  /**
   * Get latest completed assessment for an athlete
   *
   * GET /api/assessments/athlete/:athleteId/latest
   */
  @Get('athlete/:athleteId/latest')
  getLatestAssessment(@Param('athleteId') athleteId: string) {
    return this.assessmentsService.getLatestAssessment(athleteId);
  }

  /**
   * Get athlete stats including assessment data
   * Used for the AthleteStatsPage
   *
   * GET /api/assessments/athlete/:athleteId/stats
   */
  @Get('athlete/:athleteId/stats')
  getAthleteStats(@Param('athleteId') athleteId: string) {
    return this.assessmentsService.getAthleteStats(athleteId);
  }

  /**
   * Get assessment status for all athletes of a coach
   * Returns which athletes have assessments, are overdue, or have new submissions
   *
   * GET /api/assessments/coach/:coachId/status
   */
  @Get('coach/:coachId/status')
  getCoachAthletesAssessmentStatus(@Param('coachId') coachId: string) {
    return this.assessmentsService.getCoachAthletesAssessmentStatus(coachId);
  }

  /**
   * Get a single assessment by ID
   *
   * GET /api/assessments/:id
   */
  @Get(':id')
  getAssessment(@Param('id') id: string) {
    return this.assessmentsService.getAssessment(id);
  }

  // ============================================
  // MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * Delete an assessment
   * Only allowed for tests in progress (not completed)
   *
   * DELETE /api/assessments/:id
   */
  @Delete(':id')
  deleteAssessment(@Param('id') id: string) {
    return this.assessmentsService.deleteAssessment(id);
  }
}
