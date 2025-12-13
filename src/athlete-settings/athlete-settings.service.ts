import { Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import { GoalsService } from '../goals/goals.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AthleteSettingsService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private goalsService: GoalsService,
  ) {}

  async getAthleteSettings(athleteId: string) {
    // Verify athlete exists
    const athlete = await this.prisma.user.findUnique({
      where: { id: athleteId },
      select: { id: true, fullName: true },
    });

    if (!athlete) {
      throw new NotFoundException(`Athlete with ID ${athleteId} not found`);
    }

    // Fetch availability and goals in parallel
    const [availability, goals] = await Promise.all([
      this.availabilityService.getAthleteAvailability(athleteId),
      this.goalsService.getAthleteGoals(athleteId),
    ]);

    return {
      id: athleteId,
      availability,
      goals,
    };
  }
}
