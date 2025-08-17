import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import { TestHelper } from '../../test/setup';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let otpService: OtpService;
  let smsService: SmsService;
  let usersService: UsersService;
  let userRepository: any;

  const mockUser: Partial<User> = {
    id: faker.string.uuid(),
    phoneNumber: '+919876543210',
    password: 'hashedPassword',
    role: Role.FARMER,
    isActive: true,
    isPhoneVerified: true,
    profileCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUserRepository = TestHelper.createMockRepository<User>();
    const mockOtpService = {
      generateOtp: jest.fn(),
      verifyOtp: jest.fn(),
      cleanupExpiredOtps: jest.fn(),
    };
    const mockSmsService = {
      sendOtp: jest.fn(),
      sendWelcomeMessage: jest.fn(),
    };
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    const mockUsersService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneByPhone: jest.fn(),
      update: jest.fn(),
    };
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: OtpService,
          useValue: mockOtpService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    otpService = module.get<OtpService>(OtpService);
    smsService = module.get<SmsService>(SmsService);
    usersService = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
  });

  describe('register', () => {
    const registerDto = {
      phoneNumber: '+919876543210',
      password: 'StrongPassword123!',
      firstName: 'Test',
      lastName: 'User',
      role: Role.FARMER,
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const newUser = { ...mockUser, ...registerDto, password: hashedPassword };
      const otp = '123456';

      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      jest.spyOn(usersService, 'create').mockResolvedValue(newUser as User);
      jest.spyOn(otpService, 'generateOtp').mockResolvedValue(otp);
      jest.spyOn(smsService, 'sendOtp').mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        message: 'User registered successfully. Please verify your phone number.',
        userId: newUser.id,
      });
      expect(usersService.findOneByPhone).toHaveBeenCalledWith(registerDto.phoneNumber);
      expect(usersService.create).toHaveBeenCalled();
      expect(otpService.generateOtp).toHaveBeenCalledWith(newUser.id);
      expect(smsService.sendOtp).toHaveBeenCalledWith(registerDto.phoneNumber, otp);
    });

    it('should throw BadRequestException if user already exists', async () => {
      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(mockUser as User);

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
      expect(usersService.findOneByPhone).toHaveBeenCalledWith(registerDto.phoneNumber);
    });

    it('should validate password strength', async () => {
      const weakPasswordDto = { ...registerDto, password: '123' };

      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(null);

      await expect(service.register(weakPasswordDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const loginDto = {
      phoneNumber: '+919876543210',
      password: 'StrongPassword123!',
    };

    it('should login user successfully', async () => {
      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(mockUser as User);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken,
        refreshToken,
        user: {
          id: mockUser.id,
          phoneNumber: mockUser.phoneNumber,
          role: mockUser.role,
          isPhoneVerified: mockUser.isPhoneVerified,
          profileCompleted: mockUser.profileCompleted,
        },
      });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(mockUser as User);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(inactiveUser as User);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyOtp', () => {
    const verifyOtpDto = {
      userId: faker.string.uuid(),
      otp: '123456',
    };

    it('should verify OTP successfully', async () => {
      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(true);
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(usersService, 'update').mockResolvedValue(undefined);
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      const result = await service.verifyOtp(verifyOtpDto);

      expect(result).toEqual({
        accessToken,
        refreshToken,
        user: {
          id: mockUser.id,
          phoneNumber: mockUser.phoneNumber,
          role: mockUser.role,
          isPhoneVerified: true,
          profileCompleted: mockUser.profileCompleted,
        },
      });
      expect(usersService.update).toHaveBeenCalledWith(verifyOtpDto.userId, {
        isPhoneVerified: true,
      });
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(false);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(true);
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('resendOtp', () => {
    const resendOtpDto = {
      phoneNumber: '+919876543210',
    };

    it('should resend OTP successfully', async () => {
      const otp = '654321';

      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(mockUser as User);
      jest.spyOn(otpService, 'generateOtp').mockResolvedValue(otp);
      jest.spyOn(smsService, 'sendOtp').mockResolvedValue(undefined);

      const result = await service.resendOtp(resendOtpDto);

      expect(result).toEqual({
        message: 'OTP sent successfully',
      });
      expect(otpService.generateOtp).toHaveBeenCalledWith(mockUser.id);
      expect(smsService.sendOtp).toHaveBeenCalledWith(resendOtpDto.phoneNumber, otp);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(null);

      await expect(service.resendOtp(resendOtpDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('refreshToken', () => {
    const refreshTokenDto = {
      refreshToken: 'valid_refresh_token',
    };

    it('should refresh token successfully', async () => {
      const payload = { sub: mockUser.id, phone: mockUser.phoneNumber };
      const newAccessToken = 'new_access_token';
      const newRefreshToken = 'new_refresh_token';

      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce(newAccessToken)
        .mockReturnValueOnce(newRefreshToken);

      const result = await service.refreshToken(refreshTokenDto);

      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const payload = { sub: mockUser.id, phone: mockUser.phoneNumber };
      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto = {
      phoneNumber: '+919876543210',
    };

    it('should initiate password reset successfully', async () => {
      const otp = '123456';

      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(mockUser as User);
      jest.spyOn(otpService, 'generateOtp').mockResolvedValue(otp);
      jest.spyOn(smsService, 'sendOtp').mockResolvedValue(undefined);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result).toEqual({
        message: 'Password reset OTP sent successfully',
        userId: mockUser.id,
      });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(usersService, 'findOneByPhone').mockResolvedValue(null);

      await expect(service.forgotPassword(forgotPasswordDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto = {
      userId: faker.string.uuid(),
      otp: '123456',
      newPassword: 'NewStrongPassword123!',
    };

    it('should reset password successfully', async () => {
      const hashedPassword = 'hashedNewPassword';

      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      jest.spyOn(usersService, 'update').mockResolvedValue(undefined);

      const result = await service.resetPassword(resetPasswordDto);

      expect(result).toEqual({
        message: 'Password reset successfully',
      });
      expect(usersService.update).toHaveBeenCalledWith(resetPasswordDto.userId, {
        password: hashedPassword,
      });
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      jest.spyOn(otpService, 'verifyOtp').mockResolvedValue(false);

      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateUser', () => {
    it('should validate user successfully', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser as User);

      const result = await service.validateUser(mockUser.id as string);

      expect(result).toEqual(mockUser);
      expect(usersService.findOne).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null for non-existent user', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      const result = await service.validateUser('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'StrongPassword123!',
        'MyP@ssw0rd',
        'Complex#Pass1',
      ];

      strongPasswords.forEach(password => {
        expect(() => service.validatePasswordStrength(password)).not.toThrow();
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc',
        'PASSWORD',
        '12345678',
        'abcdefgh',
      ];

      weakPasswords.forEach(password => {
        expect(() => service.validatePasswordStrength(password)).toThrow(BadRequestException);
      });
    });
  });
});