import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserProfileService } from './services/user-profile.service';
import { FileUploadService } from '../common/services/file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    BullModule.registerQueue({
      name: 'file-processing',
    }),
  ],
  providers: [
    UsersService,
    UserProfileService,
    FileUploadService,
  ],
  controllers: [UsersController],
  exports: [
    UsersService,
    UserProfileService,
  ],
})
export class UsersModule {}