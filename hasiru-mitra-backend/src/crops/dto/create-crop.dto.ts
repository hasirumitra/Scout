import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsUrl,
} from 'class-validator';

export class CreateCropDto {
  @ApiProperty({
    description: 'Crop name',
    example: 'Rice',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Scientific name of the crop',
    required: false,
    example: 'Oryza sativa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  scientificName?: string;

  @ApiProperty({
    description: 'Crop category',
    example: 'cereals',
  })
  @IsString()
  @MaxLength(50)
  category: string;

  @ApiProperty({
    description: 'Growing season',
    example: 'kharif',
    enum: ['kharif', 'rabi', 'zaid', 'summer', 'winter', 'year-round'],
  })
  @IsString()
  @IsEnum(['kharif', 'rabi', 'zaid', 'summer', 'winter', 'year-round'])
  season: string;

  @ApiProperty({
    description: 'Growing period in days',
    example: 120,
  })
  @IsNumber()
  @Min(1)
  @Max(730)
  growingPeriodDays: number;

  @ApiProperty({
    description: 'Crop description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Minimum ideal temperature in Celsius',
    required: false,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(-10)
  @Max(60)
  idealTemperatureMin?: number;

  @ApiProperty({
    description: 'Maximum ideal temperature in Celsius',
    required: false,
    example: 35,
  })
  @IsOptional()
  @IsNumber()
  @Min(-10)
  @Max(60)
  idealTemperatureMax?: number;

  @ApiProperty({
    description: 'Ideal rainfall in millimeters',
    required: false,
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  idealRainfallMm?: number;

  @ApiProperty({
    description: 'Minimum ideal soil pH',
    required: false,
    example: 5.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(14)
  idealSoilPhMin?: number;

  @ApiProperty({
    description: 'Maximum ideal soil pH',
    required: false,
    example: 7.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(14)
  idealSoilPhMax?: number;

  @ApiProperty({
    description: 'Suitable soil types',
    required: false,
    type: [String],
    example: ['clay', 'loam', 'sandy loam'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suitableSoilTypes?: string[];

  @ApiProperty({
    description: 'Water requirement level',
    required: false,
    example: 'high',
    enum: ['low', 'moderate', 'high'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['low', 'moderate', 'high'])
  waterRequirement?: string;

  @ApiProperty({
    description: 'Sunlight requirement',
    required: false,
    example: 'full sun',
    enum: ['full sun', 'partial sun', 'shade'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['full sun', 'partial sun', 'shade'])
  sunlightRequirement?: string;

  @ApiProperty({
    description: 'Planting depth in centimeters',
    required: false,
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plantingDepthCm?: number;

  @ApiProperty({
    description: 'Plant spacing in centimeters',
    required: false,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plantSpacingCm?: number;

  @ApiProperty({
    description: 'Row spacing in centimeters',
    required: false,
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rowSpacingCm?: number;

  @ApiProperty({
    description: 'Seed rate per acre',
    required: false,
    example: 25,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  seedRatePerAcre?: number;

  @ApiProperty({
    description: 'Seed rate unit',
    required: false,
    example: 'kg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  seedRateUnit?: string;

  @ApiProperty({
    description: 'Expected yield per acre',
    required: false,
    example: 2500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedYieldPerAcre?: number;

  @ApiProperty({
    description: 'Yield unit',
    required: false,
    example: 'kg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  yieldUnit?: string;

  @ApiProperty({
    description: 'Market price per unit',
    required: false,
    example: 25.50,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  marketPricePerUnit?: number;

  @ApiProperty({
    description: 'Price currency',
    default: 'INR',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  priceCurrency?: string;

  @ApiProperty({
    description: 'Cultivation difficulty level',
    required: false,
    example: 'moderate',
    enum: ['easy', 'moderate', 'difficult'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['easy', 'moderate', 'difficult'])
  cultivationDifficulty?: string;

  @ApiProperty({
    description: 'Whether the crop is suitable for organic farming',
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  organicSuitable?: boolean;

  @ApiProperty({
    description: 'Companion crops that grow well together',
    required: false,
    type: [String],
    example: ['beans', 'corn'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companionCrops?: string[];

  @ApiProperty({
    description: 'Crops that should not be grown together',
    required: false,
    type: [String],
    example: ['fennel', 'tomatoes'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  incompatibleCrops?: string[];

  @ApiProperty({
    description: 'Common pests affecting this crop',
    required: false,
    type: [String],
    example: ['aphids', 'caterpillars'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonPests?: string[];

  @ApiProperty({
    description: 'Common diseases affecting this crop',
    required: false,
    type: [String],
    example: ['blight', 'rust'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonDiseases?: string[];

  @ApiProperty({
    description: 'Nutritional requirements',
    required: false,
    example: {
      nitrogen: 'high',
      phosphorus: 'moderate',
      potassium: 'moderate',
    },
  })
  @IsOptional()
  nutritionalRequirements?: {
    nitrogen: string;
    phosphorus: string;
    potassium: string;
    [key: string]: string;
  };

  @ApiProperty({
    description: 'Indicators for harvesting readiness',
    required: false,
    type: [String],
    example: ['grain color changes', 'moisture content'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  harvestingIndicators?: string[];

  @ApiProperty({
    description: 'Post-harvest handling instructions',
    required: false,
  })
  @IsOptional()
  @IsString()
  postHarvestHandling?: string;

  @ApiProperty({
    description: 'Storage requirements',
    required: false,
  })
  @IsOptional()
  @IsString()
  storageRequirements?: string;

  @ApiProperty({
    description: 'Nutritional value information',
    required: false,
  })
  @IsOptional()
  nutritionalValue?: Record<string, any>;

  @ApiProperty({
    description: 'Regional varieties',
    required: false,
    type: 'array',
  })
  @IsOptional()
  regionalVarieties?: {
    region: string;
    variety: string;
    characteristics: string[];
  }[];

  @ApiProperty({
    description: 'Cultivation tips and best practices',
    required: false,
    type: [String],
    example: ['prepare soil well', 'maintain proper spacing'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cultivationTips?: string[];

  @ApiProperty({
    description: 'Crop image URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  cropImageUrl?: string;
}