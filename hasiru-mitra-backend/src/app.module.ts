import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as redisStore from 'cache-manager-redis-store';

// Configuration
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { jwtConfig } from './config/jwt.config';
import { appConfig } from './config/app.config';

// Feature Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FarmsModule } from './farms/farms.module';
import { CropsModule } from './crops/crops.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CertificationModule } from './certification/certification.module';
import { AdvisoryModule } from './advisory/advisory.module';
import { VoiceModule } from './voice/voice.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';

// Common
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('database.logging'),
        ssl: configService.get('NODE_ENV') === 'production' ? {
          rejectUnauthorized: false,
        } : false,
        extra: {
          max: 10, // Connection pool size
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
      inject: [ConfigService],
    }),

    // Cache (Redis)
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        password: configService.get('redis.password'),
        ttl: 300, // 5 minutes default TTL
        max: 100, // Maximum number of items in cache
      }),
      inject: [ConfigService],
      isGlobal: true,
    }),

    // Queue Management (Redis-based)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),

    // Task Scheduling
    ScheduleModule.forRoot(),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: 1000, // 1 second
          limit: 3, // 3 requests per second
        },
        {
          name: 'medium',
          ttl: 60000, // 1 minute
          limit: 20, // 20 requests per minute
        },
        {
          name: 'long',
          ttl: 3600000, // 1 hour
          limit: 100, // 100 requests per hour
        },
      ],
      inject: [ConfigService],
    }),

    // Event System
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Core Modules
    DatabaseModule,
    CommonModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    FarmsModule,
    CropsModule,
    MarketplaceModule,
    CertificationModule,
    AdvisoryModule,
    VoiceModule,
    NotificationsModule,
    AnalyticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor(private configService: ConfigService) {
    // Application startup logging
    console.log('🌱 Hasiru Mitra Backend Starting...');
    console.log(`📍 Environment: ${this.configService.get('NODE_ENV')}`);
    console.log(`🗄️  Database: ${this.configService.get('database.host')}:${this.configService.get('database.port')}`);
    console.log(`📡 Redis: ${this.configService.get('redis.host')}:${this.configService.get('redis.port')}`);
    console.log('✅ All modules loaded successfully');
  }
}