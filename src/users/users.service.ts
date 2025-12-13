/**
 * UsersService - Core user management service
 *
 * This service handles all user-related operations including:
 * - Basic CRUD operations for user profiles
 * - User lookup by various identifiers (ID, Clerk ID, email)
 * - Retrieval of users with their coaching relationships
 *
 * Note: Coach-athlete relationship management has been moved to
 * the RelationshipsService for better separation of concerns.
 *
 * @module users
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Service for managing user entities
 *
 * @class UsersService
 * @description Provides methods for user CRUD operations and lookups.
 * Coach-athlete relationships are handled by RelationshipsService.
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves all users with their relationship counts
   *
   * @returns Promise containing array of users with coaching and athlete counts
   */
  async findAll() {
    return this.prisma.user.findMany({
      include: {
        _count: {
          select: {
            coachingRelationships: true,
            athleteRelationships: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves a single user by their internal ID
   *
   * @param id - The UUID of the user
   * @returns Promise containing the user with their relationships, availability, and goals
   * @throws NotFoundException if user is not found
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        coachingRelationships: {
          where: { status: 'ACTIVE' },
          include: {
            athlete: {
              select: { id: true, fullName: true, email: true, ftp: true },
            },
          },
        },
        athleteRelationships: {
          where: { status: 'ACTIVE' },
          include: {
            coach: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        availability: true,
        goals: {
          orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Retrieves a user by their Clerk authentication ID
   *
   * @param clerkUserId - The Clerk user ID
   * @returns Promise containing the user with their active relationships, or null if not found
   */
  async findByClerkId(clerkUserId: string) {
    return this.prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        coachingRelationships: {
          where: { status: 'ACTIVE' },
          include: {
            athlete: {
              select: { id: true, fullName: true, email: true, ftp: true },
            },
          },
        },
        athleteRelationships: {
          where: { status: 'ACTIVE' },
          include: {
            coach: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });
  }

  /**
   * Retrieves a user by their email address
   *
   * @param email - The user's email address
   * @returns Promise containing the user or null if not found
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Creates a new user
   *
   * @param data - The user creation data matching Prisma's UserCreateInput
   * @returns Promise containing the newly created user
   */
  async create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Updates an existing user
   *
   * @param id - The UUID of the user to update
   * @param data - The user update data matching Prisma's UserUpdateInput
   * @returns Promise containing the updated user
   * @throws NotFoundException if user is not found
   */
  async update(id: string, data: Prisma.UserUpdateInput) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Deletes a user by their ID
   *
   * @param id - The UUID of the user to delete
   * @returns Promise containing the deleted user
   * @throws NotFoundException if user is not found
   */
  async delete(id: string) {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  // ============================================
  // TOUR & SETUP CHECKLIST
  // ============================================

  /**
   * Gets the tour state for a user
   *
   * @param id - The UUID of the user
   * @returns Promise containing tour state fields
   */
  async getTourState(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        tourCompleted: true,
        tourDismissed: true,
        setupChecklistCompleted: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Updates tour state for a user
   *
   * @param id - The UUID of the user
   * @param data - Tour state update data
   * @returns Promise containing updated tour state
   */
  async updateTourState(
    id: string,
    data: {
      tourCompleted?: boolean;
      tourDismissed?: boolean;
      setupChecklistCompleted?: string[];
    },
  ) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: {
          tourCompleted: true,
          tourDismissed: true,
          setupChecklistCompleted: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Marks a checklist item as completed for a user
   *
   * @param id - The UUID of the user
   * @param itemId - The checklist item ID to mark as completed
   * @returns Promise containing updated checklist
   */
  async completeChecklistItem(id: string, itemId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { setupChecklistCompleted: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Add item if not already completed
    const completed = user.setupChecklistCompleted || [];
    if (!completed.includes(itemId)) {
      completed.push(itemId);
    }

    return this.prisma.user.update({
      where: { id },
      data: { setupChecklistCompleted: completed },
      select: {
        tourCompleted: true,
        tourDismissed: true,
        setupChecklistCompleted: true,
      },
    });
  }
}
