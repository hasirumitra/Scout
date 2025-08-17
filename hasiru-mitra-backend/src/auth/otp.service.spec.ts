import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import { Otp } from './entities/otp.entity';
import { TestHelper } from '../../test/setup';
import { faker } from '@faker-js/faker';
import Redis from 'ioredis';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('OtpService', () => {
  let service: OtpService;
  let otpRepository: any;
  let cacheManager: any;

  const mockOtp: Partial<Otp> = {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    otp: '123456',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    isUsed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockOtpRepository = TestHelper.createMockRepository<Otp>();
    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    const mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'OTP_EXPIRY_MINUTES':
            return 5;
          case 'OTP_MAX_ATTEMPTS':
            return 3;
          default:
            return null;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: getRepositoryToken(Otp),
          useValue: mockOtpRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    otpRepository = module.get(getRepositoryToken(Otp));
    cacheManager = module.get(CACHE_MANAGER);
  });

  describe('generateOtp', () => {
    const userId = faker.string.uuid();

    beforeEach(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.123456); // Will generate '123456'
      jest.spyOn(Date, 'now').mockReturnValue(1000000000000); // Fixed timestamp
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate a 6-digit OTP successfully', async () => {
      const newOtp = { ...mockOtp, userId, otp: '123456' };

      otpRepository.create.mockReturnValue(newOtp);
      otpRepository.save.mockResolvedValue(newOtp);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.generateOtp(userId);

      expect(result).toBe('123456');
      expect(result).toHaveLength(6);
      expect(otpRepository.create).toHaveBeenCalledWith({
        userId,
        otp: '123456',
        expiresAt: expect.any(Date),
      });
      expect(otpRepository.save).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith(
        `otp_attempts_${userId}`,
        0,
        300000 // 5 minutes in milliseconds
      );
    });

    it('should invalidate previous OTPs for the same user', async () => {
      const existingOtps = [
        { ...mockOtp, userId, isUsed: false },
        { ...mockOtp, userId, isUsed: false },
      ];

      otpRepository.find.mockResolvedValue(existingOtps);
      otpRepository.create.mockReturnValue(mockOtp);
      otpRepository.save.mockResolvedValue(mockOtp);

      await service.generateOtp(userId);

      expect(otpRepository.find).toHaveBeenCalledWith({
        where: { userId, isUsed: false },
      });
      expect(otpRepository.save).toHaveBeenCalledWith(
        existingOtps.map(otp => ({ ...otp, isUsed: true }))
      );
    });

    it('should generate different OTPs for consecutive calls', async () => {
      jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.123456) // First call
        .mockReturnValueOnce(0.789012); // Second call

      otpRepository.create.mockReturnValue(mockOtp);
      otpRepository.save.mockResolvedValue(mockOtp);

      const firstOtp = await service.generateOtp(userId);
      const secondOtp = await service.generateOtp(userId);

      expect(firstOtp).toBe('123456');
      expect(secondOtp).toBe('789012');
    });

    it('should set correct expiration time', async () => {
      const fixedTime = 1000000000000;
      const expectedExpiry = new Date(fixedTime + 5 * 60 * 1000); // 5 minutes later

      jest.spyOn(Date, 'now').mockReturnValue(fixedTime);
      otpRepository.create.mockReturnValue(mockOtp);
      otpRepository.save.mockResolvedValue(mockOtp);

      await service.generateOtp(userId);

      expect(otpRepository.create).toHaveBeenCalledWith({
        userId,
        otp: '123456',
        expiresAt: expectedExpiry,
      });
    });
  });

  describe('verifyOtp', () => {
    const userId = faker.string.uuid();
    const otpCode = '123456';

    it('should verify valid OTP successfully', async () => {
      const validOtp = {
        ...mockOtp,
        userId,
        otp: otpCode,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes in future
        isUsed: false,
      };

      otpRepository.findOne.mockResolvedValue(validOtp);
      otpRepository.save.mockResolvedValue({ ...validOtp, isUsed: true });
      cacheManager.get.mockResolvedValue(1); // 1 attempt used
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.verifyOtp(userId, otpCode);

      expect(result).toBe(true);
      expect(otpRepository.findOne).toHaveBeenCalledWith({
        where: { userId, otp: otpCode, isUsed: false },
        order: { createdAt: 'DESC' },
      });
      expect(otpRepository.save).toHaveBeenCalledWith({
        ...validOtp,
        isUsed: true,
      });
      expect(cacheManager.del).toHaveBeenCalledWith(`otp_attempts_${userId}`);
    });

    it('should reject expired OTP', async () => {
      const expiredOtp = {
        ...mockOtp,
        userId,
        otp: otpCode,
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        isUsed: false,
      };

      otpRepository.findOne.mockResolvedValue(expiredOtp);
      cacheManager.get.mockResolvedValue(1);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.verifyOtp(userId, otpCode);

      expect(result).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `otp_attempts_${userId}`,
        2,
        300000
      );
    });

    it('should reject already used OTP', async () => {
      const usedOtp = {
        ...mockOtp,
        userId,
        otp: otpCode,
        expiresAt: new Date(Date.now() + 300000),
        isUsed: true,
      };

      otpRepository.findOne.mockResolvedValue(usedOtp);

      const result = await service.verifyOtp(userId, otpCode);

      expect(result).toBe(false);
    });

    it('should reject non-existent OTP', async () => {
      otpRepository.findOne.mockResolvedValue(null);
      cacheManager.get.mockResolvedValue(2);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.verifyOtp(userId, otpCode);

      expect(result).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `otp_attempts_${userId}`,
        3,
        300000
      );
    });

    it('should handle maximum attempts exceeded', async () => {
      cacheManager.get.mockResolvedValue(3); // Max attempts reached

      const result = await service.verifyOtp(userId, otpCode);

      expect(result).toBe(false);
      expect(otpRepository.findOne).not.toHaveBeenCalled();
    });

    it('should track failed attempts', async () => {
      otpRepository.findOne.mockResolvedValue(null);
      cacheManager.get.mockResolvedValue(0); // First attempt
      cacheManager.set.mockResolvedValue(undefined);

      await service.verifyOtp(userId, 'wrongotp');

      expect(cacheManager.set).toHaveBeenCalledWith(
        `otp_attempts_${userId}`,
        1,
        300000
      );
    });
  });

  describe('cleanupExpiredOtps', () => {
    it('should cleanup expired OTPs successfully', async () => {
      const deletedCount = 5;
      const mockDeleteResult = { affected: deletedCount };

      otpRepository.createQueryBuilder.mockReturnValue({
        delete: () => ({
          where: () => ({
            execute: jest.fn().mockResolvedValue(mockDeleteResult),
          }),
        }),
      });

      const result = await service.cleanupExpiredOtps();

      expect(result).toBe(deletedCount);
      expect(otpRepository.createQueryBuilder).toHaveBeenCalledWith();
    });

    it('should handle cleanup when no expired OTPs exist', async () => {
      const mockDeleteResult = { affected: 0 };

      otpRepository.createQueryBuilder.mockReturnValue({
        delete: () => ({
          where: () => ({
            execute: jest.fn().mockResolvedValue(mockDeleteResult),
          }),
        }),
      });

      const result = await service.cleanupExpiredOtps();

      expect(result).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      otpRepository.createQueryBuilder.mockReturnValue({
        delete: () => ({
          where: () => ({
            execute: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      await expect(service.cleanupExpiredOtps()).rejects.toThrow('Database error');
    });
  });

  describe('getRemainingAttempts', () => {
    const userId = faker.string.uuid();

    it('should return remaining attempts for user', async () => {
      cacheManager.get.mockResolvedValue(2); // 2 attempts used

      const result = await service.getRemainingAttempts(userId);

      expect(result).toBe(1); // 3 max - 2 used = 1 remaining
      expect(cacheManager.get).toHaveBeenCalledWith(`otp_attempts_${userId}`);
    });

    it('should return max attempts for new user', async () => {
      cacheManager.get.mockResolvedValue(null); // No attempts yet

      const result = await service.getRemainingAttempts(userId);

      expect(result).toBe(3); // All attempts available
    });

    it('should return 0 for user who exceeded attempts', async () => {
      cacheManager.get.mockResolvedValue(5); // More than max attempts

      const result = await service.getRemainingAttempts(userId);

      expect(result).toBe(0);
    });
  });

  describe('resetAttempts', () => {
    const userId = faker.string.uuid();

    it('should reset attempts for user', async () => {
      cacheManager.del.mockResolvedValue(1);

      await service.resetAttempts(userId);

      expect(cacheManager.del).toHaveBeenCalledWith(`otp_attempts_${userId}`);
    });
  });

  describe('isOtpValid', () => {
    const currentTime = new Date();

    it('should validate OTP format and expiry', () => {
      const validOtp = {
        ...mockOtp,
        otp: '123456',
        expiresAt: new Date(currentTime.getTime() + 60000),
        isUsed: false,
      };

      const result = service.isOtpValid(validOtp as Otp);

      expect(result).toBe(true);
    });

    it('should reject expired OTP', () => {
      const expiredOtp = {
        ...mockOtp,
        otp: '123456',
        expiresAt: new Date(currentTime.getTime() - 60000),
        isUsed: false,
      };

      const result = service.isOtpValid(expiredOtp as Otp);

      expect(result).toBe(false);
    });

    it('should reject used OTP', () => {
      const usedOtp = {
        ...mockOtp,
        otp: '123456',
        expiresAt: new Date(currentTime.getTime() + 60000),
        isUsed: true,
      };

      const result = service.isOtpValid(usedOtp as Otp);

      expect(result).toBe(false);
    });

    it('should reject invalid OTP format', () => {
      const invalidOtp = {
        ...mockOtp,
        otp: '12345', // Too short
        expiresAt: new Date(currentTime.getTime() + 60000),
        isUsed: false,
      };

      const result = service.isOtpValid(invalidOtp as Otp);

      expect(result).toBe(false);
    });
  });
});