import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryFarmsDto {
  @ApiProperty({
    description: 'Filter by farm owner ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({
    description: 'Filter by certification status',
    enum: ['not_applied', 'in_progress', 'certified', 'expired', 'rejected'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['not_applied', 'in_progress', 'certified', 'expired', 'rejected'])
  certificationStatus?: string;

  @ApiProperty({
    description: 'Filter by organic certification status',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  organicCertified?: boolean;

  @ApiProperty({
    description: 'Filter by soil type',
    required: false,
  })
  @IsOptional()
  @IsString()
  soilType?: string;

  @ApiProperty({
    description: 'Filter by state',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Filter by district',
    required: false,
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({
    description: 'Search by farm name, address, or village',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}