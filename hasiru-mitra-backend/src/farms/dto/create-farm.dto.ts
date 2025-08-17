import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
  IsDecimal,
} from 'class-validator';
import { Type } from 'class-transformer';

class CoordinateDto {
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;
}

export class CreateFarmDto {
  @ApiProperty({
    description: 'Farm name',
    example: 'Green Valley Organic Farm',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Farm description',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'Farm area in specified units',
    example: 5.5,
  })
  @IsNumber()
  @Min(0.1)
  area: number;

  @ApiProperty({
    description: 'Area measurement unit',
    example: 'acres',
    enum: ['acres', 'hectares', 'sqft', 'sqm'],
    default: 'acres',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['acres', 'hectares', 'sqft', 'sqm'])
  areaUnit?: string;

  @ApiProperty({
    description: 'Farm latitude coordinate',
    example: 12.9716,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Farm longitude coordinate',
    example: 77.5946,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    description: 'Farm boundary coordinates (array of [lng, lat] pairs)',
    required: false,
    type: [[Number]],
    example: [[77.5946, 12.9716], [77.5950, 12.9716], [77.5950, 12.9720], [77.5946, 12.9720], [77.5946, 12.9716]],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => Array)
  boundaryCoordinates?: number[][];

  @ApiProperty({
    description: 'Farm address',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiProperty({
    description: 'Village name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  village?: string;

  @ApiProperty({
    description: 'District name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiProperty({
    description: 'State name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({
    description: 'PIN code',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pinCode?: string;

  @ApiProperty({
    description: 'Country',
    default: 'India',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({
    description: 'Soil type',
    required: false,
    example: 'Clay Loam',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  soilType?: string;

  @ApiProperty({
    description: 'Soil pH level',
    required: false,
    example: 6.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(14)
  soilPh?: number;

  @ApiProperty({
    description: 'Water source',
    required: false,
    example: 'Borewell',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  waterSource?: string;

  @ApiProperty({
    description: 'Irrigation type',
    required: false,
    example: 'Drip Irrigation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  irrigationType?: string;

  @ApiProperty({
    description: 'Organic certification status',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  organicCertified?: boolean;

  @ApiProperty({
    description: 'Certification status',
    enum: ['not_applied', 'in_progress', 'certified', 'expired', 'rejected'],
    default: 'not_applied',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(['not_applied', 'in_progress', 'certified', 'expired', 'rejected'])
  certificationStatus?: string;

  @ApiProperty({
    description: 'Certification number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  certificationNumber?: string;

  @ApiProperty({
    description: 'Certification authority',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  certificationAuthority?: string;

  @ApiProperty({
    description: 'Certification date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  certificationDate?: Date;

  @ApiProperty({
    description: 'Certification expiry date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  certificationExpiry?: Date;

  @ApiProperty({
    description: 'Farm type',
    example: 'individual',
    enum: ['individual', 'group', 'cooperative', 'corporate'],
    default: 'individual',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(['individual', 'group', 'cooperative', 'corporate'])
  farmType?: string;

  @ApiProperty({
    description: 'Farming methods used',
    required: false,
    type: [String],
    example: ['organic', 'biodynamic', 'permaculture'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  farmingMethods?: string[];

  @ApiProperty({
    description: 'Main crops grown',
    required: false,
    type: [String],
    example: ['rice', 'wheat', 'vegetables'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mainCrops?: string[];

  @ApiProperty({
    description: 'Registration number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiProperty({
    description: 'Survey number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  surveyNumber?: string;

  @ApiProperty({
    description: 'Khata number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  khataNumber?: string;

  @ApiProperty({
    description: 'Ownership type',
    example: 'owned',
    enum: ['owned', 'leased', 'shared'],
    default: 'owned',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(['owned', 'leased', 'shared'])
  ownershipType?: string;

  @ApiProperty({
    description: 'Farm establishment date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  farmEstablishmentDate?: Date;

  @ApiProperty({
    description: 'Organic conversion start date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  conversionStartDate?: Date;

  @ApiProperty({
    description: 'Conversion period in years',
    default: 3,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  conversionPeriodYears?: number;

  @ApiProperty({
    description: 'Distance to nearest market in kilometers',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  nearestMarketDistance?: number;

  @ApiProperty({
    description: 'Accessibility rating (1-5)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  accessibilityRating?: number;

  @ApiProperty({
    description: 'Labor availability',
    required: false,
    enum: ['abundant', 'adequate', 'scarce'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['abundant', 'adequate', 'scarce'])
  laborAvailability?: string;

  @ApiProperty({
    description: 'Equipment owned',
    required: false,
    type: [String],
    example: ['tractor', 'plough', 'harvester'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentOwned?: string[];
}