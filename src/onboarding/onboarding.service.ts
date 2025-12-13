import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Sex,
  AthleteCategory,
  TerrainType,
  DisciplineType,
  DisciplineSubType,
  ActivityType,
} from '@prisma/client';

// DTO interfaces for step data
export interface PersonalInfoData {
  fullName: string;
  birthday: Date;
  sex: Sex;
  lastMenstrualDate?: Date;
}

export interface PhysicalData {
  heightCm: number;
  weightKg: number;
}

export interface CategoryData {
  athleteCategory: AthleteCategory;
}

export interface DisciplineData {
  disciplines: Array<{
    discipline: DisciplineType;
    subType: DisciplineSubType;
  }>;
}

export interface TerrainData {
  terrain: TerrainType;
}

export interface ActivityTypesData {
  activityTypes: ActivityType[];
}

export interface EquipmentData {
  hasPowerMeter: boolean;
  hasHRMonitor: boolean;
}

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get onboarding status and current step for an athlete
   */
  async getStatus(athleteId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        onboardingCompleted: true,
        onboardingStep: true,
        fullName: true,
        birthday: true,
        sex: true,
        heightCm: true,
        weightKg: true,
        athleteCategory: true,
        terrain: true,
        hasPowerMeter: true,
        hasHRMonitor: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      athleteId: user.id,
      completed: user.onboardingCompleted,
      currentStep: user.onboardingStep ?? 1,
      hasPersonalInfo: !!(user.fullName && user.birthday && user.sex),
      hasPhysicalData: !!(user.heightCm && user.weightKg),
      hasCategory: !!user.athleteCategory,
      hasTerrain: !!user.terrain,
    };
  }

  /**
   * Get full athlete profile (for coach view)
   */
  async getProfile(athleteId: string) {
    return this.prisma.user.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        ftp: true,
        // Personal info
        birthday: true,
        sex: true,
        lastMenstrualDate: true,
        // Physical
        heightCm: true,
        weightKg: true,
        // Profile
        athleteCategory: true,
        terrain: true,
        // Equipment
        hasPowerMeter: true,
        hasHRMonitor: true,
        // Status
        onboardingCompleted: true,
        onboardingStep: true,
        // Relations
        disciplines: {
          select: {
            id: true,
            discipline: true,
            subType: true,
          },
        },
        activityTypes: {
          select: {
            id: true,
            activityType: true,
          },
        },
        availability: {
          select: {
            dayIndex: true,
            available: true,
            maxHours: true,
            timeSlots: true,
          },
        },
      },
    });
  }

  /**
   * Save personal info (Step 1)
   */
  async savePersonalInfo(athleteId: string, data: PersonalInfoData) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: {
        fullName: data.fullName,
        birthday: data.birthday,
        sex: data.sex,
        lastMenstrualDate: data.lastMenstrualDate,
        onboardingStep: 2,
      },
    });
  }

  /**
   * Save physical data (Step 2)
   */
  async savePhysicalData(athleteId: string, data: PhysicalData) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: {
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        onboardingStep: 3,
      },
    });
  }

  /**
   * Save category (Step 3)
   */
  async saveCategory(athleteId: string, data: CategoryData) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: {
        athleteCategory: data.athleteCategory,
        onboardingStep: 4,
      },
    });
  }

  /**
   * Save disciplines (Step 4)
   */
  async saveDisciplines(athleteId: string, data: DisciplineData) {
    // Delete existing disciplines
    await this.prisma.athleteDiscipline.deleteMany({
      where: { athleteId },
    });

    // Create new disciplines
    if (data.disciplines.length > 0) {
      await this.prisma.athleteDiscipline.createMany({
        data: data.disciplines.map((d) => ({
          athleteId,
          discipline: d.discipline,
          subType: d.subType,
        })),
      });
    }

    // Update step
    await this.prisma.user.update({
      where: { id: athleteId },
      data: { onboardingStep: 5 },
    });

    return this.prisma.athleteDiscipline.findMany({
      where: { athleteId },
    });
  }

  /**
   * Save terrain preference (Step 5)
   */
  async saveTerrain(athleteId: string, data: TerrainData) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: {
        terrain: data.terrain,
        onboardingStep: 6,
      },
    });
  }

  /**
   * Save activity types (Step 6)
   * Note: Step 6 in the wizard is availability, which uses existing availability endpoints
   * This step (activity types) is step 7
   */
  async saveActivityTypes(athleteId: string, data: ActivityTypesData) {
    // Delete existing activity types
    await this.prisma.athleteActivityType.deleteMany({
      where: { athleteId },
    });

    // Create new activity types
    if (data.activityTypes.length > 0) {
      await this.prisma.athleteActivityType.createMany({
        data: data.activityTypes.map((activityType) => ({
          athleteId,
          activityType,
        })),
      });
    }

    // Update step
    await this.prisma.user.update({
      where: { id: athleteId },
      data: { onboardingStep: 7 },
    });

    return this.prisma.athleteActivityType.findMany({
      where: { athleteId },
    });
  }

  /**
   * Save equipment info (Step 7 - inline with activities)
   */
  async saveEquipment(athleteId: string, data: EquipmentData) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: {
        hasPowerMeter: data.hasPowerMeter,
        hasHRMonitor: data.hasHRMonitor,
      },
    });
  }

  /**
   * Mark onboarding as complete
   */
  async complete(athleteId: string) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: {
        onboardingCompleted: true,
        onboardingStep: null,
      },
    });
  }

  /**
   * Update current step (for navigation)
   */
  async updateStep(athleteId: string, step: number) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: { onboardingStep: step },
    });
  }
}
