import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    description: 'Enable SMS notifications',
    example: true,
  })
  @IsBoolean()
  sms: boolean;

  @ApiProperty({
    description: 'Enable email notifications',
    example: true,
  })
  @IsBoolean()
  email: boolean;

  @ApiProperty({
    description: 'Enable push notifications',
    example: true,
  })
  @IsBoolean()
  push: boolean;

  @ApiProperty({
    description: 'Enable WhatsApp notifications',
    example: false,
  })
  @IsBoolean()
  whatsapp: boolean;
}