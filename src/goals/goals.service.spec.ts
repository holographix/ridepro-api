import { Test, TestingModule } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    goal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAthleteGoals', () => {
    it('should return all goals for an athlete sorted by date and priority', async () => {
      const mockGoals = [
        { id: '1', name: 'Race A', eventDate: new Date('2025-06-01'), priority: 'A' },
        { id: '2', name: 'Race B', eventDate: new Date('2025-07-01'), priority: 'B' },
      ];
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);

      const result = await service.getAthleteGoals('athlete1');

      expect(result).toEqual(mockGoals);
      expect(mockPrismaService.goal.findMany).toHaveBeenCalledWith({
        where: { athleteId: 'athlete1' },
        orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
      });
    });
  });

  describe('getGoal', () => {
    it('should return a goal with athlete info', async () => {
      const mockGoal = {
        id: '1',
        name: 'Summer Race',
        athlete: { id: 'athlete1', fullName: 'Test Athlete' },
      };
      mockPrismaService.goal.findUnique.mockResolvedValue(mockGoal);

      const result = await service.getGoal('1');

      expect(result).toEqual(mockGoal);
      expect(mockPrismaService.goal.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { athlete: { select: { id: true, fullName: true } } },
      });
    });
  });

  describe('createGoal', () => {
    it('should create a goal with default priority B', async () => {
      const createData = {
        athleteId: 'athlete1',
        name: 'New Race',
        eventDate: new Date('2025-08-01'),
      };
      const mockCreated = { id: '1', ...createData, priority: 'B' };
      mockPrismaService.goal.create.mockResolvedValue(mockCreated);

      const result = await service.createGoal(createData);

      expect(result).toEqual(mockCreated);
      expect(mockPrismaService.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Race',
          priority: 'B',
          athlete: { connect: { id: 'athlete1' } },
        }),
      });
    });

    it('should create a goal with specified priority', async () => {
      const createData = {
        athleteId: 'athlete1',
        name: 'Priority Race',
        priority: 'A' as const,
      };
      mockPrismaService.goal.create.mockResolvedValue({ id: '1', ...createData });

      await service.createGoal(createData);

      expect(mockPrismaService.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 'A',
        }),
      });
    });
  });

  describe('updateGoal', () => {
    it('should update a goal', async () => {
      const updateData = { name: 'Updated Race Name', priority: 'A' as const };
      const mockUpdated = { id: '1', ...updateData };
      mockPrismaService.goal.update.mockResolvedValue(mockUpdated);

      const result = await service.updateGoal('1', updateData);

      expect(result).toEqual(mockUpdated);
      expect(mockPrismaService.goal.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
      });
    });
  });

  describe('deleteGoal', () => {
    it('should delete a goal', async () => {
      const mockDeleted = { id: '1', name: 'Deleted Goal' };
      mockPrismaService.goal.delete.mockResolvedValue(mockDeleted);

      const result = await service.deleteGoal('1');

      expect(result).toEqual(mockDeleted);
      expect(mockPrismaService.goal.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('getUpcomingGoals', () => {
    it('should return only future goals', async () => {
      const mockGoals = [
        { id: '1', name: 'Future Race', eventDate: new Date('2026-01-01') },
      ];
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);

      const result = await service.getUpcomingGoals('athlete1');

      expect(result).toEqual(mockGoals);
      expect(mockPrismaService.goal.findMany).toHaveBeenCalledWith({
        where: {
          athleteId: 'athlete1',
          eventDate: { gte: expect.any(Date) },
        },
        orderBy: [{ eventDate: 'asc' }, { priority: 'asc' }],
      });
    });
  });

  describe('getGoalsByPriority', () => {
    it('should return goals filtered by priority', async () => {
      const mockGoals = [
        { id: '1', name: 'A Race', priority: 'A' },
      ];
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);

      const result = await service.getGoalsByPriority('athlete1', 'A');

      expect(result).toEqual(mockGoals);
      expect(mockPrismaService.goal.findMany).toHaveBeenCalledWith({
        where: { athleteId: 'athlete1', priority: 'A' },
        orderBy: { eventDate: 'asc' },
      });
    });
  });
});
