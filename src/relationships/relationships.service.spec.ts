/**
 * Unit tests for RelationshipsService
 *
 * Tests cover all coach-athlete relationship operations including:
 * - Creating relationships
 * - Accepting/declining invitations
 * - Pausing/resuming relationships
 * - Querying relationships
 *
 * @module relationships
 */
import { Test, TestingModule } from '@nestjs/testing';
import { RelationshipsService } from './relationships.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

/**
 * Mock PrismaService for testing
 */
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  coachAthleteRelationship: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('RelationshipsService', () => {
  let service: RelationshipsService;
  let prisma: typeof mockPrismaService;

  // Test data fixtures
  const mockCoach = {
    id: 'coach-uuid-1',
    fullName: 'Coach Smith',
    email: 'coach@example.com',
  };

  const mockAthlete = {
    id: 'athlete-uuid-1',
    fullName: 'Athlete Jones',
    email: 'athlete@example.com',
    ftp: 280,
  };

  const mockRelationship = {
    id: 'relationship-uuid-1',
    coachId: mockCoach.id,
    athleteId: mockAthlete.id,
    status: 'PENDING',
    notes: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    coach: mockCoach,
    athlete: mockAthlete,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RelationshipsService>(RelationshipsService);
    prisma = module.get(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    /**
     * Tests successful relationship creation
     */
    it('should create a new relationship successfully', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockCoach)
        .mockResolvedValueOnce(mockAthlete);
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(null);
      prisma.coachAthleteRelationship.create.mockResolvedValue(mockRelationship);

      const result = await service.create({
        coachId: mockCoach.id,
        athleteId: mockAthlete.id,
      });

      expect(result).toEqual(mockRelationship);
      expect(prisma.coachAthleteRelationship.create).toHaveBeenCalledWith({
        data: {
          coachId: mockCoach.id,
          athleteId: mockAthlete.id,
          notes: undefined,
          status: 'PENDING',
        },
        include: expect.any(Object),
      });
    });

    /**
     * Tests that self-coaching is rejected
     */
    it('should throw BadRequestException when coach and athlete are the same', async () => {
      await expect(
        service.create({
          coachId: mockCoach.id,
          athleteId: mockCoach.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * Tests that non-existent coach is rejected
     */
    it('should throw NotFoundException when coach does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create({
          coachId: 'non-existent-id',
          athleteId: mockAthlete.id,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    /**
     * Tests that non-existent athlete is rejected
     */
    it('should throw NotFoundException when athlete does not exist', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockCoach)
        .mockResolvedValueOnce(null);

      await expect(
        service.create({
          coachId: mockCoach.id,
          athleteId: 'non-existent-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    /**
     * Tests that duplicate relationships are rejected
     */
    it('should throw ConflictException when relationship already exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockCoach)
        .mockResolvedValueOnce(mockAthlete);
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        mockRelationship,
      );

      await expect(
        service.create({
          coachId: mockCoach.id,
          athleteId: mockAthlete.id,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    /**
     * Tests successful relationship retrieval
     */
    it('should return a relationship by ID', async () => {
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        mockRelationship,
      );

      const result = await service.findOne(mockRelationship.id);

      expect(result).toEqual(mockRelationship);
    });

    /**
     * Tests that non-existent relationship throws error
     */
    it('should throw NotFoundException when relationship does not exist', async () => {
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('accept', () => {
    /**
     * Tests successful invitation acceptance
     */
    it('should accept a pending relationship', async () => {
      const pendingRelationship = { ...mockRelationship, status: 'PENDING' };
      const activeRelationship = {
        ...mockRelationship,
        status: 'ACTIVE',
        startedAt: expect.any(Date),
      };

      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        pendingRelationship,
      );
      prisma.coachAthleteRelationship.update.mockResolvedValue(
        activeRelationship,
      );

      const result = await service.accept(mockRelationship.id);

      expect(prisma.coachAthleteRelationship.update).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
        data: expect.objectContaining({
          status: 'ACTIVE',
          startedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });
    });

    /**
     * Tests that accepting non-pending relationship throws error
     */
    it('should throw BadRequestException when relationship is not pending', async () => {
      const activeRelationship = { ...mockRelationship, status: 'ACTIVE' };
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        activeRelationship,
      );

      await expect(service.accept(mockRelationship.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('decline', () => {
    /**
     * Tests successful invitation decline
     */
    it('should decline and delete a pending relationship', async () => {
      const pendingRelationship = { ...mockRelationship, status: 'PENDING' };
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        pendingRelationship,
      );
      prisma.coachAthleteRelationship.delete.mockResolvedValue(
        pendingRelationship,
      );

      await service.decline(mockRelationship.id);

      expect(prisma.coachAthleteRelationship.delete).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
      });
    });

    /**
     * Tests that declining non-pending relationship throws error
     */
    it('should throw BadRequestException when relationship is not pending', async () => {
      const activeRelationship = { ...mockRelationship, status: 'ACTIVE' };
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        activeRelationship,
      );

      await expect(service.decline(mockRelationship.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('pause', () => {
    /**
     * Tests successful relationship pausing
     */
    it('should pause a relationship', async () => {
      const activeRelationship = { ...mockRelationship, status: 'ACTIVE' };
      const pausedRelationship = { ...mockRelationship, status: 'PAUSED' };

      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        activeRelationship,
      );
      prisma.coachAthleteRelationship.update.mockResolvedValue(
        pausedRelationship,
      );

      const result = await service.pause(mockRelationship.id);

      expect(prisma.coachAthleteRelationship.update).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
        data: { status: 'PAUSED' },
        include: expect.any(Object),
      });
    });
  });

  describe('resume', () => {
    /**
     * Tests successful relationship resumption
     */
    it('should resume a paused relationship', async () => {
      const pausedRelationship = { ...mockRelationship, status: 'PAUSED' };
      const activeRelationship = { ...mockRelationship, status: 'ACTIVE' };

      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        pausedRelationship,
      );
      prisma.coachAthleteRelationship.update.mockResolvedValue(
        activeRelationship,
      );

      await service.resume(mockRelationship.id);

      expect(prisma.coachAthleteRelationship.update).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
        data: { status: 'ACTIVE' },
        include: expect.any(Object),
      });
    });

    /**
     * Tests that resuming non-paused relationship throws error
     */
    it('should throw BadRequestException when relationship is not paused', async () => {
      const activeRelationship = { ...mockRelationship, status: 'ACTIVE' };
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        activeRelationship,
      );

      await expect(service.resume(mockRelationship.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('end', () => {
    /**
     * Tests successful relationship ending
     */
    it('should end a relationship', async () => {
      const activeRelationship = { ...mockRelationship, status: 'ACTIVE' };
      const endedRelationship = {
        ...mockRelationship,
        status: 'ENDED',
        endedAt: new Date(),
      };

      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        activeRelationship,
      );
      prisma.coachAthleteRelationship.update.mockResolvedValue(
        endedRelationship,
      );

      await service.end(mockRelationship.id);

      expect(prisma.coachAthleteRelationship.update).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
        data: expect.objectContaining({
          status: 'ENDED',
          endedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('getAthletesForCoach', () => {
    /**
     * Tests retrieving all athletes for a coach
     */
    it('should return all athletes for a coach', async () => {
      const relationships = [mockRelationship];
      prisma.coachAthleteRelationship.findMany.mockResolvedValue(relationships);

      const result = await service.getAthletesForCoach(mockCoach.id);

      expect(result).toEqual(relationships);
      expect(prisma.coachAthleteRelationship.findMany).toHaveBeenCalledWith({
        where: { coachId: mockCoach.id },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    /**
     * Tests filtering athletes by status
     */
    it('should filter athletes by status when provided', async () => {
      await service.getAthletesForCoach(mockCoach.id, 'ACTIVE');

      expect(prisma.coachAthleteRelationship.findMany).toHaveBeenCalledWith({
        where: { coachId: mockCoach.id, status: 'ACTIVE' },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });
  });

  describe('getCoachesForAthlete', () => {
    /**
     * Tests retrieving all coaches for an athlete
     */
    it('should return all coaches for an athlete', async () => {
      const relationships = [mockRelationship];
      prisma.coachAthleteRelationship.findMany.mockResolvedValue(relationships);

      const result = await service.getCoachesForAthlete(mockAthlete.id);

      expect(result).toEqual(relationships);
      expect(prisma.coachAthleteRelationship.findMany).toHaveBeenCalledWith({
        where: { athleteId: mockAthlete.id },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });
  });

  describe('delete', () => {
    /**
     * Tests successful relationship deletion
     */
    it('should delete a relationship', async () => {
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(
        mockRelationship,
      );
      prisma.coachAthleteRelationship.delete.mockResolvedValue(mockRelationship);

      await service.delete(mockRelationship.id);

      expect(prisma.coachAthleteRelationship.delete).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
      });
    });

    /**
     * Tests that deleting non-existent relationship throws error
     */
    it('should throw NotFoundException when relationship does not exist', async () => {
      prisma.coachAthleteRelationship.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
