import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('file-processing')
    private readonly fileProcessingQueue: Queue,
  ) {}

  async uploadProfileImage(userId: string, file: Express.Multer.File): Promise<string> {
    try {
      const uploadDir = this.configService.get<string>('app.uploadDir', './uploads');
      const profileImagesDir = path.join(uploadDir, 'profile-images');
      
      await fs.mkdir(profileImagesDir, { recursive: true });

      const fileExtension = path.extname(file.originalname);
      const fileName = `${userId}-${uuidv4()}${fileExtension}`;
      const filePath = path.join(profileImagesDir, fileName);

      await fs.writeFile(filePath, file.buffer);

      await this.fileProcessingQueue.add('optimize-profile-image', {
        userId,
        originalPath: filePath,
        fileName,
      });

      const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
      const imageUrl = `${baseUrl}/uploads/profile-images/${fileName}`;

      this.logger.log(`Profile image uploaded for user ${userId}: ${imageUrl}`);

      return imageUrl;
    } catch (error) {
      this.logger.error(`Failed to upload profile image for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteProfileImage(imageUrl: string): Promise<void> {
    try {
      const fileName = path.basename(imageUrl);
      const uploadDir = this.configService.get<string>('app.uploadDir', './uploads');
      const filePath = path.join(uploadDir, 'profile-images', fileName);

      await fs.unlink(filePath);

      this.logger.log(`Profile image deleted: ${fileName}`);
    } catch (error) {
      this.logger.error(`Failed to delete profile image: ${imageUrl}`, error);
    }
  }

  async generateProfileStats(userId: string): Promise<{
    profileCompletion: number;
    missingFields: string[];
    recommendations: string[];
  }> {
    return {
      profileCompletion: 85,
      missingFields: ['bio', 'dateOfBirth'],
      recommendations: [
        'Add a bio to help others understand your farming experience',
        'Complete your date of birth for better age-specific recommendations',
      ],
    };
  }
}