import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private readonly configService: ConfigService) {}

  async uploadFile(file: Express.Multer.File, directory: string): Promise<string> {
    this.logger.log(`File upload service called for directory: ${directory}`);
    
    return `${this.configService.get('app.baseUrl')}/uploads/${directory}/${file.filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    this.logger.log(`File deletion requested: ${fileUrl}`);
  }
}