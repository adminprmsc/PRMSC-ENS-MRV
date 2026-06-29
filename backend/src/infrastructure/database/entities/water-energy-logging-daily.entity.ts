import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SUBMISSION_STATUS_DRAFTED } from '../../../domain/constants/submission.constants';
import {
  dateColumnTransformer,
  timestampColumnTransformer,
} from '../transformers/date.transformer';
import { WaterSystem } from './water-system.entity';

@Entity('water_energy_logging_daily')
@Unique('uq_water_energy_logging_daily_sid_date_times', [
  'waterSystemId',
  'logDate',
  'pumpStartTime',
  'pumpEndTime',
])
export class WaterEnergyLoggingDaily {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'water_system_id', type: 'varchar', length: 36 })
  waterSystemId!: string;

  @Column({ name: 'log_date', type: 'date', transformer: dateColumnTransformer })
  logDate!: Date;

  @Column({ name: 'pump_start_time', type: 'time', nullable: true })
  pumpStartTime!: string | null;

  @Column({ name: 'pump_end_time', type: 'time', nullable: true })
  pumpEndTime!: string | null;

  @Column({ name: 'pump_operating_hours', type: 'float', nullable: true })
  pumpOperatingHours!: number | null;

  @Column({ name: 'total_water_pumped', type: 'float', nullable: true })
  totalWaterPumped!: number | null;

  @Column({ name: 'meter_reading_start', type: 'float', nullable: true })
  meterReadingStart!: number | null;

  @Column({ name: 'meter_reading_end', type: 'float', nullable: true })
  meterReadingEnd!: number | null;

  @Column({ name: 'bulk_meter_image_url', type: 'text', nullable: true })
  bulkMeterImageUrl!: string | null;

  @Column({ type: 'boolean', default: false })
  signed!: boolean;

  @Column({ name: 'signature_svg_snapshot', type: 'text', nullable: true })
  signatureSvgSnapshot!: string | null;

  @Column({ type: 'varchar', length: 24, default: SUBMISSION_STATUS_DRAFTED })
  status!: string;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

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

  @ManyToOne(() => WaterSystem, (ws) => ws.records)
  @JoinColumn({ name: 'water_system_id' })
  system!: WaterSystem;
}
