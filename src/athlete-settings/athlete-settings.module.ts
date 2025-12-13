import { Module } from '@nestjs/common';
import { AthleteSettingsController } from './athlete-settings.controller';
import { AthleteSettingsService } from './athlete-settings.service';
import { AvailabilityModule } from '../availability/availability.module';
import { GoalsModule } from '../goals/goals.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AvailabilityModule, GoalsModule],
  controllers: [AthleteSettingsController],
  providers: [AthleteSettingsService],
  exports: [AthleteSettingsService],
})
export class AthleteSettingsModule {}
