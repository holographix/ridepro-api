import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: PrismaService;

  const mockPrismaService = {
    athleteAvailability: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAthleteAvailability', () => {
    it('should return availability sorted by day index', async () => {
      const mockAvailability = [
        { id: '1', dayIndex: 0, available: true, athleteId: 'athlete1' },
        { id: '2', dayIndex: 1, available: false, athleteId: 'athlete1' },
      ];
      mockPrismaService.athleteAvailability.findMany.mockResolvedValue(mockAvailability);

      const result = await service.getAthleteAvailability('athlete1');

      expect(result).toEqual(mockAvailability);
      expect(mockPrismaService.athleteAvailability.findMany).toHaveBeenCalledWith({
        where: { athleteId: 'athlete1' },
        orderBy: { dayIndex: 'asc' },
      });
    });
  });

  describe('setDayAvailability', () => {
    it('should upsert availability for a specific day', async () => {
      const data = {
        athleteId: 'athlete1',
        dayIndex: 0,
        available: true,
        timeSlots: ['MORNING', 'AFTERNOON'] as any,
        maxHours: 2,
      };
      const mockUpserted = { id: '1', ...data };
      mockPrismaService.athleteAvailability.upsert.mockResolvedValue(mockUpserted);

      const result = await service.setDayAvailability(data);

      expect(result).toEqual(mockUpserted);
      expect(mockPrismaService.athleteAvailability.upsert).toHaveBeenCalledWith({
        where: {
          athleteId_dayIndex: { athleteId: 'athlete1', dayIndex: 0 },
        },
        update: {
          available: true,
          timeSlots: ['MORNING', 'AFTERNOON'],
          maxHours: 2,
          notes: undefined,
        },
        create: {
          dayIndex: 0,
          available: true,
          timeSlots: ['MORNING', 'AFTERNOON'],
          maxHours: 2,
          notes: undefined,
          athlete: { connect: { id: 'athlete1' } },
        },
      });
    });
  });

  describe('setWeekAvailability', () => {
    it('should set availability for multiple days in a transaction', async () => {
      const availability = [
        { dayIndex: 0, available: true },
        { dayIndex: 1, available: false },
      ];
      mockPrismaService.$transaction.mockResolvedValue([
        { id: '1', dayIndex: 0 },
        { id: '2', dayIndex: 1 },
      ]);

      await service.setWeekAvailability('athlete1', availability);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('deleteDayAvailability', () => {
    it('should delete availability for a specific day', async () => {
      const mockDeleted = { id: '1', dayIndex: 0 };
      mockPrismaService.athleteAvailability.delete.mockResolvedValue(mockDeleted);

      const result = await service.deleteDayAvailability('athlete1', 0);

      expect(result).toEqual(mockDeleted);
      expect(mockPrismaService.athleteAvailability.delete).toHaveBeenCalledWith({
        where: {
          athleteId_dayIndex: { athleteId: 'athlete1', dayIndex: 0 },
        },
      });
    });
  });

  describe('clearAthleteAvailability', () => {
    it('should delete all availability for an athlete', async () => {
      mockPrismaService.athleteAvailability.deleteMany.mockResolvedValue({ count: 7 });

      const result = await service.clearAthleteAvailability('athlete1');

      expect(result).toEqual({ count: 7 });
      expect(mockPrismaService.athleteAvailability.deleteMany).toHaveBeenCalledWith({
        where: { athleteId: 'athlete1' },
      });
    });
  });
});
