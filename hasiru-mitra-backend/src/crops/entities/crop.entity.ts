import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('crops')
@Index(['category'])
@Index(['season'])
export class Crop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ name: 'scientific_name', type: 'varchar', length: 150, nullable: true })
  scientificName?: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 30 })
  season: string;

  @Column({ name: 'growing_period_days', type: 'integer' })
  growingPeriodDays: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'ideal_temperature_min', type: 'decimal', precision: 4, scale: 1, nullable: true })
  idealTemperatureMin?: number;

  @Column({ name: 'ideal_temperature_max', type: 'decimal', precision: 4, scale: 1, nullable: true })
  idealTemperatureMax?: number;

  @Column({ name: 'ideal_rainfall_mm', type: 'decimal', precision: 6, scale: 2, nullable: true })
  idealRainfallMm?: number;

  @Column({ name: 'ideal_soil_ph_min', type: 'decimal', precision: 3, scale: 1, nullable: true })
  idealSoilPhMin?: number;

  @Column({ name: 'ideal_soil_ph_max', type: 'decimal', precision: 3, scale: 1, nullable: true })
  idealSoilPhMax?: number;

  @Column({ name: 'suitable_soil_types', type: 'jsonb', nullable: true })
  suitableSoilTypes?: string[];

  @Column({ name: 'water_requirement', type: 'varchar', length: 50, nullable: true })
  waterRequirement?: string;

  @Column({ name: 'sunlight_requirement', type: 'varchar', length: 50, nullable: true })
  sunlightRequirement?: string;

  @Column({ name: 'planting_depth_cm', type: 'decimal', precision: 4, scale: 1, nullable: true })
  plantingDepthCm?: number;

  @Column({ name: 'plant_spacing_cm', type: 'decimal', precision: 5, scale: 1, nullable: true })
  plantSpacingCm?: number;

  @Column({ name: 'row_spacing_cm', type: 'decimal', precision: 5, scale: 1, nullable: true })
  rowSpacingCm?: number;

  @Column({ name: 'seed_rate_per_acre', type: 'decimal', precision: 8, scale: 2, nullable: true })
  seedRatePerAcre?: number;

  @Column({ name: 'seed_rate_unit', type: 'varchar', length: 20, nullable: true })
  seedRateUnit?: string;

  @Column({ name: 'expected_yield_per_acre', type: 'decimal', precision: 8, scale: 2, nullable: true })
  expectedYieldPerAcre?: number;

  @Column({ name: 'yield_unit', type: 'varchar', length: 20, nullable: true })
  yieldUnit?: string;

  @Column({ name: 'market_price_per_unit', type: 'decimal', precision: 10, scale: 2, nullable: true })
  marketPricePerUnit?: number;

  @Column({ name: 'price_currency', type: 'varchar', length: 5, default: 'INR' })
  priceCurrency: string;

  @Column({ name: 'cultivation_difficulty', type: 'enum', enum: ['easy', 'moderate', 'difficult'], nullable: true })
  cultivationDifficulty?: string;

  @Column({ name: 'organic_suitable', type: 'boolean', default: true })
  organicSuitable: boolean;

  @Column({ name: 'companion_crops', type: 'jsonb', nullable: true })
  companionCrops?: string[];

  @Column({ name: 'incompatible_crops', type: 'jsonb', nullable: true })
  incompatibleCrops?: string[];

  @Column({ name: 'common_pests', type: 'jsonb', nullable: true })
  commonPests?: string[];

  @Column({ name: 'common_diseases', type: 'jsonb', nullable: true })
  commonDiseases?: string[];

  @Column({ name: 'nutritional_requirements', type: 'jsonb', nullable: true })
  nutritionalRequirements?: {
    nitrogen: string;
    phosphorus: string;
    potassium: string;
    [key: string]: string;
  };

  @Column({ name: 'harvesting_indicators', type: 'jsonb', nullable: true })
  harvestingIndicators?: string[];

  @Column({ name: 'post_harvest_handling', type: 'text', nullable: true })
  postHarvestHandling?: string;

  @Column({ name: 'storage_requirements', type: 'text', nullable: true })
  storageRequirements?: string;

  @Column({ name: 'nutritional_value', type: 'jsonb', nullable: true })
  nutritionalValue?: Record<string, any>;

  @Column({ name: 'regional_varieties', type: 'jsonb', nullable: true })
  regionalVarieties?: {
    region: string;
    variety: string;
    characteristics: string[];
  }[];

  @Column({ name: 'cultivation_tips', type: 'jsonb', nullable: true })
  cultivationTips?: string[];

  @Column({ name: 'crop_image_url', type: 'varchar', length: 500, nullable: true })
  cropImageUrl?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}