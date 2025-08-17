import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Crop } from './crop.entity';
import { Farm } from '../../farms/entities/farm.entity';
import { User } from '../../users/entities/user.entity';
import { CultivationActivity } from './cultivation-activity.entity';

@Entity('crop_cultivations')
@Index(['farmId', 'cropId'])
@Index(['farmerId'])
@Index(['season', 'year'])
@Index(['status'])
export class CropCultivation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'farmer_id', type: 'uuid' })
  farmerId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'farmer_id' })
  farmer: User;

  @Column({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @ManyToOne(() => Farm, { eager: false })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'crop_id', type: 'uuid' })
  cropId: string;

  @ManyToOne(() => Crop, { eager: true })
  @JoinColumn({ name: 'crop_id' })
  crop: Crop;

  @Column({ type: 'varchar', length: 30 })
  season: string;

  @Column({ type: 'integer' })
  year: number;

  @Column({ name: 'variety_name', type: 'varchar', length: 100, nullable: true })
  varietyName?: string;

  @Column({ name: 'cultivation_area', type: 'decimal', precision: 8, scale: 2 })
  cultivationArea: number;

  @Column({ name: 'area_unit', type: 'varchar', length: 20, default: 'acres' })
  areaUnit: string;

  @Column({ name: 'planting_date', type: 'date' })
  plantingDate: Date;

  @Column({ name: 'expected_harvest_date', type: 'date' })
  expectedHarvestDate: Date;

  @Column({ name: 'actual_harvest_date', type: 'date', nullable: true })
  actualHarvestDate?: Date;

  @Column({
    type: 'enum',
    enum: ['planning', 'planted', 'growing', 'flowering', 'maturing', 'harvested', 'completed', 'failed'],
    default: 'planning',
  })
  status: string;

  @Column({ name: 'cultivation_method', type: 'varchar', length: 50, default: 'traditional' })
  cultivationMethod: string;

  @Column({ name: 'is_organic', type: 'boolean', default: false })
  isOrganic: boolean;

  @Column({ name: 'irrigation_method', type: 'varchar', length: 50, nullable: true })
  irrigationMethod?: string;

  @Column({ name: 'seed_source', type: 'varchar', length: 100, nullable: true })
  seedSource?: string;

  @Column({ name: 'seed_quantity', type: 'decimal', precision: 8, scale: 2, nullable: true })
  seedQuantity?: number;

  @Column({ name: 'seed_quantity_unit', type: 'varchar', length: 20, nullable: true })
  seedQuantityUnit?: string;

  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalCost?: number;

  @Column({ name: 'cost_currency', type: 'varchar', length: 5, default: 'INR' })
  costCurrency: string;

  @Column({ name: 'expected_yield', type: 'decimal', precision: 10, scale: 2, nullable: true })
  expectedYield?: number;

  @Column({ name: 'actual_yield', type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualYield?: number;

  @Column({ name: 'yield_unit', type: 'varchar', length: 20, nullable: true })
  yieldUnit?: string;

  @Column({ name: 'yield_quality_grade', type: 'varchar', length: 20, nullable: true })
  yieldQualityGrade?: string;

  @Column({ name: 'market_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  marketPrice?: number;

  @Column({ name: 'total_revenue', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalRevenue?: number;

  @Column({ name: 'net_profit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  netProfit?: number;

  @Column({ name: 'weather_conditions', type: 'jsonb', nullable: true })
  weatherConditions?: {
    avgTemperature: number;
    totalRainfall: number;
    sunnyDays: number;
    stormyDays: number;
  };

  @Column({ name: 'soil_preparation', type: 'jsonb', nullable: true })
  soilPreparation?: {
    methods: string[];
    amendments: string[];
    cost: number;
  };

  @Column({ name: 'fertilizers_used', type: 'jsonb', nullable: true })
  fertilizersUsed?: {
    type: string;
    quantity: number;
    unit: string;
    applicationDate: Date;
    cost: number;
  }[];

  @Column({ name: 'pesticides_used', type: 'jsonb', nullable: true })
  pesticidesUsed?: {
    type: string;
    purpose: string;
    quantity: number;
    unit: string;
    applicationDate: Date;
    cost: number;
  }[];

  @Column({ name: 'irrigation_schedule', type: 'jsonb', nullable: true })
  irrigationSchedule?: {
    frequency: string;
    duration: string;
    waterSource: string;
    totalWaterUsed: number;
  };

  @Column({ name: 'pest_diseases_encountered', type: 'jsonb', nullable: true })
  pestDiseasesEncountered?: {
    name: string;
    severity: string;
    treatmentApplied: string;
    outcome: string;
    date: Date;
  }[];

  @Column({ name: 'growth_stages', type: 'jsonb', nullable: true })
  growthStages?: {
    stage: string;
    date: Date;
    notes: string;
    photos: string[];
  }[];

  @Column({ name: 'harvest_details', type: 'jsonb', nullable: true })
  harvestDetails?: {
    harvestMethod: string;
    laborersUsed: number;
    harvestDuration: string;
    postHarvestHandling: string[];
    storageLocation: string;
  };

  @Column({ name: 'quality_assessment', type: 'jsonb', nullable: true })
  qualityAssessment?: {
    appearance: string;
    size: string;
    color: string;
    defects: string[];
    marketability: string;
  };

  @Column({ name: 'lessons_learned', type: 'text', nullable: true })
  lessonsLearned?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'crop_photos', type: 'jsonb', nullable: true })
  cropPhotos?: {
    stage: string;
    date: Date;
    url: string;
    description: string;
  }[];

  @Column({ name: 'certification_applicable', type: 'boolean', default: false })
  certificationApplicable: boolean;

  @Column({ name: 'certification_status', type: 'varchar', length: 50, nullable: true })
  certificationStatus?: string;

  @Column({ name: 'traceability_code', type: 'varchar', length: 50, nullable: true })
  traceabilityCode?: string;

  @OneToMany(() => CultivationActivity, (activity) => activity.cultivation, { cascade: true })
  activities: CultivationActivity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}