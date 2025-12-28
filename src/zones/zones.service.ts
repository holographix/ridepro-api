import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ============================================
// ZONE DEFINITIONS (Coach's Formula from "Calcolo zone.xlsx")
// ============================================

// Coach's Power Zones (6 zones, % of FTP)
// Based on FC Soglia = 93% of Max HR
// Power zones use FTP as reference
export const COACH_POWER_ZONES = {
  z1: { name: 'Recupero Attivo', min: 0, max: 55 },      // Active Recovery
  z2: { name: 'Resistenza', min: 55, max: 75 },          // Endurance
  z3: { name: 'Tempo (Medio)', min: 75, max: 90 },       // Tempo
  z4: { name: 'Soglia Lattacida', min: 90, max: 105 },   // Lactate Threshold
  z5: { name: 'VO2MAX', min: 105, max: 120 },            // VO2Max
  z6: { name: 'Capacità Anaerobica', min: 120, max: 150 }, // Anaerobic Capacity
};

// Coach's HR Zones (6 zones, % of FC Soglia where FC Soglia = 93% of Max HR)
export const COACH_HR_ZONES = {
  z1: { name: 'Recupero Attivo', min: 0, max: 68 },      // Active Recovery: <68% FC Soglia
  z2: { name: 'Resistenza', min: 68, max: 83 },          // Endurance: 68-83% FC Soglia
  z3: { name: 'Tempo (Medio)', min: 83, max: 94 },       // Tempo: 83-94% FC Soglia
  z4: { name: 'Soglia Lattacida', min: 94, max: 105 },   // Threshold: 94-105% FC Soglia
  z5: { name: 'VO2MAX', min: 105, max: 120 },            // VO2Max: 105-120% FC Soglia
  z6: { name: 'Capacità Anaerobica', min: null, max: null }, // No HR zones for anaerobic
};

// Legacy aliases for backwards compatibility
export const COGGAN_ZONES = COACH_POWER_ZONES;
export const STANDARD_HR_ZONES = COACH_HR_ZONES;

// DTO interfaces
export interface PowerZonesInput {
  zoneSystem?: 'COGGAN' | 'POLARIZED' | 'CUSTOM';
  zone1Max?: number;
  zone2Max?: number;
  zone3Max?: number;
  zone4Max?: number;
  zone5Max?: number;
  zone6Max?: number;
}

export interface HRZonesInput {
  zoneSystem?: 'STANDARD' | 'KARVONEN' | 'CUSTOM';
  zone1Max?: number;
  zone2Max?: number;
  zone3Max?: number;
  zone4Max?: number;
  zone5Max?: number;
}

export interface CalculatedPowerZone {
  zone: number;
  name: string;
  minWatts: number;
  maxWatts: number | null;
  minPercent: number;
  maxPercent: number | null;
}

export interface CalculatedHRZone {
  zone: number;
  name: string;
  minBPM: number;
  maxBPM: number | null;
  minPercent: number;
  maxPercent: number | null;
}

