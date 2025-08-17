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
import { Point, Polygon } from 'geojson';
import { User } from '../../users/entities/user.entity';

@Entity('farms')
@Index(['ownerId'])
@Index(['certificationStatus'])
export class Farm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  area: number;

  @Column({ name: 'area_unit', type: 'varchar', length: 20, default: 'acres' })
  areaUnit: string;

  @Column({
    name: 'location_point',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  locationPoint: Point;

  @Column({
    name: 'boundary_polygon',
    type: 'geography',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
  })
  boundaryPolygon?: Polygon;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  village?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @Column({ name: 'pin_code', type: 'varchar', length: 10, nullable: true })
  pinCode?: string;

  @Column({ type: 'varchar', length: 100, default: 'India' })
  country: string;

  @Column({ name: 'soil_type', type: 'varchar', length: 50, nullable: true })
  soilType?: string;

  @Column({ name: 'soil_ph', type: 'decimal', precision: 3, scale: 1, nullable: true })
  soilPh?: number;

  @Column({ name: 'water_source', type: 'varchar', length: 100, nullable: true })
  waterSource?: string;

  @Column({ name: 'irrigation_type', type: 'varchar', length: 100, nullable: true })
  irrigationType?: string;

  @Column({ name: 'organic_certified', type: 'boolean', default: false })
  organicCertified: boolean;

  @Column({
    name: 'certification_status',
    type: 'enum',
    enum: ['not_applied', 'in_progress', 'certified', 'expired', 'rejected'],
    default: 'not_applied',
  })
  certificationStatus: string;

  @Column({ name: 'certification_number', type: 'varchar', length: 100, nullable: true })
  certificationNumber?: string;

  @Column({ name: 'certification_authority', type: 'varchar', length: 200, nullable: true })
  certificationAuthority?: string;

  @Column({ name: 'certification_date', type: 'date', nullable: true })
  certificationDate?: Date;

  @Column({ name: 'certification_expiry', type: 'date', nullable: true })
  certificationExpiry?: Date;

  @Column({ name: 'farm_images', type: 'jsonb', nullable: true })
  farmImages?: string[];

  @Column({ name: 'soil_test_reports', type: 'jsonb', nullable: true })
  soilTestReports?: {
    date: Date;
    reportUrl: string;
    nutrientLevels: Record<string, number>;
  }[];

  @Column({ name: 'weather_station_id', type: 'varchar', length: 50, nullable: true })
  weatherStationId?: string;

  @Column({ name: 'farm_type', type: 'varchar', length: 50, default: 'individual' })
  farmType: string;

  @Column({ name: 'farming_methods', type: 'jsonb', nullable: true })
  farmingMethods?: string[];

  @Column({ name: 'main_crops', type: 'jsonb', nullable: true })
  mainCrops?: string[];

  @Column({ name: 'seasonal_crops', type: 'jsonb', nullable: true })
  seasonalCrops?: {
    season: string;
    crops: string[];
  }[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'registration_number', type: 'varchar', length: 100, nullable: true })
  registrationNumber?: string;

  @Column({ name: 'survey_number', type: 'varchar', length: 100, nullable: true })
  surveyNumber?: string;

  @Column({ name: 'khata_number', type: 'varchar', length: 100, nullable: true })
  khataNumber?: string;

  @Column({ name: 'ownership_type', type: 'varchar', length: 50, default: 'owned' })
  ownershipType: string;

  @Column({ name: 'lease_details', type: 'jsonb', nullable: true })
  leaseDetails?: {
    startDate: Date;
    endDate: Date;
    lessorName: string;
    leasorContact: string;
  };

  @Column({ name: 'farm_establishment_date', type: 'date', nullable: true })
  farmEstablishmentDate?: Date;

  @Column({ name: 'conversion_start_date', type: 'date', nullable: true })
  conversionStartDate?: Date;

  @Column({ name: 'conversion_period_years', type: 'integer', default: 3 })
  conversionPeriodYears: number;

  @Column({ name: 'nearest_market_distance', type: 'decimal', precision: 5, scale: 2, nullable: true })
  nearestMarketDistance?: number;

  @Column({ name: 'accessibility_rating', type: 'integer', nullable: true })
  accessibilityRating?: number;

  @Column({ name: 'labor_availability', type: 'varchar', length: 50, nullable: true })
  laborAvailability?: string;

  @Column({ name: 'equipment_owned', type: 'jsonb', nullable: true })
  equipmentOwned?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}