import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutsService } from './workouts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    workout: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workoutCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkoutsService>(WorkoutsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all public workouts', async () => {
      const mockWorkouts = [
        { id: '1', name: 'Workout 1', isPublic: true },
        { id: '2', name: 'Workout 2', isPublic: true },
      ];
      mockPrismaService.workout.findMany.mockResolvedValue(mockWorkouts);

      const result = await service.findAll();

      expect(result).toEqual(mockWorkouts);
      expect(mockPrismaService.workout.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
      });
    });

    it('should filter by categoryId', async () => {
      const mockWorkouts = [{ id: '1', name: 'Workout 1', categoryId: 'cat1' }];
      mockPrismaService.workout.findMany.mockResolvedValue(mockWorkouts);

      await service.findAll({ categoryId: 'cat1' });

      expect(mockPrismaService.workout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat1' }),
        }),
      );
    });

    it('should filter by environment', async () => {
      mockPrismaService.workout.findMany.mockResolvedValue([]);

      await service.findAll({ environment: 'INDOOR' });

      expect(mockPrismaService.workout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ environment: 'INDOOR' }),
        }),
      );
    });

    it('should search by name, title, or description', async () => {
      mockPrismaService.workout.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'endurance' });

      expect(mockPrismaService.workout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'endurance', mode: 'insensitive' } },
              { title: { contains: 'endurance', mode: 'insensitive' } },
              { description: { contains: 'endurance', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a workout by id', async () => {
      const mockWorkout = { id: '1', name: 'Test Workout' };
      mockPrismaService.workout.findUnique.mockResolvedValue(mockWorkout);

      const result = await service.findOne('1');

      expect(result).toEqual(mockWorkout);
      expect(mockPrismaService.workout.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { category: true },
      });
    });
  });

  describe('findBySlug', () => {
    it('should return a workout by slug', async () => {
      const mockWorkout = { id: '1', slug: 'test-workout', name: 'Test Workout' };
      mockPrismaService.workout.findUnique.mockResolvedValue(mockWorkout);

      const result = await service.findBySlug('test-workout');

      expect(result).toEqual(mockWorkout);
      expect(mockPrismaService.workout.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-workout' },
        include: { category: true },
      });
    });
  });

  describe('getCategories', () => {
    it('should return all categories with workout counts', async () => {
      const mockCategories = [
        { id: '1', name: 'Endurance', _count: { workouts: 5 } },
        { id: '2', name: 'Intervals', _count: { workouts: 3 } },
      ];
      mockPrismaService.workoutCategory.findMany.mockResolvedValue(mockCategories);

      const result = await service.getCategories();

      expect(result).toEqual(mockCategories);
      expect(mockPrismaService.workoutCategory.findMany).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { workouts: true } } },
      });
    });
  });

  describe('create', () => {
    it('should create a new workout', async () => {
      const createData = {
        name: 'New Workout',
        slug: 'new-workout',
        durationSeconds: 3600,
        durationCategory: 'MEDIUM',
        structure: {},
        category: { connect: { id: 'cat1' } },
      };
      const mockCreated = { id: '1', ...createData };
      mockPrismaService.workout.create.mockResolvedValue(mockCreated);

      const result = await service.create(createData as any);

      expect(result).toEqual(mockCreated);
      expect(mockPrismaService.workout.create).toHaveBeenCalledWith({
        data: createData,
        include: { category: true },
      });
    });
  });

  describe('update', () => {
    it('should update a workout', async () => {
      const updateData = { name: 'Updated Workout' };
      const mockUpdated = { id: '1', name: 'Updated Workout' };
      mockPrismaService.workout.update.mockResolvedValue(mockUpdated);

      const result = await service.update('1', updateData);

      expect(result).toEqual(mockUpdated);
      expect(mockPrismaService.workout.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        include: { category: true },
      });
    });
  });

  describe('delete', () => {
    it('should delete a workout', async () => {
      const mockDeleted = { id: '1', name: 'Deleted Workout' };
      mockPrismaService.workout.delete.mockResolvedValue(mockDeleted);

      const result = await service.delete('1');

      expect(result).toEqual(mockDeleted);
      expect(mockPrismaService.workout.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