@Injectable()
export class ZonesService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // POWER ZONES
  // ============================================

  /**
   * Get power zones for an athlete
   */
  async getPowerZones(athleteId: string) {
    const zones = await this.prisma.powerZone.findUnique({
      where: { athleteId },
    });

    if (!zones) {
      // Return default Coggan zones
      return {
        athleteId,
        zoneSystem: 'COGGAN',
        zone1Max: 55,
        zone2Max: 75,
        zone3Max: 90,
        zone4Max: 105,
        zone5Max: 120,
        zone6Max: 150,
      };
    }

    return zones;
  }

  /**
   * Create or update power zones for an athlete
   */
  async upsertPowerZones(athleteId: string, data: PowerZonesInput) {
    return this.prisma.powerZone.upsert({
      where: { athleteId },
      create: {
        athleteId,
        zoneSystem: data.zoneSystem || 'COGGAN',
        zone1Max: data.zone1Max ?? 55,
        zone2Max: data.zone2Max ?? 75,
        zone3Max: data.zone3Max ?? 90,
        zone4Max: data.zone4Max ?? 105,
        zone5Max: data.zone5Max ?? 120,
        zone6Max: data.zone6Max ?? 150,
      },
      update: {
        zoneSystem: data.zoneSystem,
        zone1Max: data.zone1Max,
        zone2Max: data.zone2Max,
        zone3Max: data.zone3Max,
        zone4Max: data.zone4Max,
        zone5Max: data.zone5Max,
        zone6Max: data.zone6Max,
      },
    });
  }

  /**
   * Calculate power zones based on FTP
   * Using coach's formula from "Calcolo zone.xlsx"
   * 6 zones: Z1 Recupero, Z2 Resistenza, Z3 Tempo, Z4 Soglia, Z5 VO2Max, Z6 Anaerobica
   */
  calculatePowerZones(
    ftp: number,
    zoneConfig?: PowerZonesInput,
  ): CalculatedPowerZone[] {
    // Coach's default percentages (% of FTP)
    const zones = zoneConfig || {
      zone1Max: 55,  // Z1: 0-55%
      zone2Max: 75,  // Z2: 55-75%
      zone3Max: 90,  // Z3: 75-90%
      zone4Max: 105, // Z4: 90-105%
      zone5Max: 120, // Z5: 105-120%
      zone6Max: 150, // Z6: 120-150%
    };

    return [
      {
        zone: 1,
        name: 'Recupero Attivo',
        minWatts: 0,
        maxWatts: Math.round(ftp * (zones.zone1Max! / 100)),
        minPercent: 0,
        maxPercent: zones.zone1Max!,
      },
      {
        zone: 2,
        name: 'Resistenza',
        minWatts: Math.round(ftp * (zones.zone1Max! / 100)),
        maxWatts: Math.round(ftp * (zones.zone2Max! / 100)),
        minPercent: zones.zone1Max!,
        maxPercent: zones.zone2Max!,
      },
      {
        zone: 3,
        name: 'Tempo (Medio)',
        minWatts: Math.round(ftp * (zones.zone2Max! / 100)),
        maxWatts: Math.round(ftp * (zones.zone3Max! / 100)),
        minPercent: zones.zone2Max!,
        maxPercent: zones.zone3Max!,
      },
      {
        zone: 4,
        name: 'Soglia Lattacida',
        minWatts: Math.round(ftp * (zones.zone3Max! / 100)),
        maxWatts: Math.round(ftp * (zones.zone4Max! / 100)),
        minPercent: zones.zone3Max!,
        maxPercent: zones.zone4Max!,
      },
      {
        zone: 5,
        name: 'VO2MAX',
        minWatts: Math.round(ftp * (zones.zone4Max! / 100)),
        maxWatts: Math.round(ftp * (zones.zone5Max! / 100)),
        minPercent: zones.zone4Max!,
        maxPercent: zones.zone5Max!,
      },
      {
        zone: 6,
        name: 'Capacità Anaerobica',
        minWatts: Math.round(ftp * (zones.zone5Max! / 100)),
        maxWatts: Math.round(ftp * (zones.zone6Max! / 100)),
        minPercent: zones.zone5Max!,
        maxPercent: zones.zone6Max!,
      },
    ];
  }

  // ============================================
  // HR ZONES
  // ============================================

  /**
   * Get HR zones for an athlete
   */
  async getHRZones(athleteId: string) {
    const zones = await this.prisma.hRZone.findUnique({
      where: { athleteId },
    });

    if (!zones) {
      // Return default standard zones
      return {
        athleteId,
        zoneSystem: 'STANDARD',
        zone1Max: 60,
        zone2Max: 70,
        zone3Max: 80,
        zone4Max: 90,
        zone5Max: 100,
      };
    }

    return zones;
  }

  /**
   * Create or update HR zones for an athlete
   */
  async upsertHRZones(athleteId: string, data: HRZonesInput) {
    return this.prisma.hRZone.upsert({
      where: { athleteId },
      create: {
        athleteId,
        zoneSystem: data.zoneSystem || 'STANDARD',
        zone1Max: data.zone1Max ?? 60,
        zone2Max: data.zone2Max ?? 70,
        zone3Max: data.zone3Max ?? 80,
        zone4Max: data.zone4Max ?? 90,
        zone5Max: data.zone5Max ?? 100,
      },
      update: {
        zoneSystem: data.zoneSystem,
        zone1Max: data.zone1Max,
        zone2Max: data.zone2Max,
        zone3Max: data.zone3Max,
        zone4Max: data.zone4Max,
        zone5Max: data.zone5Max,
      },
    });
  }

  /**
   * Calculate HR zones based on max HR using coach's formula
   * FC Soglia (threshold HR) = 93% of Max HR
   * Zones are calculated as percentages of FC Soglia, not Max HR
   * 5 zones (Z6 Anaerobic has no HR zones)
   */
  calculateHRZonesStandard(
    maxHR: number,
    zoneConfig?: HRZonesInput,
  ): CalculatedHRZone[] {
    // Coach's formula: FC Soglia = 93% of Max HR
    const fcSoglia = Math.round(maxHR * 0.93);

    // Coach's default percentages (% of FC Soglia)
    const zones = zoneConfig || {
      zone1Max: 68,  // Z1: <68% FC Soglia
      zone2Max: 83,  // Z2: 68-83% FC Soglia
      zone3Max: 94,  // Z3: 83-94% FC Soglia
      zone4Max: 105, // Z4: 94-105% FC Soglia
      zone5Max: 120, // Z5: 105-120% FC Soglia
    };

    return [
      {
        zone: 1,
        name: 'Recupero Attivo',
        minBPM: 0,
        maxBPM: Math.round(fcSoglia * (zones.zone1Max! / 100)),
        minPercent: 0,
        maxPercent: zones.zone1Max!,
      },
      {
        zone: 2,
        name: 'Resistenza',
        minBPM: Math.round(fcSoglia * (zones.zone1Max! / 100)),
        maxBPM: Math.round(fcSoglia * (zones.zone2Max! / 100)),
        minPercent: zones.zone1Max!,
        maxPercent: zones.zone2Max!,
      },
      {
        zone: 3,
        name: 'Tempo (Medio)',
        minBPM: Math.round(fcSoglia * (zones.zone2Max! / 100)),
        maxBPM: Math.round(fcSoglia * (zones.zone3Max! / 100)),
        minPercent: zones.zone2Max!,
        maxPercent: zones.zone3Max!,
      },
      {
        zone: 4,
        name: 'Soglia Lattacida',
        minBPM: Math.round(fcSoglia * (zones.zone3Max! / 100)),
        maxBPM: Math.round(fcSoglia * (zones.zone4Max! / 100)),
        minPercent: zones.zone3Max!,
        maxPercent: zones.zone4Max!,
      },
      {
        zone: 5,
        name: 'VO2MAX',
        minBPM: Math.round(fcSoglia * (zones.zone4Max! / 100)),
        maxBPM: Math.round(fcSoglia * (zones.zone5Max! / 100)),
        minPercent: zones.zone4Max!,
        maxPercent: zones.zone5Max!,
      },
    ];
  }

  /**
   * Calculate HR zones using Karvonen formula (Heart Rate Reserve)
   * Target HR = ((Max HR - Resting HR) × %Intensity) + Resting HR
   */
  calculateHRZonesKarvonen(
    maxHR: number,
    restingHR: number,
    zoneConfig?: HRZonesInput,
  ): CalculatedHRZone[] {
    const zones = zoneConfig || {
      zone1Max: 60,
      zone2Max: 70,
      zone3Max: 80,
      zone4Max: 90,
      zone5Max: 100,
    };

    const hrr = maxHR - restingHR; // Heart Rate Reserve
    const karvonen = (percent: number) =>
      Math.round((hrr * (percent / 100)) + restingHR);

    const minZ1 = 50; // Start at 50% HRR

    return [
      {
        zone: 1,
        name: 'Recovery',
        minBPM: karvonen(minZ1),
        maxBPM: karvonen(zones.zone1Max!),
        minPercent: minZ1,
        maxPercent: zones.zone1Max!,
      },
      {
        zone: 2,
        name: 'Endurance',
        minBPM: karvonen(zones.zone1Max! + 1),
        maxBPM: karvonen(zones.zone2Max!),
        minPercent: zones.zone1Max! + 1,
        maxPercent: zones.zone2Max!,
      },
      {
        zone: 3,
        name: 'Tempo',
        minBPM: karvonen(zones.zone2Max! + 1),
        maxBPM: karvonen(zones.zone3Max!),
        minPercent: zones.zone2Max! + 1,
        maxPercent: zones.zone3Max!,
      },
      {
        zone: 4,
        name: 'Threshold',
        minBPM: karvonen(zones.zone3Max! + 1),
        maxBPM: karvonen(zones.zone4Max!),
        minPercent: zones.zone3Max! + 1,
        maxPercent: zones.zone4Max!,
      },
      {
        zone: 5,
        name: 'Max',
        minBPM: karvonen(zones.zone4Max! + 1),
        maxBPM: maxHR,
        minPercent: zones.zone4Max! + 1,
        maxPercent: zones.zone5Max!,
      },
    ];
  }

  // ============================================
  // COMBINED ATHLETE DATA
  // ============================================

  /**
   * Get athlete's zones with calculated values
   */
  async getAthleteZonesWithCalculations(athleteId: string) {
    // Get athlete data (FTP, maxHR, restingHR)
    const athlete = await this.prisma.user.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        fullName: true,
        ftp: true,
        maxHR: true,
        restingHR: true,
      },
    });

    if (!athlete) {
      return null;
    }

    // Get zone configurations
    const powerZoneConfig = await this.getPowerZones(athleteId);
    const hrZoneConfig = await this.getHRZones(athleteId);

    // Calculate zones if we have the necessary data
    const calculatedPowerZones = athlete.ftp
      ? this.calculatePowerZones(athlete.ftp, powerZoneConfig as PowerZonesInput)
      : null;

    let calculatedHRZones: CalculatedHRZone[] | null = null;
    if (athlete.maxHR) {
      if (hrZoneConfig.zoneSystem === 'KARVONEN' && athlete.restingHR) {
        calculatedHRZones = this.calculateHRZonesKarvonen(
          athlete.maxHR,
          athlete.restingHR,
          hrZoneConfig as HRZonesInput,
        );
      } else {
        calculatedHRZones = this.calculateHRZonesStandard(
          athlete.maxHR,
          hrZoneConfig as HRZonesInput,
        );
      }
    }

    return {
      athlete: {
        id: athlete.id,
        fullName: athlete.fullName,
        ftp: athlete.ftp,
        maxHR: athlete.maxHR,
        restingHR: athlete.restingHR,
      },
      power: {
        config: powerZoneConfig,
        calculatedZones: calculatedPowerZones,
      },
      hr: {
        config: hrZoneConfig,
        calculatedZones: calculatedHRZones,
      },
    };
  }

  /**
   * Update athlete's FTP and maxHR
   */
  async updateAthleteZoneData(
    athleteId: string,
    data: { ftp?: number; maxHR?: number; restingHR?: number },
  ) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: {
        ftp: data.ftp,
        maxHR: data.maxHR,
        restingHR: data.restingHR,
      },
      select: {
        id: true,
        ftp: true,
        maxHR: true,
        restingHR: true,
      },
    });
  }
}
