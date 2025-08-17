import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'Phone number for password reset',
    example: '+919876543210',
  })
  @IsPhoneNumber('IN')
  phone: string;
}