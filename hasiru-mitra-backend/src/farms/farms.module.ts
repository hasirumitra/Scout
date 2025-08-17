import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { FarmsService } from './farms.service';
import { FarmsController } from './farms.controller';
import { GeospatialService } from './services/geospatial.service';
import { FarmAnalyticsService } from './services/farm-analytics.service';
import { Farm } from './entities/farm.entity';
import { User } from '../users/entities/user.entity';
import { FileUploadService } from '../common/services/file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Farm, User]),
    BullModule.registerQueue({
      name: 'geospatial-processing',
    }),
    BullModule.registerQueue({
      name: 'farm-analytics',
    }),
  ],
  providers: [
    FarmsService,
    GeospatialService,
    FarmAnalyticsService,
    FileUploadService,
  ],
  controllers: [FarmsController],
  exports: [
    FarmsService,
    GeospatialService,
    FarmAnalyticsService,
  ],
})
export class FarmsModule {}