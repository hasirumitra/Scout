import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryCropsDto {
  @ApiProperty({
    description: 'Filter by crop category',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Filter by growing season',
    enum: ['kharif', 'rabi', 'zaid', 'summer', 'winter', 'year-round'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['kharif', 'rabi', 'zaid', 'summer', 'winter', 'year-round'])
  season?: string;

  @ApiProperty({
    description: 'Search by crop name, scientific name, or description',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by organic suitability',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  organicSuitable?: boolean;

  @ApiProperty({
    description: 'Filter by cultivation difficulty',
    enum: ['easy', 'moderate', 'difficult'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['easy', 'moderate', 'difficult'])
  difficulty?: string;

  @ApiProperty({
    description: 'Filter by active status',
    default: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}