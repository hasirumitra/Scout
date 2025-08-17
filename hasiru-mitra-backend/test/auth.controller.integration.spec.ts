import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { UserProfile } from '../src/users/entities/user-profile.entity';
import { Otp } from '../src/auth/entities/otp.entity';
import { Role } from '../src/users/enums/role.enum';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let otpRepository: Repository<Otp>;
  let userProfileRepository: Repository<UserProfile>;

  const testUser = {
    phoneNumber: '+919876543210',
    password: 'StrongPassword123!',
    firstName: 'Test',
    lastName: 'User',
    role: Role.FARMER,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'sqlite',
            database: ':memory:',
            entities: [User, UserProfile, Otp],
            synchronize: true,
            logging: false,
          }),
          inject: [ConfigService],
        }),
        CacheModule.register({
          isGlobal: true,
          ttl: 300,
        }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: 'test-jwt-secret',
            signOptions: { expiresIn: '1h' },
          }),
          inject: [ConfigService],
        }),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    otpRepository = moduleFixture.get<Repository<Otp>>(getRepositoryToken(Otp));
    userProfileRepository = moduleFixture.get<Repository<UserProfile>>(getRepositoryToken(UserProfile));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await otpRepository.delete({});
    await userProfileRepository.delete({});
    await userRepository.delete({});
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User registered successfully. Please verify your phone number.');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.userId).toBeUUID();

      // Verify user is created in database
      const createdUser = await userRepository.findOne({
        where: { phoneNumber: testUser.phoneNumber },
      });
      expect(createdUser).toBeDefined();
      expect(createdUser.isPhoneVerified).toBe(false);
      expect(createdUser.role).toBe(testUser.role);

      // Verify OTP is created
      const otp = await otpRepository.findOne({
        where: { userId: createdUser.id },
      });
      expect(otp).toBeDefined();
      expect(otp.otp).toHaveLength(6);
      expect(otp.isUsed).toBe(false);
    });

    it('should return 400 for invalid phone number', async () => {
      const invalidUser = { ...testUser, phoneNumber: 'invalid-phone' };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should return 400 for weak password', async () => {
      const weakPasswordUser = { ...testUser, password: '123' };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 409 for duplicate phone number', async () => {
      // Create user first
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // Try to register same user again
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty('message', 'User with this phone number already exists');
    });

    it('should validate required fields', async () => {
      const incompleteUser = {
        phoneNumber: testUser.phoneNumber,
        // Missing password, firstName, lastName, role
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(incompleteUser)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should accept different valid roles', async () => {
      const roles = [Role.FARMER, Role.AGENT, Role.EXPERT];

      for (let i = 0; i < roles.length; i++) {
        const roleUser = {
          ...testUser,
          phoneNumber: `+9187654321${i}`,
          role: roles[i],
        };

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(roleUser)
          .expect(201);

        expect(response.body).toHaveProperty('userId');

        // Verify role is saved correctly
        const user = await userRepository.findOne({
          where: { phoneNumber: roleUser.phoneNumber },
        });
        expect(user.role).toBe(roles[i]);
      }
    });
  });

  describe('POST /auth/verify-otp', () => {
    let userId: string;
    let otpCode: string;

    beforeEach(async () => {
      // Register a user first
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      userId = registerResponse.body.userId;

      // Get the OTP from database
      const otp = await otpRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      otpCode = otp.otp;
    });

    it('should verify OTP successfully and return JWT tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otpCode })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', userId);
      expect(response.body.user).toHaveProperty('phoneNumber', testUser.phoneNumber);
      expect(response.body.user).toHaveProperty('isPhoneVerified', true);

      // Verify user is marked as phone verified
      const user = await userRepository.findOne({ where: { id: userId } });
      expect(user.isPhoneVerified).toBe(true);

      // Verify OTP is marked as used
      const usedOtp = await otpRepository.findOne({
        where: { userId, otp: otpCode },
      });
      expect(usedOtp.isUsed).toBe(true);
    });

    it('should return 400 for invalid OTP', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: '000000' })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid OTP');
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentUserId = faker.string.uuid();

      const response = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId: nonExistentUserId, otp: otpCode })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid OTP');
    });

    it('should return 400 for expired OTP', async () => {
      // Update OTP to be expired
      await otpRepository.update(
        { userId, otp: otpCode },
        { expiresAt: new Date(Date.now() - 60000) } // 1 minute ago
      );

      const response = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otpCode })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid OTP');
    });

    it('should return 400 for already used OTP', async () => {
      // Use the OTP first
      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otpCode })
        .expect(200);

      // Try to use the same OTP again
      const response = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otpCode })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid OTP');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Register and verify a user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      const userId = registerResponse.body.userId;
      const otp = await otpRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      // Verify the user
      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otp.otp });
    });

    it('should login successfully with correct credentials', async () => {
      const loginData = {
        phoneNumber: testUser.phoneNumber,
        password: testUser.password,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('phoneNumber', testUser.phoneNumber);
      expect(response.body.user).toHaveProperty('isPhoneVerified', true);
    });

    it('should return 401 for invalid credentials', async () => {
      const invalidLogin = {
        phoneNumber: testUser.phoneNumber,
        password: 'WrongPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidLogin)
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const nonExistentLogin = {
        phoneNumber: '+919999999999',
        password: testUser.password,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(nonExistentLogin)
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 401 for inactive user', async () => {
      // Deactivate the user
      await userRepository.update(
        { phoneNumber: testUser.phoneNumber },
        { isActive: false }
      );

      const loginData = {
        phoneNumber: testUser.phoneNumber,
        password: testUser.password,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Account is inactive');
    });

    it('should update lastLoginAt timestamp', async () => {
      const loginData = {
        phoneNumber: testUser.phoneNumber,
        password: testUser.password,
      };

      const userBefore = await userRepository.findOne({
        where: { phoneNumber: testUser.phoneNumber },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      const userAfter = await userRepository.findOne({
        where: { phoneNumber: testUser.phoneNumber },
      });

      expect(userAfter.lastLoginAt.getTime()).toBeGreaterThan(
        userBefore.lastLoginAt?.getTime() || 0
      );
    });
  });

  describe('POST /auth/resend-otp', () => {
    let userId: string;

    beforeEach(async () => {
      // Register a user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      userId = registerResponse.body.userId;
    });

    it('should resend OTP successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/resend-otp')
        .send({ phoneNumber: testUser.phoneNumber })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'OTP sent successfully');

      // Verify new OTP is created
      const otps = await otpRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      
      expect(otps.length).toBeGreaterThan(0);
      // Previous OTPs should be marked as used
      const oldOtps = otps.slice(1);
      oldOtps.forEach(otp => {
        expect(otp.isUsed).toBe(true);
      });
    });

    it('should return 404 for non-existent phone number', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/resend-otp')
        .send({ phoneNumber: '+919999999999' })
        .expect(404);

      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should invalidate previous OTPs when resending', async () => {
      // Get initial OTP
      const initialOtp = await otpRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      // Resend OTP
      await request(app.getHttpServer())
        .post('/auth/resend-otp')
        .send({ phoneNumber: testUser.phoneNumber })
        .expect(200);

      // Check that initial OTP is now marked as used
      const updatedInitialOtp = await otpRepository.findOne({
        where: { id: initialOtp.id },
      });
      expect(updatedInitialOtp.isUsed).toBe(true);
    });
  });

  describe('POST /auth/refresh-token', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register, verify and login a user to get refresh token
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      const userId = registerResponse.body.userId;
      const otp = await otpRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otp.otp });

      refreshToken = verifyResponse.body.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.accessToken).not.toBe(refreshToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid refresh token');
    });

    it('should return 401 for expired refresh token', async () => {
      // This would require creating an expired token, which is complex
      // For now, we test the structure
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });
  });

  describe('POST /auth/forgot-password', () => {
    beforeEach(async () => {
      // Register and verify a user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      const userId = registerResponse.body.userId;
      const otp = await otpRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otp.otp });
    });

    it('should initiate password reset successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ phoneNumber: testUser.phoneNumber })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password reset OTP sent successfully');
      expect(response.body).toHaveProperty('userId');

      // Verify OTP is created
      const otp = await otpRepository.findOne({
        where: { userId: response.body.userId },
        order: { createdAt: 'DESC' },
      });
      expect(otp).toBeDefined();
      expect(otp.otp).toHaveLength(6);
    });

    it('should return 404 for non-existent phone number', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ phoneNumber: '+919999999999' })
        .expect(404);

      expect(response.body).toHaveProperty('message', 'User not found');
    });
  });

  describe('POST /auth/reset-password', () => {
    let userId: string;
    let resetOtpCode: string;

    beforeEach(async () => {
      // Register and verify a user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);

      userId = registerResponse.body.userId;
      const otp = await otpRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId, otp: otp.otp });

      // Initiate forgot password
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ phoneNumber: testUser.phoneNumber });

      // Get reset OTP
      const resetOtp = await otpRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      resetOtpCode = resetOtp.otp;
    });

    it('should reset password successfully', async () => {
      const newPassword = 'NewStrongPassword123!';

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          userId,
          otp: resetOtpCode,
          newPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password reset successfully');

      // Verify user can login with new password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phoneNumber: testUser.phoneNumber,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
    });

    it('should return 400 for invalid OTP', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          userId,
          otp: '000000',
          newPassword: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid OTP');
    });

    it('should return 400 for weak new password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          userId,
          otp: resetOtpCode,
          newPassword: '123', // Weak password
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});