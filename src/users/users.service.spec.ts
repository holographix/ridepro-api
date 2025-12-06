import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
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
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users with coach info and athlete count', async () => {
      const mockUsers = [
        { id: '1', email: 'coach@test.com', role: 'COACH', coach: null, _count: { athletes: 2 } },
        { id: '2', email: 'athlete@test.com', role: 'ATHLETE', coach: { id: '1' }, _count: { athletes: 0 } },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(result).toEqual(mockUsers);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        include: {
          coach: { select: { id: true, fullName: true, email: true } },
          _count: { select: { athletes: true } },
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a user with all relations', async () => {
      const mockUser = {
        id: '1',
        email: 'athlete@test.com',
        coach: { id: '2', fullName: 'Coach Name' },
        athletes: [],
        availability: [],
        goals: [],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.objectContaining({
          coach: expect.any(Object),
          athletes: expect.any(Object),
          availability: true,
          goals: expect.any(Object),
        }),
      });
    });
  });

  describe('findByClerkId', () => {
    it('should return a user by Clerk ID', async () => {
      const mockUser = { id: '1', clerkUserId: 'clerk_123' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByClerkId('clerk_123');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { clerkUserId: 'clerk_123' },
        include: expect.any(Object),
      });
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = { id: '1', email: 'test@test.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@test.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createData = { email: 'new@test.com', fullName: 'New User', role: 'ATHLETE' };
      const mockCreated = { id: '1', ...createData };
      mockPrismaService.user.create.mockResolvedValue(mockCreated);

      const result = await service.create(createData as any);

      expect(result).toEqual(mockCreated);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({ data: createData });
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateData = { fullName: 'Updated Name' };
      const mockUpdated = { id: '1', fullName: 'Updated Name' };
      mockPrismaService.user.update.mockResolvedValue(mockUpdated);

      const result = await service.update('1', updateData);

      expect(result).toEqual(mockUpdated);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      const mockDeleted = { id: '1', email: 'deleted@test.com' };
      mockPrismaService.user.delete.mockResolvedValue(mockDeleted);

      const result = await service.delete('1');

      expect(result).toEqual(mockDeleted);
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('getAthletes', () => {
    it('should return all athletes for a coach', async () => {
      const mockAthletes = [
        { id: '1', email: 'athlete1@test.com', coachId: 'coach1' },
        { id: '2', email: 'athlete2@test.com', coachId: 'coach1' },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(mockAthletes);

      const result = await service.getAthletes('coach1');

      expect(result).toEqual(mockAthletes);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { coachId: 'coach1' },
        include: expect.objectContaining({
          availability: true,
          goals: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
    });
  });

  describe('assignCoach', () => {
    it('should assign a coach to an athlete', async () => {
      const mockUpdated = { id: 'athlete1', coachId: 'coach1' };
      mockPrismaService.user.update.mockResolvedValue(mockUpdated);

      const result = await service.assignCoach('athlete1', 'coach1');

      expect(result).toEqual(mockUpdated);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'athlete1' },
        data: { coachId: 'coach1' },
      });
    });
  });

  describe('removeCoach', () => {
    it('should remove coach from an athlete', async () => {
      const mockUpdated = { id: 'athlete1', coachId: null };
      mockPrismaService.user.update.mockResolvedValue(mockUpdated);

      const result = await service.removeCoach('athlete1');

      expect(result).toEqual(mockUpdated);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'athlete1' },
        data: { coachId: null },
      });
    });
  });
});
