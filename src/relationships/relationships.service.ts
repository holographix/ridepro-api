/**
 * RelationshipsService - Coach-Athlete relationship management
 *
 * This service handles all operations related to coach-athlete relationships:
 * - Creating new coaching relationships (invitations)
 * - Accepting/declining relationship requests
 * - Pausing or ending relationships
 * - Querying relationships for coaches and athletes
 *
 * Key concept: Users can be both coaches AND athletes simultaneously.
 * The many-to-many relationship model allows flexible coaching structures.
 *
 * @module relationships
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RelationshipStatus } from '@prisma/client';
import { CreateRelationshipDto, UpdateRelationshipDto } from './dto';

/**
 * Service for managing coach-athlete relationships
 *
 * @class RelationshipsService
 * @description Provides methods for creating, updating, and querying
 * coach-athlete relationships with full support for the many-to-many model.
 */
@Injectable()
export class RelationshipsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new coach-athlete relationship
   *
   * @param dto - The relationship creation data
   * @returns Promise containing the newly created relationship
   * @throws ConflictException if relationship already exists
   * @throws BadRequestException if coach and athlete are the same user
   * @throws NotFoundException if coach or athlete user not found
   */
  async create(dto: CreateRelationshipDto) {
    // Validate that coach and athlete are different users
    if (dto.coachId === dto.athleteId) {
      throw new BadRequestException('A user cannot be their own coach');
    }

    // Check if both users exist
    const [coach, athlete] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.coachId } }),
      this.prisma.user.findUnique({ where: { id: dto.athleteId } }),
    ]);

    if (!coach) {
      throw new NotFoundException(`Coach with ID ${dto.coachId} not found`);
    }

    if (!athlete) {
      throw new NotFoundException(`Athlete with ID ${dto.athleteId} not found`);
    }

    // Check if relationship already exists (any status)
    const existing = await this.prisma.coachAthleteRelationship.findUnique({
      where: {
        coachId_athleteId: {
          coachId: dto.coachId,
          athleteId: dto.athleteId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'A relationship between these users already exists',
      );
    }

    // Create the relationship in PENDING status
    return this.prisma.coachAthleteRelationship.create({
      data: {
        coachId: dto.coachId,
        athleteId: dto.athleteId,
        notes: dto.notes,
        status: 'PENDING',
      },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
        athlete: {
          select: { id: true, fullName: true, email: true, ftp: true },
        },
      },
    });
  }

  /**
   * Retrieves a relationship by its ID
   *
   * @param id - The UUID of the relationship
   * @returns Promise containing the relationship with coach and athlete details
   * @throws NotFoundException if relationship not found
   */
  async findOne(id: string) {
    const relationship = await this.prisma.coachAthleteRelationship.findUnique({
      where: { id },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
        athlete: {
          select: { id: true, fullName: true, email: true, ftp: true },
        },
      },
    });

    if (!relationship) {
      throw new NotFoundException(`Relationship with ID ${id} not found`);
    }

    return relationship;
  }

  /**
   * Updates a relationship's status or notes
   *
   * @param id - The UUID of the relationship to update
   * @param dto - The update data
   * @returns Promise containing the updated relationship
   * @throws NotFoundException if relationship not found
   */
  async update(id: string, dto: UpdateRelationshipDto) {
    // Verify relationship exists
    const existing = await this.prisma.coachAthleteRelationship.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Relationship with ID ${id} not found`);
    }

    // Build update data
    const updateData: {
      status?: RelationshipStatus;
      notes?: string;
      startedAt?: Date;
      endedAt?: Date;
    } = {};

    if (dto.status !== undefined) {
      updateData.status = dto.status;

      // Set startedAt when transitioning to ACTIVE
      if (dto.status === 'ACTIVE' && existing.status === 'PENDING') {
        updateData.startedAt = new Date();
      }

      // Set endedAt when transitioning to ENDED
      if (dto.status === 'ENDED' && existing.status !== 'ENDED') {
        updateData.endedAt = new Date();
      }
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    return this.prisma.coachAthleteRelationship.update({
      where: { id },
      data: updateData,
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
        athlete: {
          select: { id: true, fullName: true, email: true, ftp: true },
        },
      },
    });
  }

  /**
   * Accepts a pending relationship invitation
   *
   * @param id - The UUID of the relationship to accept
   * @returns Promise containing the updated relationship
   * @throws NotFoundException if relationship not found
   * @throws BadRequestException if relationship is not in PENDING status
   */
  async accept(id: string) {
    const relationship = await this.findOne(id);

    if (relationship.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot accept relationship with status ${relationship.status}`,
      );
    }

    return this.update(id, { status: 'ACTIVE' });
  }

  /**
   * Declines a pending relationship invitation
   *
   * @param id - The UUID of the relationship to decline
   * @returns Promise containing the deleted relationship
   * @throws NotFoundException if relationship not found
   * @throws BadRequestException if relationship is not in PENDING status
   */
  async decline(id: string) {
    const relationship = await this.findOne(id);

    if (relationship.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot decline relationship with status ${relationship.status}`,
      );
    }

    // Delete the pending invitation
    return this.prisma.coachAthleteRelationship.delete({
      where: { id },
    });
  }

  /**
   * Ends an active relationship
   *
   * @param id - The UUID of the relationship to end
   * @returns Promise containing the updated relationship
   * @throws NotFoundException if relationship not found
   */
  async end(id: string) {
    return this.update(id, { status: 'ENDED' });
  }

  /**
   * Pauses an active relationship
   *
   * @param id - The UUID of the relationship to pause
   * @returns Promise containing the updated relationship
   * @throws NotFoundException if relationship not found
   */
  async pause(id: string) {
    return this.update(id, { status: 'PAUSED' });
  }

  /**
   * Resumes a paused relationship
   *
   * @param id - The UUID of the relationship to resume
   * @returns Promise containing the updated relationship
   * @throws NotFoundException if relationship not found
   * @throws BadRequestException if relationship is not in PAUSED status
   */
  async resume(id: string) {
    const relationship = await this.findOne(id);

    if (relationship.status !== 'PAUSED') {
      throw new BadRequestException(
        `Cannot resume relationship with status ${relationship.status}`,
      );
    }

    return this.update(id, { status: 'ACTIVE' });
  }

  /**
   * Gets all athletes for a coach (relationships where user is coach)
   *
   * @param coachId - The UUID of the coach
   * @param status - Optional filter by relationship status
   * @returns Promise containing array of relationships with athlete details
   */
  async getAthletesForCoach(coachId: string, status?: RelationshipStatus) {
    const whereClause: { coachId: string; status?: RelationshipStatus } = {
      coachId,
    };

    if (status) {
      whereClause.status = status;
    }

    return this.prisma.coachAthleteRelationship.findMany({
      where: whereClause,
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true,
            email: true,
            ftp: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Gets all coaches for an athlete (relationships where user is athlete)
   *
   * @param athleteId - The UUID of the athlete
   * @param status - Optional filter by relationship status
   * @returns Promise containing array of relationships with coach details
   */
  async getCoachesForAthlete(athleteId: string, status?: RelationshipStatus) {
    const whereClause: { athleteId: string; status?: RelationshipStatus } = {
      athleteId,
    };

    if (status) {
      whereClause.status = status;
    }

    return this.prisma.coachAthleteRelationship.findMany({
      where: whereClause,
      include: {
        coach: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Gets pending invitations sent to an athlete
   *
   * @param athleteId - The UUID of the athlete
   * @returns Promise containing array of pending relationships with coach details
   */
  async getPendingInvitationsForAthlete(athleteId: string) {
    return this.getCoachesForAthlete(athleteId, 'PENDING');
  }

  /**
   * Gets pending invitations sent by a coach
   *
   * @param coachId - The UUID of the coach
   * @returns Promise containing array of pending relationships with athlete details
   */
  async getPendingInvitationsByCoach(coachId: string) {
    return this.getAthletesForCoach(coachId, 'PENDING');
  }

  /**
   * Deletes a relationship permanently
   *
   * @param id - The UUID of the relationship to delete
   * @returns Promise containing the deleted relationship
   * @throws NotFoundException if relationship not found
   */
  async delete(id: string) {
    // Verify exists
    await this.findOne(id);

    return this.prisma.coachAthleteRelationship.delete({
      where: { id },
    });
  }
}
