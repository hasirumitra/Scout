import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CropCultivation } from './crop-cultivation.entity';
import { User } from '../../users/entities/user.entity';

@Entity('cultivation_activities')
@Index(['cultivationId'])
@Index(['activityType'])
@Index(['activityDate'])
export class CultivationActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cultivation_id', type: 'uuid' })
  cultivationId: string;

  @ManyToOne(() => CropCultivation, (cultivation) => cultivation.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cultivation_id' })
  cultivation: CropCultivation;

  @Column({ name: 'performed_by', type: 'uuid' })
  performedBy: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'performed_by' })
  performer: User;

  @Column({ name: 'activity_type', type: 'varchar', length: 50 })
  activityType: string;

  @Column({ name: 'activity_name', type: 'varchar', length: 200 })
  activityName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'activity_date', type: 'date' })
  activityDate: Date;

  @Column({ name: 'activity_time', type: 'time', nullable: true })
  activityTime?: string;

  @Column({ name: 'duration_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  durationHours?: number;

  @Column({ name: 'labor_count', type: 'integer', nullable: true })
  laborCount?: number;

  @Column({ name: 'materials_used', type: 'jsonb', nullable: true })
  materialsUsed?: {
    name: string;
    quantity: number;
    unit: string;
    cost?: number;
  }[];

  @Column({ name: 'equipment_used', type: 'jsonb', nullable: true })
  equipmentUsed?: string[];

  @Column({ name: 'area_covered', type: 'decimal', precision: 8, scale: 2, nullable: true })
  areaCovered?: number;

  @Column({ name: 'area_unit', type: 'varchar', length: 20, nullable: true })
  areaUnit?: string;

  @Column({ name: 'activity_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  activityCost?: number;

  @Column({ name: 'cost_currency', type: 'varchar', length: 5, default: 'INR' })
  costCurrency: string;

  @Column({ name: 'cost_breakdown', type: 'jsonb', nullable: true })
  costBreakdown?: {
    labor: number;
    materials: number;
    equipment: number;
    other: number;
  };

  @Column({ name: 'weather_conditions', type: 'jsonb', nullable: true })
  weatherConditions?: {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
    conditions: string;
  };

  @Column({ name: 'soil_conditions', type: 'jsonb', nullable: true })
  soilConditions?: {
    moisture: string;
    temperature: number;
    compaction: string;
    structure: string;
  };

  @Column({ name: 'observations', type: 'text', nullable: true })
  observations?: string;

  @Column({ name: 'crop_health_rating', type: 'integer', nullable: true })
  cropHealthRating?: number;

  @Column({ name: 'growth_stage_observed', type: 'varchar', length: 50, nullable: true })
  growthStageObserved?: string;

  @Column({ name: 'pest_disease_observed', type: 'jsonb', nullable: true })
  pestDiseaseObserved?: {
    type: string;
    name: string;
    severity: string;
    affectedArea: number;
    actionTaken: string;
  }[];

  @Column({ name: 'activity_photos', type: 'jsonb', nullable: true })
  activityPhotos?: {
    url: string;
    caption: string;
    timestamp: Date;
  }[];

  @Column({
    type: 'enum',
    enum: ['scheduled', 'in_progress', 'completed', 'skipped', 'failed'],
    default: 'completed',
  })
  status: string;

  @Column({ name: 'completion_percentage', type: 'integer', default: 100 })
  completionPercentage: number;

  @Column({ name: 'quality_score', type: 'integer', nullable: true })
  qualityScore?: number;

  @Column({ name: 'effectiveness_rating', type: 'integer', nullable: true })
  effectivenessRating?: number;

  @Column({ name: 'next_scheduled_activity', type: 'varchar', length: 200, nullable: true })
  nextScheduledActivity?: string;

  @Column({ name: 'next_activity_date', type: 'date', nullable: true })
  nextActivityDate?: Date;

  @Column({ name: 'recommendations', type: 'jsonb', nullable: true })
  recommendations?: string[];

  @Column({ name: 'gps_coordinates', type: 'jsonb', nullable: true })
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };

  @Column({ name: 'compliance_notes', type: 'text', nullable: true })
  complianceNotes?: string;

  @Column({ name: 'certification_relevant', type: 'boolean', default: false })
  certificationRelevant: boolean;

  @Column({ name: 'recorded_via', type: 'varchar', length: 50, default: 'mobile_app' })
  recordedVia: string;

  @Column({ name: 'voice_notes_url', type: 'varchar', length: 500, nullable: true })
  voiceNotesUrl?: string;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy?: string;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}