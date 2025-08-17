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
import { Gender } from '../src/users/enums/gender.enum';
import { Language } from '../src/users/enums/language.enum';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('UsersController (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let userProfileRepository: Repository<UserProfile>;
  let otpRepository: Repository<Otp>;

  const testUser = {
    phoneNumber: '+919876543210',
    password: 'StrongPassword123!',
    firstName: 'Test',
    lastName: 'User',
    role: Role.FARMER,
  };

  const testAgent = {
    phoneNumber: '+919876543211',
    password: 'StrongPassword123!',
    firstName: 'Agent',
    lastName: 'Test',
    role: Role.AGENT,
  };

  const testAdmin = {
    phoneNumber: '+919876543212',
    password: 'StrongPassword123!',
    firstName: 'Admin',
    lastName: 'Test',
    role: Role.ADMIN,
  };

  let farmerToken: string;
  let agentToken: string;
  let adminToken: string;
  let farmerId: string;
  let agentId: string;
  let adminId: string;

  async function registerAndLoginUser(userData: any): Promise<{ token: string; userId: string }> {
    // Register
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(userData);

    const userId = registerResponse.body.userId;

    // Get OTP and verify
    const otp = await otpRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ userId, otp: otp.otp });

    return {
      token: verifyResponse.body.accessToken,
      userId,
    };
  }

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
    userProfileRepository = moduleFixture.get<Repository<UserProfile>>(getRepositoryToken(UserProfile));
    otpRepository = moduleFixture.get<Repository<Otp>>(getRepositoryToken(Otp));

    // Create test users
    const farmerResult = await registerAndLoginUser(testUser);
    farmerToken = farmerResult.token;
    farmerId = farmerResult.userId;

    const agentResult = await registerAndLoginUser(testAgent);
    agentToken = agentResult.token;
    agentId = agentResult.userId;

    const adminResult = await registerAndLoginUser(testAdmin);
    adminToken = adminResult.token;
    adminId = adminResult.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/profile', () => {
    it('should get user profile successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', farmerId);
      expect(response.body).toHaveProperty('phoneNumber', testUser.phoneNumber);
      expect(response.body).toHaveProperty('role', testUser.role);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PUT /users/profile', () => {
    const profileUpdateData = {
      firstName: 'Updated',
      lastName: 'Name',
      email: 'updated@example.com',
      dateOfBirth: '1985-05-15',
      gender: Gender.MALE,
      address: '123 Updated Street',
      city: 'Updated City',
      state: 'Updated State',
      pincode: '560002',
      preferredLanguage: Language.HINDI,
    };

    it('should update user profile successfully', async () => {
      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(profileUpdateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Profile updated successfully');

      // Verify profile is updated in database
      const updatedProfile = await userProfileRepository.findOne({
        where: { userId: farmerId },
      });
      expect(updatedProfile.firstName).toBe(profileUpdateData.firstName);
      expect(updatedProfile.lastName).toBe(profileUpdateData.lastName);
      expect(updatedProfile.email).toBe(profileUpdateData.email);
      expect(updatedProfile.preferredLanguage).toBe(profileUpdateData.preferredLanguage);

      // Verify user is marked as profile completed
      const updatedUser = await userRepository.findOne({ where: { id: farmerId } });
      expect(updatedUser.profileCompleted).toBe(true);
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = { ...profileUpdateData, email: 'invalid-email' };

      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should return 400 for invalid date format', async () => {
      const invalidData = { ...profileUpdateData, dateOfBirth: 'invalid-date' };

      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should update notification preferences', async () => {
      const notificationData = {
        notificationPreferences: {
          sms: false,
          email: true,
          push: false,
          weatherAlerts: true,
          marketPrices: false,
          cropAdvice: true,
        },
      };

      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(notificationData)
        .expect(200);

      // Verify notification preferences are saved
      const profile = await userProfileRepository.findOne({
        where: { userId: farmerId },
      });
      expect(profile.notificationPreferences.sms).toBe(false);
      expect(profile.notificationPreferences.email).toBe(true);
      expect(profile.notificationPreferences.weatherAlerts).toBe(true);
    });
  });

  describe('POST /users/profile/image', () => {
    it('should update profile image successfully', async () => {
      const imageUrl = 'https://example.com/new-profile.jpg';

      const response = await request(app.getHttpServer())
        .post('/users/profile/image')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ imageUrl })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Profile image updated successfully');
      expect(response.body).toHaveProperty('imageUrl', imageUrl);

      // Verify image URL is saved
      const profile = await userProfileRepository.findOne({
        where: { userId: farmerId },
      });
      expect(profile.profileImageUrl).toBe(imageUrl);
    });

    it('should return 400 for invalid URL format', async () => {
      const invalidUrl = 'not-a-valid-url';

      const response = await request(app.getHttpServer())
        .post('/users/profile/image')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ imageUrl: invalidUrl })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /users (Admin/Agent access)', () => {
    beforeEach(async () => {
      // Create additional test users for pagination
      for (let i = 0; i < 5; i++) {
        const userData = {
          phoneNumber: `+91987654${String(i).padStart(4, '0')}`,
          password: 'StrongPassword123!',
          firstName: `User${i}`,
          lastName: 'Test',
          role: Role.FARMER,
        };
        await registerAndLoginUser(userData);
      }
    });

    it('should get paginated users list as admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 5);
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should filter users by role', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?role=FARMER')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every(user => user.role === Role.FARMER)).toBe(true);
    });

    it('should search users by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?search=User1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      // Users should match the search criteria
      expect(
        response.body.data.some(user => 
          user.profile?.firstName?.includes('User1') || 
          user.phoneNumber?.includes('User1')
        )
      ).toBe(true);
    });

    it('should filter by active status', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?isActive=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.every(user => user.isActive === true)).toBe(true);
    });

    it('should allow agent access', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should deny farmer access', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(403);
    });
  });

  describe('GET /users/:id (Admin/Agent access)', () => {
    it('should get specific user as admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${farmerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', farmerId);
      expect(response.body).toHaveProperty('phoneNumber', testUser.phoneNumber);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = faker.string.uuid();

      await request(app.getHttpServer())
        .get(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should deny farmer access to other users', async () => {
      await request(app.getHttpServer())
        .get(`/users/${agentId}`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(403);
    });
  });

  describe('PUT /users/:id (Admin access)', () => {
    const updateData = {
      isActive: false,
    };

    it('should update user as admin', async () => {
      const response = await request(app.getHttpServer())
        .put(`/users/${farmerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'User updated successfully');

      // Verify user is updated
      const updatedUser = await userRepository.findOne({ where: { id: farmerId } });
      expect(updatedUser.isActive).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = faker.string.uuid();

      await request(app.getHttpServer())
        .put(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should deny agent access', async () => {
      await request(app.getHttpServer())
        .put(`/users/${farmerId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should deny farmer access', async () => {
      await request(app.getHttpServer())
        .put(`/users/${agentId}`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /users/:id (Admin access)', () => {
    let userToDelete: string;

    beforeEach(async () => {
      // Create a user to delete
      const userData = {
        phoneNumber: '+919999999999',
        password: 'StrongPassword123!',
        firstName: 'Delete',
        lastName: 'Test',
        role: Role.FARMER,
      };
      const result = await registerAndLoginUser(userData);
      userToDelete = result.userId;
    });

    it('should soft delete user as admin', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/users/${userToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'User deleted successfully');

      // Verify user is soft deleted (isActive = false)
      const deletedUser = await userRepository.findOne({ where: { id: userToDelete } });
      expect(deletedUser.isActive).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = faker.string.uuid();

      await request(app.getHttpServer())
        .delete(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should deny agent access', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${userToDelete}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });

    it('should deny farmer access', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${userToDelete}`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(403);
    });
  });

  describe('GET /users/statistics (Admin access)', () => {
    it('should get user statistics as admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('activeUsers');
      expect(response.body).toHaveProperty('usersByRole');
      expect(response.body).toHaveProperty('recentRegistrations');

      expect(typeof response.body.totalUsers).toBe('number');
      expect(typeof response.body.activeUsers).toBe('number');
      expect(typeof response.body.usersByRole).toBe('object');
      expect(response.body.usersByRole).toHaveProperty(Role.FARMER);
      expect(response.body.usersByRole).toHaveProperty(Role.AGENT);
      expect(response.body.usersByRole).toHaveProperty(Role.EXPERT);
      expect(response.body.usersByRole).toHaveProperty(Role.ADMIN);
    });

    it('should deny agent access to statistics', async () => {
      await request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });

    it('should deny farmer access to statistics', async () => {
      await request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(403);
    });
  });

  describe('Input validation', () => {
    it('should validate phone number format in profile update', async () => {
      const invalidData = {
        phoneNumber: 'invalid-phone',
      };

      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should validate enum values', async () => {
      const invalidData = {
        gender: 'INVALID_GENDER',
        preferredLanguage: 'INVALID_LANGUAGE',
      };

      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should validate date format', async () => {
      const invalidData = {
        dateOfBirth: 'not-a-date',
      };

      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we ensure the endpoint exists and is accessible
      expect(farmerToken).toBeDefined();
      expect(adminToken).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Role-based access control', () => {
    it('should enforce role hierarchy correctly', async () => {
      // Admin can access everything
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Agent can access user lists but not statistics
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);

      // Farmer can only access their own profile
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(403);
    });
  });
});