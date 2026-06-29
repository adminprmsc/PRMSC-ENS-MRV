import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  dateColumnTransformer,
  timestampColumnTransformer,
} from '../transformers/date.transformer';
import { WaterSystem } from './water-system.entity';

@Entity('water_system_calibration_certificates')
export class WaterSystemCalibrationCertificate {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'water_system_id', type: 'varchar', length: 36 })
  waterSystemId!: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @Column({
    name: 'uploaded_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    transformer: timestampColumnTransformer,
  })
  uploadedAt!: Date;

  @Column({
    name: 'expiry_date',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  expiryDate!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    transformer: timestampColumnTransformer,
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    transformer: timestampColumnTransformer,
  })
  updatedAt!: Date;

  @ManyToOne(() => WaterSystem, (ws) => ws.calibrationCertificates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'water_system_id' })
  waterSystem!: WaterSystem;
}
