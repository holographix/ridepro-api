/**
 * InviteCodesService - Coach invitation code management
 *
 * This service handles all operations related to coach invite codes:
 * - Generating unique invite codes for coaches
 * - Validating codes for athletes
 * - Redeeming codes to create coach-athlete relationships
 * - Managing code lifecycle (expiration, usage limits)
 *
 * Invite codes provide an easy onboarding flow:
 * 1. Coach generates a code (e.g., "COACH-ABC123")
 * 2. Coach shares code with potential athletes
 * 3. Athlete enters code to connect with coach
 * 4. System creates a PENDING relationship for approval
 *
 * @module invite-codes
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RelationshipsService } from '../relationships/relationships.service';
import { CreateInviteCodeDto, RedeemInviteCodeDto } from './dto';

/**
 * Service for managing coach invitation codes
 *
 * @class InviteCodesService
 * @description Provides methods for creating, validating, and redeeming
 * invite codes that allow athletes to easily connect with coaches.
 */
@Injectable()
export class InviteCodesService {
  constructor(
    private prisma: PrismaService,
    private relationshipsService: RelationshipsService,
  ) {}

  /**
   * Generates a unique, readable invite code
   *
   * @returns A unique code in format "COACH-XXXXXX"
   * @private
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding ambiguous chars
    let code = 'COACH-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Creates a new invite code for a coach
   *
   * @param dto - The invite code creation data
   * @returns Promise containing the newly created invite code
   * @throws NotFoundException if coach not found
   */
  async create(dto: CreateInviteCodeDto) {
    // Verify coach exists
    const coach = await this.prisma.user.findUnique({
      where: { id: dto.coachId },
    });

    if (!coach) {
      throw new NotFoundException(`Coach with ID ${dto.coachId} not found`);
    }

    // Generate a unique code (retry if collision)
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = this.generateCode();
      const existing = await this.prisma.coachInviteCode.findUnique({
        where: { code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new ConflictException('Failed to generate unique code');
    }

    // Create the invite code
    return this.prisma.coachInviteCode.create({
      data: {
        code,
        coachId: dto.coachId,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Retrieves an invite code by its ID
   *
   * @param id - The UUID of the invite code
   * @returns Promise containing the invite code with coach details
   * @throws NotFoundException if code not found
   */
  async findOne(id: string) {
    const inviteCode = await this.prisma.coachInviteCode.findUnique({
      where: { id },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!inviteCode) {
      throw new NotFoundException(`Invite code with ID ${id} not found`);
    }

    return inviteCode;
  }

  /**
   * Retrieves an invite code by its code string
   *
   * @param code - The code string (e.g., "COACH-ABC123")
   * @returns Promise containing the invite code with coach details
   * @throws NotFoundException if code not found
   */
  async findByCode(code: string) {
    const inviteCode = await this.prisma.coachInviteCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!inviteCode) {
      throw new NotFoundException(`Invite code "${code}" not found`);
    }

    return inviteCode;
  }

  /**
   * Validates an invite code without redeeming it
   *
   * @param code - The code string to validate
   * @returns Promise containing validation result with coach info if valid
   */
  async validate(code: string) {
    try {
      const inviteCode = await this.findByCode(code);

      // Check if active
      if (!inviteCode.isActive) {
        return {
          valid: false,
          error: 'Code has been deactivated',
        };
      }

      // Check expiration
      if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
        return {
          valid: false,
          error: 'Code has expired',
        };
      }

      // Check usage limit
      if (
        inviteCode.maxUses !== null &&
        inviteCode.usedCount >= inviteCode.maxUses
      ) {
        return {
          valid: false,
          error: 'Code has reached maximum uses',
        };
      }

      return {
        valid: true,
        coach: inviteCode.coach,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          valid: false,
          error: 'Code not found',
        };
      }
      throw error;
    }
  }

  /**
   * Redeems an invite code to create a coach-athlete relationship
   *
   * @param dto - The redemption data with code and athlete ID
   * @returns Promise containing the created relationship
   * @throws BadRequestException if code is invalid
   * @throws ConflictException if relationship already exists
   */
  async redeem(dto: RedeemInviteCodeDto) {
    const validation = await this.validate(dto.code);

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const inviteCode = await this.findByCode(dto.code);

    // Check if athlete is trying to connect to themselves
    if (inviteCode.coachId === dto.athleteId) {
      throw new BadRequestException('Cannot use your own invite code');
    }

    // Create the relationship using RelationshipsService
    const relationship = await this.relationshipsService.create({
      coachId: inviteCode.coachId,
      athleteId: dto.athleteId,
    });

    // Increment usage count
    await this.prisma.coachInviteCode.update({
      where: { id: inviteCode.id },
      data: { usedCount: { increment: 1 } },
    });

    return relationship;
  }

  /**
   * Gets all invite codes for a coach
   *
   * @param coachId - The UUID of the coach
   * @param activeOnly - If true, only returns active, non-expired codes
   * @returns Promise containing array of invite codes
   */
  async getCodesForCoach(coachId: string, activeOnly = false) {
    const whereClause: {
      coachId: string;
      isActive?: boolean;
      OR?: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }>;
    } = { coachId };

    if (activeOnly) {
      whereClause.isActive = true;
      whereClause.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    return this.prisma.coachInviteCode.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deactivates an invite code
   *
   * @param id - The UUID of the invite code to deactivate
   * @returns Promise containing the updated invite code
   * @throws NotFoundException if code not found
   */
  async deactivate(id: string) {
    // Verify exists
    await this.findOne(id);

    return this.prisma.coachInviteCode.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Reactivates an invite code
   *
   * @param id - The UUID of the invite code to reactivate
   * @returns Promise containing the updated invite code
   * @throws NotFoundException if code not found
   */
  async reactivate(id: string) {
    // Verify exists
    await this.findOne(id);

    return this.prisma.coachInviteCode.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Deletes an invite code permanently
   *
   * @param id - The UUID of the invite code to delete
   * @returns Promise containing the deleted invite code
   * @throws NotFoundException if code not found
   */
  async delete(id: string) {
    // Verify exists
    await this.findOne(id);

    return this.prisma.coachInviteCode.delete({
      where: { id },
    });
  }
}
