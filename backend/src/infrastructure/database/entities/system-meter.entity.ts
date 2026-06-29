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
import { SolarSystem } from './solar-system.entity';
import { WaterSystem } from './water-system.entity';

@Entity('system_meters')
export class SystemMeter {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'meter_type', type: 'varchar', length: 32 })
  meterType!: string;

  @Column({
    name: 'water_system_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  waterSystemId!: string | null;

  @Column({
    name: 'solar_system_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  solarSystemId!: string | null;

  @Column({ name: 'meter_model', type: 'varchar', length: 100, nullable: true })
  meterModel!: string | null;

  @Column({
    name: 'meter_serial_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  meterSerialNumber!: string | null;

  @Column({
    name: 'meter_accuracy_class',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  meterAccuracyClass!: string | null;

  @Column({
    name: 'installation_date',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  installationDate!: Date | null;

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

  @ManyToOne(() => WaterSystem, (ws) => ws.meters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'water_system_id' })
  waterSystem!: WaterSystem | null;

  @ManyToOne(() => SolarSystem, (ss) => ss.meters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solar_system_id' })
  solarSystem!: SolarSystem | null;
}
