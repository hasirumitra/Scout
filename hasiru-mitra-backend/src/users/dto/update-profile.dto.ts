import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsDateString,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({
    description: 'User bio/description',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({
    description: 'User gender',
    enum: ['male', 'female', 'other'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(['male', 'female', 'other'])
  gender?: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiProperty({
    description: 'User address',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiProperty({
    description: 'City',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({
    description: 'State',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({
    description: 'PIN Code',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pinCode?: string;

  @ApiProperty({
    description: 'Country',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({
    description: 'Preferred language',
    example: 'hi',
    enum: ['hi', 'en', 'kn'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(['hi', 'en', 'kn'])
  preferredLanguage?: string;

  @ApiProperty({
    description: 'Marketing consent',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}