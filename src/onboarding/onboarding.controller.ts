import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { OnboardingService } from './onboarding.service';
import {
  Sex,
  AthleteCategory,
  TerrainType,
  DisciplineType,
  DisciplineSubType,
  ActivityType,
} from '@prisma/client';

@Public()
@Controller('api/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * Get onboarding status for an athlete
   */
  @Get(':athleteId/status')
  getStatus(@Param('athleteId') athleteId: string) {
    return this.onboardingService.getStatus(athleteId);
  }

  /**
   * Get full athlete profile (for coach view)
   */
  @Get(':athleteId/profile')
  getProfile(@Param('athleteId') athleteId: string) {
    return this.onboardingService.getProfile(athleteId);
  }

  /**
   * Save Step 1: Personal Info
   */
  @Post(':athleteId/step/personal')
  savePersonalInfo(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      fullName: string;
      birthday: string;
      sex: Sex;
      lastMenstrualDate?: string;
    },
  ) {
    return this.onboardingService.savePersonalInfo(athleteId, {
      fullName: data.fullName,
      birthday: new Date(data.birthday),
      sex: data.sex,
      lastMenstrualDate: data.lastMenstrualDate
        ? new Date(data.lastMenstrualDate)
        : undefined,
    });
  }

  /**
   * Save Step 2: Physical Data
   */
  @Post(':athleteId/step/physical')
  savePhysicalData(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      heightCm: number;
      weightKg: number;
    },
  ) {
    return this.onboardingService.savePhysicalData(athleteId, data);
  }

  /**
   * Save Step 3: Category
   */
  @Post(':athleteId/step/category')
  saveCategory(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      athleteCategory: AthleteCategory;
    },
  ) {
    return this.onboardingService.saveCategory(athleteId, data);
  }

  /**
   * Save Step 4: Disciplines
   */
  @Post(':athleteId/step/disciplines')
  saveDisciplines(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      disciplines: Array<{
        discipline: DisciplineType;
        subType: DisciplineSubType;
      }>;
    },
  ) {
    return this.onboardingService.saveDisciplines(athleteId, data);
  }

  /**
   * Save Step 5: Terrain
   */
  @Post(':athleteId/step/terrain')
  saveTerrain(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      terrain: TerrainType;
    },
  ) {
    return this.onboardingService.saveTerrain(athleteId, data);
  }

  /**
   * Save Step 6: Activity Types
   */
  @Post(':athleteId/step/activities')
  saveActivityTypes(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      activityTypes: ActivityType[];
    },
  ) {
    return this.onboardingService.saveActivityTypes(athleteId, data);
  }

  /**
   * Save Equipment (inline step)
   */
  @Post(':athleteId/step/equipment')
  saveEquipment(
    @Param('athleteId') athleteId: string,
    @Body()
    data: {
      hasPowerMeter: boolean;
      hasHRMonitor: boolean;
    },
  ) {
    return this.onboardingService.saveEquipment(athleteId, data);
  }

  /**
   * Mark onboarding as complete
   */
  @Post(':athleteId/complete')
  complete(@Param('athleteId') athleteId: string) {
    return this.onboardingService.complete(athleteId);
  }

  /**
   * Update current step (for navigation)
   */
  @Put(':athleteId/step')
  updateStep(
    @Param('athleteId') athleteId: string,
    @Body() data: { step: number },
  ) {
    return this.onboardingService.updateStep(athleteId, data.step);
  }
}
