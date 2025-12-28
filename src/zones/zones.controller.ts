import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ClerkGuard } from '../auth/clerk.guard';
import { ZonesService, PowerZonesInput, HRZonesInput } from './zones.service';

interface UpdatePowerZonesDto {
  zoneSystem?: 'COGGAN' | 'POLARIZED' | 'CUSTOM';
  zone1Max?: number;
  zone2Max?: number;
  zone3Max?: number;
  zone4Max?: number;
  zone5Max?: number;
  zone6Max?: number;
}

interface UpdateHRZonesDto {
  zoneSystem?: 'STANDARD' | 'KARVONEN' | 'CUSTOM';
  zone1Max?: number;
  zone2Max?: number;
  zone3Max?: number;
  zone4Max?: number;
  zone5Max?: number;
}

interface UpdateAthleteZoneDataDto {
  ftp?: number;
  maxHR?: number;
  restingHR?: number;
}

interface CalculatePowerZonesDto {
  ftp: number;
  zoneConfig?: PowerZonesInput;
}

interface CalculateHRZonesDto {
  maxHR: number;
  restingHR?: number;
  method?: 'STANDARD' | 'KARVONEN';
  zoneConfig?: HRZonesInput;
}

@Controller('api/zones')
@UseGuards(ClerkGuard)
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  // ============================================
  // POWER ZONES
  // ============================================

  /**
   * Get power zones configuration for an athlete
   */
  @Get(':athleteId/power')
  async getPowerZones(@Param('athleteId') athleteId: string) {
    const zones = await this.zonesService.getPowerZones(athleteId);
    return { success: true, zones };
  }

  /**
   * Update power zones for an athlete
   */
  @Put(':athleteId/power')
  async updatePowerZones(
    @Param('athleteId') athleteId: string,
    @Body() dto: UpdatePowerZonesDto,
  ) {
    const zones = await this.zonesService.upsertPowerZones(athleteId, dto);
    return { success: true, zones };
  }

  // ============================================
  // HR ZONES
  // ============================================

  /**
   * Get HR zones configuration for an athlete
   */
  @Get(':athleteId/hr')
  async getHRZones(@Param('athleteId') athleteId: string) {
    const zones = await this.zonesService.getHRZones(athleteId);
    return { success: true, zones };
  }

  /**
   * Update HR zones for an athlete
   */
  @Put(':athleteId/hr')
  async updateHRZones(
    @Param('athleteId') athleteId: string,
    @Body() dto: UpdateHRZonesDto,
  ) {
    const zones = await this.zonesService.upsertHRZones(athleteId, dto);
    return { success: true, zones };
  }

  // ============================================
  // COMBINED ZONES
  // ============================================

  /**
   * Get all zones (power + HR) with calculated values based on FTP/maxHR
   */
  @Get(':athleteId')
  async getAthleteZones(@Param('athleteId') athleteId: string) {
    const data = await this.zonesService.getAthleteZonesWithCalculations(
      athleteId,
    );
    if (!data) {
      return { success: false, message: 'Athlete not found' };
    }
    return { success: true, data };
  }

  /**
   * Update athlete's FTP, maxHR, or restingHR
   */
  @Put(':athleteId/data')
  async updateAthleteZoneData(
    @Param('athleteId') athleteId: string,
    @Body() dto: UpdateAthleteZoneDataDto,
  ) {
    const athlete = await this.zonesService.updateAthleteZoneData(
      athleteId,
      dto,
    );
    return { success: true, athlete };
  }

  // ============================================
  // CALCULATION ENDPOINTS
  // ============================================

  /**
   * Calculate power zones from FTP (without saving)
   */
  @Post('calculate/power')
  calculatePowerZones(@Body() dto: CalculatePowerZonesDto) {
    const zones = this.zonesService.calculatePowerZones(
      dto.ftp,
      dto.zoneConfig,
    );
    return { success: true, zones };
  }

  /**
   * Calculate HR zones from maxHR (without saving)
   */
  @Post('calculate/hr')
  calculateHRZones(@Body() dto: CalculateHRZonesDto) {
    let zones;
    if (dto.method === 'KARVONEN' && dto.restingHR) {
      zones = this.zonesService.calculateHRZonesKarvonen(
        dto.maxHR,
        dto.restingHR,
        dto.zoneConfig,
      );
    } else {
      zones = this.zonesService.calculateHRZonesStandard(
        dto.maxHR,
        dto.zoneConfig,
      );
    }
    return { success: true, zones };
  }
}
