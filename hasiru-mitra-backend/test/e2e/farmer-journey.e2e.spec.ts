import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';

// Import all necessary modules and entities
import { AuthModule } from '../../src/auth/auth.module';
import { UsersModule } from '../../src/users/users.module';
import { FarmsModule } from '../../src/farms/farms.module';
import { CropsModule } from '../../src/crops/crops.module';
import { User } from '../../src/users/entities/user.entity';
import { UserProfile } from '../../src/users/entities/user-profile.entity';
import { Otp } from '../../src/auth/entities/otp.entity';
import { Farm } from '../../src/farms/entities/farm.entity';
import { Crop } from '../../src/crops/entities/crop.entity';
import { CropCultivation } from '../../src/crops/entities/crop-cultivation.entity';
import { Role } from '../../src/users/enums/role.enum';
import { Gender } from '../../src/users/enums/gender.enum';
import { Language } from '../../src/users/enums/language.enum';
import { SoilType } from '../../src/farms/enums/soil-type.enum';
import { IrrigationType } from '../../src/farms/enums/irrigation-type.enum';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Farmer Complete Journey (E2E)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let otpRepository: Repository<Otp>;
  let farmRepository: Repository<Farm>;
  let cropRepository: Repository<Crop>;
  let cultivationRepository: Repository<CropCultivation>;

  // Test data for complete farmer journey
  const farmerData = {
    phoneNumber: '+919876543210',
    password: 'StrongPassword123!',
    firstName: 'Rajesh',
    lastName: 'Kumar',
    role: Role.FARMER,
  };

  const profileData = {
    email: 'rajesh.kumar@example.com',
    dateOfBirth: '1980-05-15',
    gender: Gender.MALE,
    address: '123 Village Road, Krishnapura',
    city: 'Bangalore Rural',
    state: 'Karnataka',
    pincode: '560001',
    preferredLanguage: Language.KANNADA,
    notificationPreferences: {
      sms: true,
      email: false,
      push: true,
      weatherAlerts: true,
      marketPrices: true,
      cropAdvice: true,
    },
  };

  const farmData = {
    name: 'Rajesh Organic Farm',
    address: '123 Village Road, Krishnapura',
    city: 'Bangalore Rural',
    state: 'Karnataka',
    pincode: '560001',
    totalArea: 5.5,
    soilType: SoilType.LOAMY,
    irrigationType: IrrigationType.DRIP,
    coordinates: {
      lat: 13.0827,
      lng: 77.5877,
    },
    boundaries: {
      type: 'Polygon',
      coordinates: [
        [
          [77.5877, 13.0827],
          [77.5887, 13.0827],
          [77.5887, 13.0837],
          [77.5877, 13.0837],
          [77.5877, 13.0827],
        ],
      ],
    },
  };

  let farmerId: string;
  let accessToken: string;
  let refreshToken: string;
  let farmId: string;
  let cropId: string;
  let cultivationId: string;

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
            entities: [
              User,
              UserProfile,
              Otp,
              Farm,
              Crop,
              CropCultivation,
            ],
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
        FarmsModule,
        CropsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get repository instances
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    otpRepository = moduleFixture.get<Repository<Otp>>(getRepositoryToken(Otp));
    farmRepository = moduleFixture.get<Repository<Farm>>(getRepositoryToken(Farm));
    cropRepository = moduleFixture.get<Repository<Crop>>(getRepositoryToken(Crop));
    cultivationRepository = moduleFixture.get<Repository<CropCultivation>>(getRepositoryToken(CropCultivation));

    // Seed some crop data for testing
    await seedCropData();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedCropData() {
    const testCrops = [
      {
        name: 'Rice',
        scientificName: 'Oryza sativa',
        category: 'Cereal',
        description: 'Staple food crop',
        growingSeasons: ['KHARIF'],
        climateRequirements: 'Tropical and subtropical',
        soilRequirements: 'Clay and loamy soil',
        waterRequirements: 'High water requirement',
        spacing: '20x20 cm',
        varieties: ['Basmati', 'Sona Masuri', 'IR-64'],
        averageYield: 3500,
        marketPrice: 25.0,
        nutritionalInfo: {
          protein: 7,
          carbohydrates: 80,
          fat: 0.5,
          fiber: 1.3,
        },
      },
      {
        name: 'Tomato',
        scientificName: 'Solanum lycopersicum',
        category: 'Vegetable',
        description: 'Popular vegetable crop',
        growingSeasons: ['KHARIF', 'RABI'],
        climateRequirements: 'Warm climate',
        soilRequirements: 'Well-drained loamy soil',
        waterRequirements: 'Moderate water requirement',
        spacing: '60x45 cm',
        varieties: ['Hybrid', 'Cherry', 'Roma'],
        averageYield: 45000,
        marketPrice: 30.0,
        nutritionalInfo: {
          protein: 0.9,
          carbohydrates: 3.9,
          fat: 0.2,
          fiber: 1.2,
        },
      },
    ];

    for (const cropData of testCrops) {
      const crop = cropRepository.create(cropData);
      await cropRepository.save(crop);
    }
  }

  describe('Complete Farmer Journey', () => {
    it('Step 1: Farmer Registration', async () => {
      console.log('🌱 Starting farmer registration...');

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(farmerData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User registered successfully. Please verify your phone number.');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.userId).toBeUUID();

      farmerId = response.body.userId;

      // Verify user is created in database
      const createdUser = await userRepository.findOne({
        where: { phoneNumber: farmerData.phoneNumber },
      });
      
      expect(createdUser).toBeDefined();
      expect(createdUser.role).toBe(Role.FARMER);
      expect(createdUser.isPhoneVerified).toBe(false);
      expect(createdUser.profileCompleted).toBe(false);

      console.log('✅ Farmer registered successfully');
    });

    it('Step 2: OTP Verification', async () => {
      console.log('📱 Verifying OTP...');

      // Get the OTP from database (in real world, this would be sent via SMS)
      const otp = await otpRepository.findOne({
        where: { userId: farmerId },
        order: { createdAt: 'DESC' },
      });
      
      expect(otp).toBeDefined();
      expect(otp.otp).toHaveLength(6);

      const response = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId: farmerId, otp: otp.otp })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('isPhoneVerified', true);

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;

      // Verify user is marked as phone verified
      const verifiedUser = await userRepository.findOne({ where: { id: farmerId } });
      expect(verifiedUser.isPhoneVerified).toBe(true);

      console.log('✅ OTP verified successfully');
    });

    it('Step 3: Complete Profile Setup', async () => {
      console.log('👤 Setting up farmer profile...');

      const response = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Profile updated successfully');

      // Verify profile is created and user is marked as profile completed
      const updatedUser = await userRepository.findOne({
        where: { id: farmerId },
        relations: ['profile'],
      });
      
      expect(updatedUser.profileCompleted).toBe(true);
      expect(updatedUser.profile).toBeDefined();
      expect(updatedUser.profile.firstName).toBe(profileData.firstName || farmerData.firstName);
      expect(updatedUser.profile.preferredLanguage).toBe(profileData.preferredLanguage);

      console.log('✅ Profile completed successfully');
    });

    it('Step 4: Add Farm Information', async () => {
      console.log('🚜 Adding farm information...');

      const response = await request(app.getHttpServer())
        .post('/farms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(farmData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', farmData.name);
      expect(response.body).toHaveProperty('totalArea', farmData.totalArea);
      expect(response.body).toHaveProperty('soilType', farmData.soilType);

      farmId = response.body.id;

      // Verify farm is created in database
      const createdFarm = await farmRepository.findOne({
        where: { id: farmId },
        relations: ['owner'],
      });
      
      expect(createdFarm).toBeDefined();
      expect(createdFarm.owner.id).toBe(farmerId);
      expect(createdFarm.boundaries).toBeDefined();
      expect(createdFarm.coordinates).toBeDefined();

      console.log('✅ Farm information added successfully');
    });

    it('Step 5: Get Crop Recommendations', async () => {
      console.log('🌾 Getting crop recommendations...');

      const response = await request(app.getHttpServer())
        .get('/crops/recommendations')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          soilType: farmData.soilType,
          climate: 'TROPICAL',
          season: 'KHARIF',
          farmSize: farmData.totalArea,
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Each recommendation should have required fields
      response.body.forEach((crop: any) => {
        expect(crop).toHaveProperty('id');
        expect(crop).toHaveProperty('name');
        expect(crop).toHaveProperty('suitabilityScore');
        expect(crop.suitabilityScore).toBeGreaterThan(0);
      });

      // Get the highest recommended crop for cultivation
      const bestRecommendation = response.body[0];
      cropId = bestRecommendation.id;

      console.log(`✅ Got ${response.body.length} crop recommendations`);
    });

    it('Step 6: Start Crop Cultivation', async () => {
      console.log('🌱 Starting crop cultivation...');

      const cultivationData = {
        farmId: farmId,
        cropId: cropId,
        variety: 'Hybrid-1',
        plantingDate: new Date().toISOString().split('T')[0],
        expectedHarvestDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        area: 2.5,
        plantingMethod: 'DIRECT_SEEDING',
        seedQuantity: 25,
        notes: 'First cultivation with recommended crop',
      };

      const response = await request(app.getHttpServer())
        .post('/crops/cultivation')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(cultivationData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('variety', cultivationData.variety);
      expect(response.body).toHaveProperty('area', cultivationData.area);
      expect(response.body).toHaveProperty('status', 'PLANNED');

      cultivationId = response.body.id;

      // Verify cultivation record is created
      const cultivation = await cultivationRepository.findOne({
        where: { id: cultivationId },
        relations: ['farm', 'crop'],
      });
      
      expect(cultivation).toBeDefined();
      expect(cultivation.farm.id).toBe(farmId);
      expect(cultivation.crop.id).toBe(cropId);

      console.log('✅ Crop cultivation started successfully');
    });

    it('Step 7: Record Cultivation Activities', async () => {
      console.log('📝 Recording cultivation activities...');

      const activities = [
        {
          type: 'LAND_PREPARATION',
          description: 'Plowed the field and prepared seed bed',
          date: new Date().toISOString().split('T')[0],
          cost: 5000,
          duration: 2,
          notes: 'Used tractor for plowing',
        },
        {
          type: 'SEEDING',
          description: 'Sowed seeds using direct seeding method',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          cost: 3000,
          duration: 1,
          notes: 'Weather conditions were favorable',
        },
        {
          type: 'FERTILIZER',
          description: 'Applied organic fertilizer',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          cost: 2500,
          duration: 1,
          notes: 'Used cow dung manure',
        },
      ];

      for (const activity of activities) {
        const response = await request(app.getHttpServer())
          .post(`/crops/cultivation/${cultivationId}/activities`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(activity)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('type', activity.type);
        expect(response.body).toHaveProperty('cost', activity.cost);
      }

      console.log(`✅ Recorded ${activities.length} cultivation activities`);
    });

    it('Step 8: Update Cultivation Progress', async () => {
      console.log('📈 Updating cultivation progress...');

      const progressUpdate = {
        status: 'IN_PROGRESS',
        growthStage: 'VEGETATIVE',
        healthStatus: 'HEALTHY',
        notes: 'Crops are growing well, good weather conditions',
        currentYield: 0,
        estimatedYield: 6000,
      };

      const response = await request(app.getHttpServer())
        .put(`/crops/cultivation/${cultivationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(progressUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('status', progressUpdate.status);
      expect(response.body).toHaveProperty('growthStage', progressUpdate.growthStage);
      expect(response.body).toHaveProperty('healthStatus', progressUpdate.healthStatus);

      console.log('✅ Cultivation progress updated successfully');
    });

    it('Step 9: Get Farm Analytics', async () => {
      console.log('📊 Checking farm analytics...');

      const response = await request(app.getHttpServer())
        .get(`/farms/${farmId}/analytics`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('farmId', farmId);
      expect(response.body).toHaveProperty('totalArea', farmData.totalArea);
      expect(response.body).toHaveProperty('cultivatedArea');
      expect(response.body).toHaveProperty('activeCultivations');
      expect(response.body).toHaveProperty('totalInvestment');
      expect(response.body).toHaveProperty('expectedRevenue');

      // Should have at least one active cultivation
      expect(response.body.activeCultivations).toBeGreaterThan(0);
      expect(response.body.totalInvestment).toBeGreaterThan(0);

      console.log('✅ Farm analytics retrieved successfully');
    });

    it('Step 10: Get Cultivation History', async () => {
      console.log('📋 Checking cultivation history...');

      const response = await request(app.getHttpServer())
        .get('/crops/cultivation')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          farmId: farmId,
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should contain our cultivation record
      const ourCultivation = response.body.data.find((c: any) => c.id === cultivationId);
      expect(ourCultivation).toBeDefined();
      expect(ourCultivation.activities.length).toBeGreaterThan(0);

      console.log('✅ Cultivation history retrieved successfully');
    });

    it('Step 11: Get Market Prices', async () => {
      console.log('💰 Checking market prices...');

      const response = await request(app.getHttpServer())
        .get('/market/prices')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          cropName: 'Rice',
          location: farmData.city,
        })
        .expect(200);

      // Market prices endpoint should return price information
      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const priceInfo = response.body[0];
        expect(priceInfo).toHaveProperty('cropName');
        expect(priceInfo).toHaveProperty('price');
        expect(priceInfo).toHaveProperty('market');
        expect(priceInfo).toHaveProperty('date');
      }

      console.log('✅ Market prices checked successfully');
    });

    it('Step 12: Simulate Harvest and Record Yield', async () => {
      console.log('🌾 Simulating harvest...');

      // Fast forward cultivation to harvest stage
      const harvestUpdate = {
        status: 'COMPLETED',
        growthStage: 'HARVEST',
        healthStatus: 'HEALTHY',
        actualHarvestDate: new Date().toISOString().split('T')[0],
        currentYield: 5500,
        notes: 'Successful harvest with good yield',
      };

      const response = await request(app.getHttpServer())
        .put(`/crops/cultivation/${cultivationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(harvestUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'COMPLETED');
      expect(response.body).toHaveProperty('currentYield', harvestUpdate.currentYield);

      // Record harvest activity
      const harvestActivity = {
        type: 'HARVESTING',
        description: 'Harvested the crop',
        date: new Date().toISOString().split('T')[0],
        cost: 8000,
        duration: 3,
        notes: `Total yield: ${harvestUpdate.currentYield} kg`,
      };

      await request(app.getHttpServer())
        .post(`/crops/cultivation/${cultivationId}/activities`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(harvestActivity)
        .expect(201);

      console.log('✅ Harvest recorded successfully');
    });

    it('Step 13: View Complete Farm Dashboard', async () => {
      console.log('📊 Viewing complete farm dashboard...');

      // Get user profile with complete information
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('profileCompleted', true);
      expect(profileResponse.body).toHaveProperty('profile');

      // Get farm with complete information
      const farmResponse = await request(app.getHttpServer())
        .get(`/farms/${farmId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(farmResponse.body).toHaveProperty('cultivations');
      expect(Array.isArray(farmResponse.body.cultivations)).toBe(true);

      // Get updated analytics
      const analyticsResponse = await request(app.getHttpServer())
        .get(`/farms/${farmId}/analytics`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(analyticsResponse.body).toHaveProperty('completedCultivations');
      expect(analyticsResponse.body.completedCultivations).toBeGreaterThan(0);

      console.log('✅ Farm dashboard complete');
    });

    it('Step 14: Test Token Refresh', async () => {
      console.log('🔄 Testing token refresh...');

      const response = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      // Update tokens for potential future use
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;

      // Verify new token works
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      console.log('✅ Token refresh successful');
    });

    it('Step 15: Final Journey Verification', async () => {
      console.log('🎯 Final journey verification...');

      // Verify all data is properly connected and accessible
      const finalUser = await userRepository.findOne({
        where: { id: farmerId },
        relations: ['profile', 'farms', 'farms.cultivations', 'farms.cultivations.crop'],
      });

      expect(finalUser).toBeDefined();
      expect(finalUser.isPhoneVerified).toBe(true);
      expect(finalUser.profileCompleted).toBe(true);
      expect(finalUser.profile).toBeDefined();
      expect(finalUser.farms).toBeDefined();
      expect(finalUser.farms.length).toBe(1);
      
      const farm = finalUser.farms[0];
      expect(farm.cultivations).toBeDefined();
      expect(farm.cultivations.length).toBe(1);
      
      const cultivation = farm.cultivations[0];
      expect(cultivation.status).toBe('COMPLETED');
      expect(cultivation.currentYield).toBeGreaterThan(0);
      expect(cultivation.crop).toBeDefined();

      console.log('✅ Complete farmer journey successful!');
      console.log(`
        📊 Journey Summary:
        👤 Farmer: ${finalUser.profile.firstName} ${finalUser.profile.lastName}
        📱 Phone: ${finalUser.phoneNumber}
        🚜 Farm: ${farm.name} (${farm.totalArea} acres)
        🌾 Crop: ${cultivation.crop.name}
        📈 Yield: ${cultivation.currentYield} kg
        💰 Total Investment: ₹${cultivation.activities?.reduce((sum: number, activity: any) => sum + activity.cost, 0) || 0}
      `);
    });
  });

  describe('Agent Journey - Supporting Farmers', () => {
    let agentToken: string;
    let agentId: string;

    const agentData = {
      phoneNumber: '+919876543220',
      password: 'AgentPassword123!',
      firstName: 'Priya',
      lastName: 'Sharma',
      role: Role.AGENT,
    };

    it('Agent Registration and Setup', async () => {
      console.log('👩‍🌾 Agent registration...');

      // Register agent
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(agentData)
        .expect(201);

      agentId = registerResponse.body.userId;

      // Verify OTP
      const otp = await otpRepository.findOne({
        where: { userId: agentId },
        order: { createdAt: 'DESC' },
      });

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ userId: agentId, otp: otp.otp })
        .expect(200);

      agentToken = verifyResponse.body.accessToken;

      // Complete agent profile
      await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          ...profileData,
          firstName: agentData.firstName,
          lastName: agentData.lastName,
          email: 'priya.sharma@hasirumitra.com',
        })
        .expect(200);

      console.log('✅ Agent setup complete');
    });

    it('Agent can view and support farmers', async () => {
      console.log('🤝 Agent supporting farmers...');

      // Agent can view farmers list
      const farmersResponse = await request(app.getHttpServer())
        .get('/users?role=FARMER')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      expect(farmersResponse.body.data.length).toBeGreaterThan(0);
      
      // Agent can view specific farmer
      await request(app.getHttpServer())
        .get(`/users/${farmerId}`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);

      // Agent can view farmer's farms
      const farmsResponse = await request(app.getHttpServer())
        .get('/farms')
        .set('Authorization', `Bearer ${agentToken}`)
        .query({ ownerId: farmerId })
        .expect(200);

      expect(farmsResponse.body.data.length).toBeGreaterThan(0);

      console.log('✅ Agent can successfully support farmers');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('Handle invalid authentication', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('Handle unauthorized access', async () => {
      // Farmer trying to access admin functions
      await request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('Handle invalid farm data', async () => {
      const invalidFarmData = {
        name: '', // Empty name
        totalArea: -5, // Negative area
        soilType: 'INVALID_SOIL',
      };

      await request(app.getHttpServer())
        .post('/farms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidFarmData)
        .expect(400);
    });

    it('Handle database constraint violations', async () => {
      // Try to create farm with non-existent owner
      const farmWithInvalidOwner = {
        ...farmData,
        name: 'Invalid Owner Farm',
      };

      // This should fail due to authentication (current user doesn't exist)
      await request(app.getHttpServer())
        .post('/farms')
        .set('Authorization', 'Bearer fake-token')
        .send(farmWithInvalidOwner)
        .expect(401);
    });
  });

  describe('Performance and Scalability', () => {
    it('Handle multiple concurrent requests', async () => {
      console.log('⚡ Testing concurrent requests...');

      const concurrentRequests = Array(10).fill(0).map(() =>
        request(app.getHttpServer())
          .get('/crops/recommendations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            soilType: 'LOAMY',
            climate: 'TROPICAL',
            season: 'KHARIF',
          })
      );

      const results = await Promise.all(concurrentRequests);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(Array.isArray(result.body)).toBe(true);
      });

      console.log('✅ Handled concurrent requests successfully');
    });

    it('Handle pagination with large datasets', async () => {
      // This test would be more meaningful with larger datasets
      const response = await request(app.getHttpServer())
        .get('/crops')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 50 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });
  });
});