/**
 * Categories Service
 *
 * Handles CRUD operations for workout categories.
 *
 * Business Logic:
 * - Categories can be "global" (coachId = null) - visible to all users
 * - Categories can be "coach-owned" (coachId = coachId) - only visible to that coach
 * - Global categories are system-seeded and typically shouldn't be deleted
 * - Coach-owned categories can only be managed by the owning coach
 * - Deleting a category requires reassigning or deleting associated workouts first
 * - Slug is auto-generated from name for URL-friendly identifiers
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  coachId?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate URL-friendly slug from category name
   * Converts to lowercase, replaces spaces with hyphens, removes special chars
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single
  }

  /**
   * Ensure slug is unique by appending a number if necessary
   */
  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.workoutCategory.findUnique({
        where: { slug },
      });

      if (!existing || existing.id === excludeId) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Get all categories accessible to a user
   * Returns global categories + coach's own categories
   */
  async findAll(coachId?: string) {
    const where = coachId
      ? {
          OR: [
            { coachId: null }, // Global categories
            { coachId }, // Coach's own categories
          ],
        }
      : { coachId: null }; // Only global categories for non-coaches

    return this.prisma.workoutCategory.findMany({
      where,
      orderBy: [{ coachId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { workouts: true },
        },
      },
    });
  }

  /**
   * Get a single category by ID
   */
  async findOne(id: string) {
    const category = await this.prisma.workoutCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { workouts: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Create a new category
   * Coach-owned categories have coachId set, global categories don't
   */
  async create(dto: CreateCategoryDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Category name is required');
    }

    const baseSlug = this.generateSlug(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    // Get next sort order if not provided
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const lastCategory = await this.prisma.workoutCategory.findFirst({
        where: dto.coachId ? { coachId: dto.coachId } : { coachId: null },
        orderBy: { sortOrder: 'desc' },
      });
      sortOrder = (lastCategory?.sortOrder ?? 0) + 1;
    }

    return this.prisma.workoutCategory.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        sortOrder,
        coachId: dto.coachId || null,
      },
      include: {
        _count: {
          select: { workouts: true },
        },
      },
    });
  }

  /**
   * Update an existing category
   * Only the owning coach can update coach-owned categories
   * Global categories require admin privileges (not implemented yet)
   */
  async update(id: string, dto: UpdateCategoryDto, requestingCoachId?: string) {
    const category = await this.findOne(id);

    // Authorization check
    if (category.coachId && category.coachId !== requestingCoachId) {
      throw new ForbiddenException('You can only update your own categories');
    }

    // For now, prevent updating global categories (could add admin check later)
    if (!category.coachId && requestingCoachId) {
      throw new ForbiddenException('Cannot update global categories');
    }

    const data: any = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      // Update slug if name changed
      const baseSlug = this.generateSlug(dto.name);
      data.slug = await this.ensureUniqueSlug(baseSlug, id);
    }

    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }

    return this.prisma.workoutCategory.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { workouts: true },
        },
      },
    });
  }

  /**
   * Delete a category
   * Only coach-owned categories can be deleted
   * Cannot delete if category has workouts assigned
   */
  async delete(id: string, requestingCoachId?: string) {
    const category = await this.findOne(id);

    // Authorization check
    if (category.coachId && category.coachId !== requestingCoachId) {
      throw new ForbiddenException('You can only delete your own categories');
    }

    // Prevent deleting global categories
    if (!category.coachId) {
      throw new ForbiddenException('Cannot delete global categories');
    }

    // Check if category has workouts
    if (category._count.workouts > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.workouts} workout(s). ` +
          'Please reassign or delete the workouts first.',
      );
    }

    return this.prisma.workoutCategory.delete({
      where: { id },
    });
  }

  /**
   * Reorder categories by updating sort order
   * Expects array of { id, sortOrder } objects
   */
  async reorder(
    items: Array<{ id: string; sortOrder: number }>,
    requestingCoachId?: string,
  ) {
    // Verify all categories belong to the requesting coach
    for (const item of items) {
      const category = await this.findOne(item.id);
      if (category.coachId && category.coachId !== requestingCoachId) {
        throw new ForbiddenException('You can only reorder your own categories');
      }
      if (!category.coachId) {
        throw new ForbiddenException('Cannot reorder global categories');
      }
    }

    // Update all sort orders in a transaction
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.workoutCategory.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return { success: true };
  }
}
