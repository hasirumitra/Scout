import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { CropsService } from './crops.service';
import { CropCultivationsService } from './services/crop-cultivations.service';
import { CultivationActivitiesService } from './services/cultivation-activities.service';
import { CropAnalyticsService } from './services/crop-analytics.service';
import { CropRecommendationService } from './services/crop-recommendation.service';
import { CropsController } from './crops.controller';
import { CropCultivationsController } from './controllers/crop-cultivations.controller';
import { CultivationActivitiesController } from './controllers/cultivation-activities.controller';

import { Crop } from './entities/crop.entity';
import { CropCultivation } from './entities/crop-cultivation.entity';
import { CultivationActivity } from './entities/cultivation-activity.entity';
import { Farm } from '../farms/entities/farm.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Crop,
      CropCultivation,
      CultivationActivity,
      Farm,
      User,
    ]),
    BullModule.registerQueue({
      name: 'crop-analytics',
    }),
    BullModule.registerQueue({
      name: 'crop-recommendations',
    }),
    BullModule.registerQueue({
      name: 'cultivation-tracking',
    }),
  ],
  providers: [
    CropsService,
    CropCultivationsService,
    CultivationActivitiesService,
    CropAnalyticsService,
    CropRecommendationService,
  ],
  controllers: [
    CropsController,
    CropCultivationsController,
    CultivationActivitiesController,
  ],
  exports: [
    CropsService,
    CropCultivationsService,
    CultivationActivitiesService,
    CropAnalyticsService,
    CropRecommendationService,
  ],
})
export class CropsModule {}