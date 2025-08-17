import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({
    description: 'User ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'OTP type',
    enum: ['phone_verification', 'password_reset', 'login'],
    example: 'phone_verification',
  })
  @IsString()
  @IsEnum(['phone_verification', 'password_reset', 'login'])
  type: string;
}