/**
 * Unit tests for InviteCodesService
 *
 * Tests cover all invite code operations including:
 * - Creating invite codes
 * - Validating codes
 * - Redeeming codes to create relationships
 * - Managing code lifecycle
 *
 * @module invite-codes
 */
import { Test, TestingModule } from '@nestjs/testing';
import { InviteCodesService } from './invite-codes.service';
import { PrismaService } from '../prisma/prisma.service';
import { RelationshipsService } from '../relationships/relationships.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Mock PrismaService for testing
 */
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  coachInviteCode: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

/**
 * Mock RelationshipsService for testing
 */
const mockRelationshipsService = {
  create: jest.fn(),
};

describe('InviteCodesService', () => {
  let service: InviteCodesService;
  let prisma: typeof mockPrismaService;
  let relationshipsService: typeof mockRelationshipsService;

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
  };

  const mockInviteCode = {
    id: 'invite-uuid-1',
    code: 'COACH-ABC123',
    coachId: mockCoach.id,
    maxUses: 10,
    usedCount: 3,
    expiresAt: null,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    coach: mockCoach,
  };

  const mockRelationship = {
    id: 'relationship-uuid-1',
    coachId: mockCoach.id,
    athleteId: mockAthlete.id,
    status: 'PENDING',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteCodesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RelationshipsService,
          useValue: mockRelationshipsService,
        },
      ],
    }).compile();

    service = module.get<InviteCodesService>(InviteCodesService);
    prisma = module.get(PrismaService);
    relationshipsService = module.get(RelationshipsService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    /**
     * Tests successful invite code creation
     */
    it('should create a new invite code successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockCoach);
      prisma.coachInviteCode.findUnique.mockResolvedValue(null);
      prisma.coachInviteCode.create.mockResolvedValue(mockInviteCode);

      const result = await service.create({
        coachId: mockCoach.id,
        maxUses: 10,
      });

      expect(result).toEqual(mockInviteCode);
      expect(prisma.coachInviteCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          coachId: mockCoach.id,
          maxUses: 10,
          code: expect.stringMatching(/^COACH-[A-Z0-9]{6}$/),
        }),
        include: expect.any(Object),
      });
    });

    /**
     * Tests that non-existent coach is rejected
     */
    it('should throw NotFoundException when coach does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          coachId: 'non-existent-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    /**
     * Tests successful code retrieval by ID
     */
    it('should return an invite code by ID', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(mockInviteCode);

      const result = await service.findOne(mockInviteCode.id);

      expect(result).toEqual(mockInviteCode);
    });

    /**
     * Tests that non-existent code throws error
     */
    it('should throw NotFoundException when code does not exist', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCode', () => {
    /**
     * Tests successful code retrieval by code string
     */
    it('should return an invite code by code string', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(mockInviteCode);

      const result = await service.findByCode('COACH-ABC123');

      expect(result).toEqual(mockInviteCode);
      expect(prisma.coachInviteCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'COACH-ABC123' },
        include: expect.any(Object),
      });
    });

    /**
     * Tests case-insensitive code lookup
     */
    it('should handle case-insensitive code lookup', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(mockInviteCode);

      await service.findByCode('coach-abc123');

      expect(prisma.coachInviteCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'COACH-ABC123' },
        include: expect.any(Object),
      });
    });
  });

  describe('validate', () => {
    /**
     * Tests valid code returns success
     */
    it('should return valid=true for a valid code', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(mockInviteCode);

      const result = await service.validate('COACH-ABC123');

      expect(result).toEqual({
        valid: true,
        coach: mockCoach,
      });
    });

    /**
     * Tests inactive code returns invalid
     */
    it('should return valid=false for an inactive code', async () => {
      const inactiveCode = { ...mockInviteCode, isActive: false };
      prisma.coachInviteCode.findUnique.mockResolvedValue(inactiveCode);

      const result = await service.validate('COACH-ABC123');

      expect(result).toEqual({
        valid: false,
        error: 'Code has been deactivated',
      });
    });

    /**
     * Tests expired code returns invalid
     */
    it('should return valid=false for an expired code', async () => {
      const expiredCode = {
        ...mockInviteCode,
        expiresAt: new Date('2020-01-01'),
      };
      prisma.coachInviteCode.findUnique.mockResolvedValue(expiredCode);

      const result = await service.validate('COACH-ABC123');

      expect(result).toEqual({
        valid: false,
        error: 'Code has expired',
      });
    });

    /**
     * Tests max-uses-reached code returns invalid
     */
    it('should return valid=false when max uses reached', async () => {
      const maxedCode = { ...mockInviteCode, maxUses: 5, usedCount: 5 };
      prisma.coachInviteCode.findUnique.mockResolvedValue(maxedCode);

      const result = await service.validate('COACH-ABC123');

      expect(result).toEqual({
        valid: false,
        error: 'Code has reached maximum uses',
      });
    });

    /**
     * Tests non-existent code returns invalid
     */
    it('should return valid=false for non-existent code', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(null);

      const result = await service.validate('INVALID-CODE');

      expect(result).toEqual({
        valid: false,
        error: 'Code not found',
      });
    });
  });

  describe('redeem', () => {
    /**
     * Tests successful code redemption
     */
    it('should redeem a valid code and create relationship', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(mockInviteCode);
      relationshipsService.create.mockResolvedValue(mockRelationship);
      prisma.coachInviteCode.update.mockResolvedValue({
        ...mockInviteCode,
        usedCount: 4,
      });

      const result = await service.redeem({
        code: 'COACH-ABC123',
        athleteId: mockAthlete.id,
      });

      expect(relationshipsService.create).toHaveBeenCalledWith({
        coachId: mockCoach.id,
        athleteId: mockAthlete.id,
      });
      expect(prisma.coachInviteCode.update).toHaveBeenCalledWith({
        where: { id: mockInviteCode.id },
        data: { usedCount: { increment: 1 } },
      });
    });

    /**
     * Tests that athletes cannot use their own code
     */
    it('should throw BadRequestException when athlete uses own code', async () => {
      const selfCode = { ...mockInviteCode, coachId: mockAthlete.id };
      prisma.coachInviteCode.findUnique.mockResolvedValue(selfCode);

      await expect(
        service.redeem({
          code: 'COACH-ABC123',
          athleteId: mockAthlete.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * Tests that invalid codes are rejected
     */
    it('should throw BadRequestException for invalid code', async () => {
      const inactiveCode = { ...mockInviteCode, isActive: false };
      prisma.coachInviteCode.findUnique.mockResolvedValue(inactiveCode);

      await expect(
        service.redeem({
          code: 'COACH-ABC123',
          athleteId: mockAthlete.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCodesForCoach', () => {
    /**
     * Tests retrieving all codes for a coach
     */
    it('should return all codes for a coach', async () => {
      const codes = [mockInviteCode];
      prisma.coachInviteCode.findMany.mockResolvedValue(codes);

      const result = await service.getCodesForCoach(mockCoach.id);

      expect(result).toEqual(codes);
      expect(prisma.coachInviteCode.findMany).toHaveBeenCalledWith({
        where: { coachId: mockCoach.id },
        orderBy: { createdAt: 'desc' },
      });
    });

    /**
     * Tests filtering to active codes only
     */
    it('should filter to active codes when activeOnly=true', async () => {
      await service.getCodesForCoach(mockCoach.id, true);

      expect(prisma.coachInviteCode.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          coachId: mockCoach.id,
          isActive: true,
        }),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('deactivate', () => {
    /**
     * Tests successful code deactivation
     */
    it('should deactivate an invite code', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(mockInviteCode);
      prisma.coachInviteCode.update.mockResolvedValue({
        ...mockInviteCode,
        isActive: false,
      });

      await service.deactivate(mockInviteCode.id);

      expect(prisma.coachInviteCode.update).toHaveBeenCalledWith({
        where: { id: mockInviteCode.id },
        data: { isActive: false },
      });
    });

    /**
     * Tests that deactivating non-existent code throws error
     */
    it('should throw NotFoundException for non-existent code', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reactivate', () => {
    /**
     * Tests successful code reactivation
     */
    it('should reactivate an invite code', async () => {
      const inactiveCode = { ...mockInviteCode, isActive: false };
      prisma.coachInviteCode.findUnique.mockResolvedValue(inactiveCode);
      prisma.coachInviteCode.update.mockResolvedValue(mockInviteCode);

      await service.reactivate(mockInviteCode.id);

      expect(prisma.coachInviteCode.update).toHaveBeenCalledWith({
        where: { id: mockInviteCode.id },
        data: { isActive: true },
      });
    });
  });

  describe('delete', () => {
    /**
     * Tests successful code deletion
     */
    it('should delete an invite code', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(mockInviteCode);
      prisma.coachInviteCode.delete.mockResolvedValue(mockInviteCode);

      await service.delete(mockInviteCode.id);

      expect(prisma.coachInviteCode.delete).toHaveBeenCalledWith({
        where: { id: mockInviteCode.id },
      });
    });

    /**
     * Tests that deleting non-existent code throws error
     */
    it('should throw NotFoundException for non-existent code', async () => {
      prisma.coachInviteCode.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
