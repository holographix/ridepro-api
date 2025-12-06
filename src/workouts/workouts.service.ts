import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkoutsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    categoryId?: string;
    environment?: string;
    intensity?: string;
    durationCategory?: string;
    search?: string;
  }) {
    const where: Prisma.WorkoutWhereInput = {
      isPublic: true,
    };

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
    return this.prisma.workout.create({
      data,
      include: {
        category: true,
      },
    });
  }

  async update(id: string, data: Prisma.WorkoutUpdateInput) {
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
