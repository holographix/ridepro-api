import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentStatus } from '@prisma/client';

// ============================================
// 2-DAY ASSESSMENT PROTOCOL
// Day 1: 1'/2'/5' efforts on 6-7% gradient
// Day 2: 5" sprint + 12' climb on 6-7% gradient
// Athletes have 15 days to complete Day 2 after Day 1
// ============================================

// DTO interfaces for Day 1 data (1'/2'/5' efforts)
export interface Day1Data {
  effort1minAvgPower?: number;
  effort1minMaxHR?: number;
  effort2minAvgPower?: number;
  effort2minMaxHR?: number;
  effort5minAvgPower?: number;
  effort5minMaxHR?: number;
  notes?: string;
}

// DTO interfaces for Day 2 data (5" sprint + 12' climb)
export interface Day2Data {
  sprint5secPeakPower?: number;
  sprint5secMaxHR?: number;
  climb12minAvgPower?: number;
  climb12minMaxHR?: number;
  notes?: string;
}

const DAYS_TO_EXPIRE = 15; // Days allowed to complete Day 2 after Day 1

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Start a new 2-day assessment test
   * Creates assessment with status DAY1_PENDING
   */
  async startTest(athleteId: string) {
    // Check if athlete already has an ongoing test
    const ongoing = await this.getOngoingTest(athleteId);
    if (ongoing) {
      throw new BadRequestException(
        `You already have an ongoing assessment test. Complete or cancel it before starting a new one.`
      );
    }

    const assessment = await this.prisma.assessment.create({
      data: {
        athleteId,
        testStatus: AssessmentStatus.DAY1_PENDING,
      },
    });

    return assessment;
  }

  /**
   * Complete Day 1 of the assessment (1'/2'/5' efforts)
   * Transitions from DAY1_PENDING → DAY1_COMPLETED
   * Sets expiration date (15 days from now)
   */
  async completeDay1(id: string, data: Day1Data) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.testStatus !== AssessmentStatus.DAY1_PENDING) {
      throw new BadRequestException(
        `Cannot complete Day 1. Current status: ${assessment.testStatus}`
      );
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + DAYS_TO_EXPIRE);

    const updated = await this.prisma.assessment.update({
      where: { id },
      data: {
        testStatus: AssessmentStatus.DAY1_COMPLETED,
        day1CompletedAt: now,
        expiresAt,
        effort1minAvgPower: data.effort1minAvgPower,
        effort1minMaxHR: data.effort1minMaxHR,
        effort2minAvgPower: data.effort2minAvgPower,
        effort2minMaxHR: data.effort2minMaxHR,
        effort5minAvgPower: data.effort5minAvgPower,
        effort5minMaxHR: data.effort5minMaxHR,
        notes: data.notes,
      },
    });

    return updated;
  }

  /**
   * Start Day 2 of the assessment
   * Validates Day 1 is complete and test hasn't expired
   * Transitions from DAY1_COMPLETED → DAY2_PENDING
   */
  async startDay2(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Check if expired
    if (assessment.expiresAt && new Date() > assessment.expiresAt) {
      // Mark as expired
      await this.prisma.assessment.update({
        where: { id },
        data: { testStatus: AssessmentStatus.EXPIRED },
      });
      throw new BadRequestException(
        'This assessment test has expired. Please start a new test.'
      );
    }

    if (assessment.testStatus !== AssessmentStatus.DAY1_COMPLETED) {
      throw new BadRequestException(
        `Cannot start Day 2. Current status: ${assessment.testStatus}`
      );
    }

    const updated = await this.prisma.assessment.update({
      where: { id },
      data: {
        testStatus: AssessmentStatus.DAY2_PENDING,
      },
    });

    return updated;
  }

  /**
   * Complete Day 2 of the assessment (5" sprint + 12' climb)
   * Transitions from DAY2_PENDING → COMPLETED
   * Calculates FTP and maxHR
   * Auto-updates athlete's profile
   */
  async completeDay2(id: string, data: Day2Data) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.testStatus !== AssessmentStatus.DAY2_PENDING) {
      throw new BadRequestException(
        `Cannot complete Day 2. Current status: ${assessment.testStatus}`
      );
    }

    // Calculate FTP from 12' climb power using power profile ratio
    // Formula from coach's Excel: ratio = P1'/P12', then apply multiplier based on ratio
    let estimatedFTP: number | null = null;

    if (data.climb12minAvgPower && assessment.effort1minAvgPower) {
      // Calculate power ratio P1'/P12' rounded to 2 decimals
      const powerRatio = Math.floor((assessment.effort1minAvgPower / data.climb12minAvgPower) * 100) / 100;

      let ftpMultiplier: number;
      if (powerRatio < 1.6) {
        // Endurance profile: 1-min power close to 12-min power
        ftpMultiplier = 0.94;
      } else if (powerRatio > 1.9) {
        // Sprint profile: strong 1-min but lower sustained power
        ftpMultiplier = 0.90;
      } else {
        // Balanced profile
        ftpMultiplier = 0.92;
      }

      estimatedFTP = Math.round(data.climb12minAvgPower * ftpMultiplier);
    } else if (data.climb12minAvgPower) {
      // Fallback if P1' is missing: use default 0.92 multiplier
      estimatedFTP = Math.round(data.climb12minAvgPower * 0.92);
    }

    // Find max HR from all efforts (across both days)
    const allHRValues = [
      assessment.effort1minMaxHR,
      assessment.effort2minMaxHR,
      assessment.effort5minMaxHR,
      data.sprint5secMaxHR,
      data.climb12minMaxHR,
    ].filter((hr): hr is number => hr !== null && hr !== undefined);

    const maxHR = allHRValues.length > 0 ? Math.max(...allHRValues) : null;

    const now = new Date();
    const updated = await this.prisma.assessment.update({
      where: { id },
      data: {
        testStatus: AssessmentStatus.COMPLETED,
        day2CompletedAt: now,
        sprint5secPeakPower: data.sprint5secPeakPower,
        sprint5secMaxHR: data.sprint5secMaxHR,
        climb12minAvgPower: data.climb12minAvgPower,
        climb12minMaxHR: data.climb12minMaxHR,
        estimatedFTP,
        maxHR,
        notes: data.notes || assessment.notes,
      },
    });

    // Auto-update athlete's FTP and maxHR
    await this.updateAthleteFromAssessment(
      assessment.athleteId,
      estimatedFTP,
      maxHR,
    );

    return updated;
  }

  /**
   * Get ongoing test for an athlete (if any)
   * Returns test that is not COMPLETED or EXPIRED
   */
  async getOngoingTest(athleteId: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        athleteId,
        testStatus: {
          in: [
            AssessmentStatus.DAY1_PENDING,
            AssessmentStatus.DAY1_COMPLETED,
            AssessmentStatus.DAY2_PENDING,
          ],
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Check if Day 1 completed assessment has expired
    if (assessment && assessment.testStatus === AssessmentStatus.DAY1_COMPLETED) {
      if (assessment.expiresAt && new Date() > assessment.expiresAt) {
        // Mark as expired
        await this.prisma.assessment.update({
          where: { id: assessment.id },
          data: { testStatus: AssessmentStatus.EXPIRED },
        });
        return null; // No ongoing test
      }
    }

    return assessment;
  }

  /**
   * Get all completed assessments for an athlete
   */
  async getAthleteAssessments(athleteId: string) {
    return this.prisma.assessment.findMany({
      where: {
        athleteId,
        testStatus: AssessmentStatus.COMPLETED,
      },
      orderBy: { day2CompletedAt: 'desc' },
    });
  }

  /**
   * Get latest completed assessment for an athlete
   */
  async getLatestAssessment(athleteId: string) {
    return this.prisma.assessment.findFirst({
      where: {
        athleteId,
        testStatus: AssessmentStatus.COMPLETED,
      },
      orderBy: { day2CompletedAt: 'desc' },
    });
  }

  /**
   * Get a single assessment by ID
   */
  async getAssessment(id: string) {
    return this.prisma.assessment.findUnique({
      where: { id },
      include: {
        athlete: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Delete an assessment
   * Only allowed for tests in progress (not completed)
   */
  async deleteAssessment(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.testStatus === AssessmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot delete completed assessment tests'
      );
    }

    return this.prisma.assessment.delete({
      where: { id },
    });
  }

  /**
   * Update athlete's FTP and maxHR from assessment data
   * Called automatically when Day 2 is completed
   */
  private async updateAthleteFromAssessment(
    athleteId: string,
    estimatedFTP: number | null,
    maxHRFromTest: number | null,
  ) {
    const updateData: { ftp?: number; maxHR?: number } = {};

    if (estimatedFTP) {
      updateData.ftp = estimatedFTP;
    }

    // Only update maxHR if the new value is higher than existing
    if (maxHRFromTest) {
      const athlete = await this.prisma.user.findUnique({
        where: { id: athleteId },
        select: { maxHR: true },
      });

      // Update maxHR if it's higher than current or if current is null
      if (!athlete?.maxHR || maxHRFromTest > athlete.maxHR) {
        updateData.maxHR = maxHRFromTest;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: athleteId },
        data: updateData,
      });
    }
  }

  /**
   * Check for expired tests and mark them as EXPIRED
   * Can be run as a background job or on-demand
   */
  async checkExpiredTests() {
    const now = new Date();

    const expiredTests = await this.prisma.assessment.findMany({
      where: {
        testStatus: AssessmentStatus.DAY1_COMPLETED,
        expiresAt: {
          lt: now,
        },
      },
    });

    if (expiredTests.length > 0) {
      await this.prisma.assessment.updateMany({
        where: {
          id: { in: expiredTests.map((t) => t.id) },
        },
        data: {
          testStatus: AssessmentStatus.EXPIRED,
        },
      });
    }

    return { expiredCount: expiredTests.length };
  }

  /**
   * Get assessment status for all athletes of a coach
   * Used for coach dashboard to show who needs testing
   */
  async getCoachAthletesAssessmentStatus(coachId: string) {
    const MONTHLY_THRESHOLD_DAYS = 30;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - MONTHLY_THRESHOLD_DAYS);

    // Get all athletes for this coach via CoachAthleteRelationship
    const relationships = await this.prisma.coachAthleteRelationship.findMany({
      where: {
        coachId,
        status: 'ACTIVE',
      },
      select: {
        athlete: {
          select: {
            id: true,
            fullName: true,
            email: true,
            ftp: true,
            assessments: {
              where: { testStatus: AssessmentStatus.COMPLETED },
              orderBy: { day2CompletedAt: 'desc' },
              take: 1,
              select: {
                id: true,
                day2CompletedAt: true,
                estimatedFTP: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    const athletes = relationships.map((r) => r.athlete);

    return athletes.map((athlete) => {
      const latestAssessment = athlete.assessments[0] || null;
      const hasAssessment = !!latestAssessment;
      const lastTestDate = latestAssessment?.day2CompletedAt || null;
      const isOverdue =
        !latestAssessment ||
        !latestAssessment.day2CompletedAt ||
        new Date(latestAssessment.day2CompletedAt) < thirtyDaysAgo;
      const daysSinceTest = lastTestDate
        ? Math.floor(
            (Date.now() - new Date(lastTestDate).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;
      // New assessment = created in the last 24 hours
      const isNewAssessment = latestAssessment?.createdAt
        ? Date.now() - new Date(latestAssessment.createdAt).getTime() <
          24 * 60 * 60 * 1000
        : false;

      return {
        athleteId: athlete.id,
        athleteName: athlete.fullName,
        email: athlete.email,
        ftp: athlete.ftp,
        hasAssessment,
        lastTestDate,
        daysSinceTest,
        isOverdue,
        isNewAssessment,
        latestAssessment: latestAssessment
          ? {
              id: latestAssessment.id,
              day2CompletedAt: latestAssessment.day2CompletedAt,
              estimatedFTP: latestAssessment.estimatedFTP,
            }
          : null,
      };
    });
  }

  /**
   * Get athlete stats including assessment data
   * Used for the AthleteStatsPage
   */
  async getAthleteStats(athleteId: string) {
    const MONTHLY_THRESHOLD_DAYS = 30;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - MONTHLY_THRESHOLD_DAYS);

    // Get athlete with latest assessment
    let athlete = await this.prisma.user.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        fullName: true,
        email: true,
        ftp: true,
        maxHR: true,
        heightCm: true,
        weightKg: true,
        assessments: {
          where: { testStatus: AssessmentStatus.COMPLETED },
          orderBy: { day2CompletedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            day2CompletedAt: true,
            estimatedFTP: true,
            sprint5secPeakPower: true,
            climb12minAvgPower: true,
            effort5minAvgPower: true,
            createdAt: true,
          },
        },
      },
    });

    if (!athlete) {
      return null;
    }

    const latestAssessment = athlete.assessments[0] || null;
    const previousAssessment = athlete.assessments[1] || null;

    // Calculate FTP progress (current vs previous)
    let ftpProgress = 0;
    if (latestAssessment?.estimatedFTP && previousAssessment?.estimatedFTP) {
      ftpProgress = latestAssessment.estimatedFTP - previousAssessment.estimatedFTP;
    }

    // Calculate W/kg if we have weight
    const wattsPerKg =
      athlete.weightKg && latestAssessment?.estimatedFTP
        ? latestAssessment.estimatedFTP / athlete.weightKg
        : null;

    const isOverdue =
      !latestAssessment ||
      !latestAssessment.day2CompletedAt ||
      new Date(latestAssessment.day2CompletedAt) < thirtyDaysAgo;
    const daysSinceTest = latestAssessment?.day2CompletedAt
      ? Math.floor(
          (Date.now() - new Date(latestAssessment.day2CompletedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      athlete: {
        id: athlete.id,
        fullName: athlete.fullName,
        email: athlete.email,
        ftp: athlete.ftp,
        heightCm: athlete.heightCm,
        weightKg: athlete.weightKg,
      },
      assessment: {
        hasAssessment: !!latestAssessment,
        isOverdue,
        daysSinceTest,
        latestAssessment,
        previousAssessment,
        ftpProgress,
        wattsPerKg: wattsPerKg ? parseFloat(wattsPerKg.toFixed(2)) : null,
        assessmentHistory: athlete.assessments.map((a) => ({
          id: a.id,
          testDate: a.day2CompletedAt, // Use day2CompletedAt as the test completion date
          estimatedFTP: a.estimatedFTP,
        })),
      },
    };
  }
}
