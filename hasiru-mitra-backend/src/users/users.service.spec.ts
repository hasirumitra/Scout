import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { Role } from './enums/role.enum';
import { Gender } from './enums/gender.enum';
import { Language } from './enums/language.enum';
import { TestHelper } from '../../test/setup';
import { faker } from '@faker-js/faker';
import { Repository } from 'typeorm';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: any;
  let userProfileRepository: any;

  const mockUser: Partial<User> = {
    id: faker.string.uuid(),
    phoneNumber: '+919876543210',
    password: 'hashedPassword',
    role: Role.FARMER,
    isActive: true,
    isPhoneVerified: true,
    profileCompleted: false,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserProfile: Partial<UserProfile> = {
    id: faker.string.uuid(),
    userId: mockUser.id as string,
    firstName: 'Rajesh',
    lastName: 'Kumar',
    email: 'rajesh.kumar@example.com',
    dateOfBirth: new Date('1985-05-15'),
    gender: Gender.MALE,
    address: '123 Farm Street, Village',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    profileImageUrl: 'https://example.com/profile.jpg',
    preferredLanguage: Language.KANNADA,
    notificationPreferences: {
      sms: true,
      email: false,
      push: true,
      weatherAlerts: true,
      marketPrices: true,
      cropAdvice: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUserRepository = TestHelper.createMockRepository<User>();
    const mockUserProfileRepository = TestHelper.createMockRepository<UserProfile>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserProfile),
          useValue: mockUserProfileRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    userProfileRepository = module.get(getRepositoryToken(UserProfile));
  });

  describe('create', () => {
    const createUserDto = {
      phoneNumber: '+919876543210',
      password: 'hashedPassword',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      role: Role.FARMER,
    };

    it('should create a new user successfully', async () => {
      const newUser = { ...mockUser, ...createUserDto };

      userRepository.findOne.mockResolvedValue(null); // User doesn't exist
      userRepository.create.mockReturnValue(newUser);
      userRepository.save.mockResolvedValue(newUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(newUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: createUserDto.phoneNumber },
      });
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(userRepository.save).toHaveBeenCalledWith(newUser);
    });

    it('should throw ConflictException if user already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: createUserDto.phoneNumber },
      });
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should create user with different roles', async () => {
      const roles = [Role.FARMER, Role.AGENT, Role.ADMIN, Role.EXPERT];

      for (const role of roles) {
        userRepository.findOne.mockResolvedValue(null);
        userRepository.create.mockReturnValue({ ...mockUser, role });
        userRepository.save.mockResolvedValue({ ...mockUser, role });

        const result = await service.create({ ...createUserDto, role });

        expect(result.role).toBe(role);
      }
    });

    it('should handle repository errors', async () => {
      userRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createUserDto)).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    const mockUsers = [
      { ...mockUser, id: faker.string.uuid() },
      { ...mockUser, id: faker.string.uuid(), role: Role.AGENT },
      { ...mockUser, id: faker.string.uuid(), role: Role.EXPERT },
    ];

    it('should return paginated users', async () => {
      const paginationDto = { page: 1, limit: 10 };
      const total = mockUsers.length;

      userRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockUsers, total]),
      });

      const result = await service.findAll(paginationDto);

      expect(result).toEqual({
        data: mockUsers,
        total,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter users by role', async () => {
      const paginationDto = { page: 1, limit: 10, role: Role.FARMER };

      userRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockUsers, mockUsers.length]),
      });

      await service.findAll(paginationDto);

      const queryBuilder = userRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.role = :role', { role: Role.FARMER });
    });

    it('should search users by name or phone', async () => {
      const paginationDto = { page: 1, limit: 10, search: 'Rajesh' };

      userRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockUsers, mockUsers.length]),
      });

      await service.findAll(paginationDto);

      const queryBuilder = userRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(profile.firstName ILIKE :search OR profile.lastName ILIKE :search OR user.phoneNumber ILIKE :search)',
        { search: '%Rajesh%' }
      );
    });

    it('should filter by active status', async () => {
      const paginationDto = { page: 1, limit: 10, isActive: true };

      userRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockUsers, mockUsers.length]),
      });

      await service.findAll(paginationDto);

      const queryBuilder = userRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.isActive = :isActive', { isActive: true });
    });
  });

  describe('findOne', () => {
    const userId = faker.string.uuid();

    it('should find user by id', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(userId);

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
        relations: ['profile'],
      });
    });

    it('should return null for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(userId);

      expect(result).toBeNull();
    });
  });

  describe('findOneByPhone', () => {
    const phoneNumber = '+919876543210';

    it('should find user by phone number', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOneByPhone(phoneNumber);

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber },
        relations: ['profile'],
      });
    });

    it('should return null for non-existent phone number', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneByPhone(phoneNumber);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const userId = faker.string.uuid();
    const updateUserDto = {
      isActive: false,
      lastLoginAt: new Date(),
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateUserDto };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      await service.update(userId, updateUserDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(userRepository.save).toHaveBeenCalledWith(updatedUser);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.update(userId, updateUserDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const userId = faker.string.uuid();

    it('should soft delete user successfully', async () => {
      const updatedUser = { ...mockUser, isActive: false };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      await service.remove(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(userRepository.save).toHaveBeenCalledWith(updatedUser);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      const mockStats = [
        { role: Role.FARMER, count: '150' },
        { role: Role.AGENT, count: '25' },
        { role: Role.EXPERT, count: '10' },
        { role: Role.ADMIN, count: '5' },
      ];

      userRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      });

      const result = await service.getUserStatistics();

      expect(result).toEqual({
        totalUsers: 190,
        activeUsers: 190,
        usersByRole: {
          [Role.FARMER]: 150,
          [Role.AGENT]: 25,
          [Role.EXPERT]: 10,
          [Role.ADMIN]: 5,
        },
        recentRegistrations: 0, // Would be calculated separately
      });
    });

    it('should handle empty statistics', async () => {
      userRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getUserStatistics();

      expect(result).toEqual({
        totalUsers: 0,
        activeUsers: 0,
        usersByRole: {
          [Role.FARMER]: 0,
          [Role.AGENT]: 0,
          [Role.EXPERT]: 0,
          [Role.ADMIN]: 0,
        },
        recentRegistrations: 0,
      });
    });
  });

  describe('updateLastLogin', () => {
    const userId = faker.string.uuid();

    it('should update last login timestamp', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue({ ...mockUser, lastLoginAt: expect.any(Date) });

      await service.updateLastLogin(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        })
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.updateLastLogin(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateUserAccess', () => {
    it('should validate active user access', () => {
      const activeUser = { ...mockUser, isActive: true };

      expect(() => service.validateUserAccess(activeUser as User)).not.toThrow();
    });

    it('should throw exception for inactive user', () => {
      const inactiveUser = { ...mockUser, isActive: false };

      expect(() => service.validateUserAccess(inactiveUser as User)).toThrow(BadRequestException);
    });

    it('should throw exception for unverified phone', () => {
      const unverifiedUser = { ...mockUser, isPhoneVerified: false };

      expect(() => service.validateUserAccess(unverifiedUser as User)).toThrow(BadRequestException);
    });
  });

  describe('getUsersByRole', () => {
    it('should return users by specific role', async () => {
      const farmers = [
        { ...mockUser, role: Role.FARMER },
        { ...mockUser, id: faker.string.uuid(), role: Role.FARMER },
      ];

      userRepository.find.mockResolvedValue(farmers);

      const result = await service.getUsersByRole(Role.FARMER);

      expect(result).toEqual(farmers);
      expect(userRepository.find).toHaveBeenCalledWith({
        where: { role: Role.FARMER, isActive: true },
        relations: ['profile'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array for role with no users', async () => {
      userRepository.find.mockResolvedValue([]);

      const result = await service.getUsersByRole(Role.ADMIN);

      expect(result).toEqual([]);
    });
  });

  describe('searchUsers', () => {
    const searchQuery = 'Rajesh';

    it('should search users by query', async () => {
      const searchResults = [mockUser];

      userRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(searchResults),
      });

      const result = await service.searchUsers(searchQuery);

      expect(result).toEqual(searchResults);
    });

    it('should limit search results', async () => {
      userRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.searchUsers(searchQuery, 50);

      const queryBuilder = userRepository.createQueryBuilder();
      expect(queryBuilder.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('isPhoneNumberAvailable', () => {
    const phoneNumber = '+919876543210';

    it('should return true for available phone number', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.isPhoneNumberAvailable(phoneNumber);

      expect(result).toBe(true);
    });

    it('should return false for taken phone number', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.isPhoneNumberAvailable(phoneNumber);

      expect(result).toBe(false);
    });
  });
});