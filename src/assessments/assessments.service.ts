import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentType } from '@prisma/client';

// DTO interfaces for assessment data
export interface Sprint12MinData {
  testDate: Date;
  sprintPeakPower?: number;   // Peak power during 15" sprint (W)
  sprintMaxHR?: number;       // Max HR during sprint (bpm)
  climb12AvgPower?: number;   // Average power during 12' climb (W)
  climb12MaxHR?: number;      // Max HR during 12' climb (bpm)
  notes?: string;
}

export interface Power125MinData {
  testDate: Date;
  effort1minAvgPower?: number;  // Average power during 1' effort (W)
  effort1minMaxHR?: number;     // Max HR during 1' effort (bpm)
  effort2minAvgPower?: number;  // Average power during 2' effort (W)
  effort2minMaxHR?: number;     // Max HR during 2' effort (bpm)
  effort5minAvgPower?: number;  // Average power during 5' effort (W)
  effort5minMaxHR?: number;     // Max HR during 5' effort (bpm)
  notes?: string;
}

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all assessments for an athlete
   */
  async getAthleteAssessments(athleteId: string) {
    return this.prisma.assessment.findMany({
      where: { athleteId },
      orderBy: { testDate: 'desc' },
    });
  }

  /**
   * Get latest assessment for an athlete (optionally by type)
   */
  async getLatestAssessment(athleteId: string, testType?: AssessmentType) {
    return this.prisma.assessment.findFirst({
      where: {
        athleteId,
        ...(testType && { testType }),
      },
      orderBy: { testDate: 'desc' },
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
   * Create Sprint + 12min protocol assessment
   */
  async createSprint12MinAssessment(athleteId: string, data: Sprint12MinData) {
    // Calculate estimated FTP from 12' climb power (approximately 95% of 12' avg power)
    const estimatedFTP = data.climb12AvgPower
      ? Math.round(data.climb12AvgPower * 0.95)
      : undefined;

    return this.prisma.assessment.create({
      data: {
        athleteId,
        testType: 'SPRINT_12MIN',
        testDate: data.testDate,
        sprintPeakPower: data.sprintPeakPower,
        sprintMaxHR: data.sprintMaxHR,
        climb12AvgPower: data.climb12AvgPower,
        climb12MaxHR: data.climb12MaxHR,
        estimatedFTP,
        notes: data.notes,
      },
    });
  }

  /**
   * Create 1/2/5min protocol assessment
   */
  async createPower125MinAssessment(athleteId: string, data: Power125MinData) {
    // Calculate estimated FTP from 5' avg power (approximately 90% of 5' avg power)
    const estimatedFTP = data.effort5minAvgPower
      ? Math.round(data.effort5minAvgPower * 0.9)
      : undefined;

    return this.prisma.assessment.create({
      data: {
        athleteId,
        testType: 'POWER_1_2_5MIN',
        testDate: data.testDate,
        effort1minAvgPower: data.effort1minAvgPower,
        effort1minMaxHR: data.effort1minMaxHR,
        effort2minAvgPower: data.effort2minAvgPower,
        effort2minMaxHR: data.effort2minMaxHR,
        effort5minAvgPower: data.effort5minAvgPower,
        effort5minMaxHR: data.effort5minMaxHR,
        estimatedFTP,
        notes: data.notes,
      },
    });
  }

  /**
   * Update an assessment
   */
  async updateAssessment(
    id: string,
    data: Partial<Sprint12MinData & Power125MinData>,
  ) {
    const existing = await this.prisma.assessment.findUnique({
      where: { id },
    });

    if (!existing) {
      return null;
    }

    // Recalculate FTP based on test type
    let estimatedFTP: number | undefined;
    if (existing.testType === 'SPRINT_12MIN') {
      const climb12AvgPower = data.climb12AvgPower ?? existing.climb12AvgPower;
      estimatedFTP = climb12AvgPower
        ? Math.round(climb12AvgPower * 0.95)
        : undefined;
    } else {
      const effort5minAvgPower =
        data.effort5minAvgPower ?? existing.effort5minAvgPower;
      estimatedFTP = effort5minAvgPower
        ? Math.round(effort5minAvgPower * 0.9)
        : undefined;
    }

    return this.prisma.assessment.update({
      where: { id },
      data: {
        testDate: data.testDate,
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
        estimatedFTP,
        notes: data.notes,
      },
    });
  }

  /**
   * Delete an assessment
   */
  async deleteAssessment(id: string) {
    return this.prisma.assessment.delete({
      where: { id },
    });
  }

  /**
   * Update athlete's FTP based on latest assessment
   */
  async updateAthleteFTP(athleteId: string) {
    const latestAssessment = await this.getLatestAssessment(athleteId);

    if (latestAssessment?.estimatedFTP) {
      await this.prisma.user.update({
        where: { id: athleteId },
        data: { ftp: latestAssessment.estimatedFTP },
      });
    }

    return latestAssessment;
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
              orderBy: { testDate: 'desc' },
              take: 1,
              select: {
                id: true,
                testType: true,
                testDate: true,
                estimatedFTP: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    const athletes = relationships.map(r => r.athlete);

    return athletes.map((athlete) => {
      const latestAssessment = athlete.assessments[0] || null;
      const hasAssessment = !!latestAssessment;
      const lastTestDate = latestAssessment?.testDate || null;
      const isOverdue = !latestAssessment || new Date(latestAssessment.testDate) < thirtyDaysAgo;
      const daysSinceTest = lastTestDate
        ? Math.floor((Date.now() - new Date(lastTestDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      // New assessment = created in the last 24 hours
      const isNewAssessment = latestAssessment?.createdAt
        ? Date.now() - new Date(latestAssessment.createdAt).getTime() < 24 * 60 * 60 * 1000
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
              testType: latestAssessment.testType,
              testDate: latestAssessment.testDate,
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
    const athlete = await this.prisma.user.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        fullName: true,
        email: true,
        ftp: true,
        heightCm: true,
        weightKg: true,
        assessments: {
          orderBy: { testDate: 'desc' },
          take: 5,
          select: {
            id: true,
            testType: true,
            testDate: true,
            estimatedFTP: true,
            sprintPeakPower: true,
            climb12AvgPower: true,
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
    const wattsPerKg = athlete.weightKg && latestAssessment?.estimatedFTP
      ? latestAssessment.estimatedFTP / athlete.weightKg
      : null;

    const isOverdue = !latestAssessment || new Date(latestAssessment.testDate) < thirtyDaysAgo;
    const daysSinceTest = latestAssessment?.testDate
      ? Math.floor((Date.now() - new Date(latestAssessment.testDate).getTime()) / (1000 * 60 * 60 * 24))
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
        assessmentHistory: athlete.assessments,
      },
    };
  }
}
