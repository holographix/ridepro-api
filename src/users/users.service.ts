import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
        _count: {
          select: { athletes: true },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
        athletes: {
          select: { id: true, fullName: true, email: true, ftp: true },
        },
        availability: true,
        goals: {
          orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
        },
      },
    });
  }

  async findByClerkId(clerkUserId: string) {
    return this.prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        coach: {
          select: { id: true, fullName: true, email: true },
        },
        athletes: {
          select: { id: true, fullName: true, email: true, ftp: true },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async getAthletes(coachId: string) {
    return this.prisma.user.findMany({
      where: { coachId },
      include: {
        availability: true,
        goals: {
          orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
        },
        _count: {
          select: { trainingWeeks: true },
        },
      },
    });
  }

  async assignCoach(athleteId: string, coachId: string) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: { coachId },
    });
  }

  async removeCoach(athleteId: string) {
    return this.prisma.user.update({
      where: { id: athleteId },
      data: { coachId: null },
    });
  }
}
