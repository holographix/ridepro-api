import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AthleteSettingsService } from './athlete-settings.service';

@Public()
@Controller('api/athlete-settings')
export class AthleteSettingsController {
  constructor(private athleteSettingsService: AthleteSettingsService) {}

  @Get(':athleteId')
  async getAthleteSettings(@Param('athleteId') athleteId: string) {
    return this.athleteSettingsService.getAthleteSettings(athleteId);
  }
}
