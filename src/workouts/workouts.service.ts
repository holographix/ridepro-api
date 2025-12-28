import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkoutsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate workout structure for cadence and HR ranges
   */
  private validateWorkoutStructure(structure: any): void {
    if (!structure || !structure.structure) {
      return;
    }

    const validateTarget = (target: any, path: string) => {
      // Validate cadence (30-200 RPM)
      if (target.cadenceMin !== undefined) {
        if (typeof target.cadenceMin !== 'number' || target.cadenceMin < 30 || target.cadenceMin > 200) {
          throw new BadRequestException(
            `Invalid cadence minimum at ${path}: must be between 30-200 RPM, got ${target.cadenceMin}`
          );
        }
      }
      if (target.cadenceMax !== undefined) {
        if (typeof target.cadenceMax !== 'number' || target.cadenceMax < 30 || target.cadenceMax > 200) {
          throw new BadRequestException(
            `Invalid cadence maximum at ${path}: must be between 30-200 RPM, got ${target.cadenceMax}`
          );
        }
      }
      // Validate that min <= max if both are present
      if (target.cadenceMin !== undefined && target.cadenceMax !== undefined) {
        if (target.cadenceMin > target.cadenceMax) {
          throw new BadRequestException(
            `Invalid cadence range at ${path}: minimum (${target.cadenceMin}) cannot be greater than maximum (${target.cadenceMax})`
          );
        }
      }

      // Validate heart rate
      if (target.hrMin !== undefined || target.hrMax !== undefined) {
        const hrType = target.hrType || 'bpm';
        const minAllowed = 50;
        const maxAllowed = hrType === 'percent' ? 100 : 220;

        if (target.hrMin !== undefined) {
          if (typeof target.hrMin !== 'number' || target.hrMin < minAllowed || target.hrMin > maxAllowed) {
            throw new BadRequestException(
              `Invalid HR minimum at ${path}: must be between ${minAllowed}-${maxAllowed} ${hrType === 'percent' ? '%' : 'BPM'}, got ${target.hrMin}`
            );
          }
        }
        if (target.hrMax !== undefined) {
          if (typeof target.hrMax !== 'number' || target.hrMax < minAllowed || target.hrMax > maxAllowed) {
            throw new BadRequestException(
              `Invalid HR maximum at ${path}: must be between ${minAllowed}-${maxAllowed} ${hrType === 'percent' ? '%' : 'BPM'}, got ${target.hrMax}`
            );
          }
        }
        // Validate that min <= max if both are present
        if (target.hrMin !== undefined && target.hrMax !== undefined) {
          if (target.hrMin > target.hrMax) {
            throw new BadRequestException(
              `Invalid HR range at ${path}: minimum (${target.hrMin}) cannot be greater than maximum (${target.hrMax})`
            );
          }
        }
      }
    };

    const validateStep = (step: any, path: string) => {
      if (step.targets && Array.isArray(step.targets)) {
        step.targets.forEach((target: any, idx: number) => {
          validateTarget(target, `${path}.targets[${idx}]`);
        });
      }
    };

    const validateItem = (item: any, itemIdx: number) => {
      const basePath = `structure[${itemIdx}]`;

      if (item.type === 'repetition' && item.steps) {
        item.steps.forEach((step: any, stepIdx: number) => {
          if (step.type === 'repetition') {
            validateItem(step, stepIdx);
          } else {
            validateStep(step, `${basePath}.steps[${stepIdx}]`);
          }
        });
      } else if (item.type === 'step' && item.steps) {
        item.steps.forEach((step: any, stepIdx: number) => {
          validateStep(step, `${basePath}.steps[${stepIdx}]`);
        });
      }
    };

    structure.structure.forEach((item: any, idx: number) => {
      validateItem(item, idx);
    });
  }

  async findAll(params?: {
    categoryId?: string;
    environment?: string;
    intensity?: string;
    durationCategory?: string;
    search?: string;
    coachId?: string;
  }) {
    const where: Prisma.WorkoutWhereInput = {};

    // If coachId is provided, fetch coach's workouts (including private ones)
    // Otherwise, only fetch public workouts
    if (params?.coachId) {
      where.coachId = params.coachId;
    } else {
      where.isPublic = true;
    }

    if (params?.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (params?.environment) {
      where.environment = params.environment as any;
    }
    if (params?.intensity) {
      where.intensity = params.intensity as any;
    }
    if (params?.durationCategory) {
      where.durationCategory = params.durationCategory as any;
    }
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.workout.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    return this.prisma.workout.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.workout.findUnique({
      where: { slug },
      include: {
        category: true,
      },
    });
  }

  async create(data: Prisma.WorkoutCreateInput) {
    // Validate workout structure if present
    if (data.structure) {
      this.validateWorkoutStructure(data.structure);
    }

    return this.prisma.workout.create({
      data,
      include: {
        category: true,
      },
    });
  }

  async update(id: string, data: Prisma.WorkoutUpdateInput) {
    // Validate workout structure if present
    if (data.structure) {
      this.validateWorkoutStructure(data.structure);
    }

    return this.prisma.workout.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.workout.delete({
      where: { id },
    });
  }

  async getCategories() {
    return this.prisma.workoutCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { workouts: true },
        },
      },
    });
  }

  async getCategoryBySlug(slug: string) {
    return this.prisma.workoutCategory.findUnique({
      where: { slug },
      include: {
        workouts: {
          where: { isPublic: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }
}
