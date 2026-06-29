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
import { SolarSystem } from './solar-system.entity';

@Entity('solar_energy_logging_monthly')
export class SolarEnergyLoggingMonthly {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'solar_system_id', type: 'varchar', length: 36 })
  solarSystemId!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int' })
  month!: number;

  @Column({ name: 'export_off_peak', type: 'float', nullable: true })
  exportOffPeak!: number | null;

  @Column({ name: 'export_peak', type: 'float', nullable: true })
  exportPeak!: number | null;

  @Column({ name: 'import_off_peak', type: 'float', nullable: true })
  importOffPeak!: number | null;

  @Column({ name: 'import_peak', type: 'float', nullable: true })
  importPeak!: number | null;

  @Column({ name: 'net_off_peak', type: 'float', nullable: true })
  netOffPeak!: number | null;

  @Column({ name: 'net_peak', type: 'float', nullable: true })
  netPeak!: number | null;

  @Column({ name: 'electricity_bill_image_url', type: 'text', nullable: true })
  electricityBillImageUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => SolarSystem, (ss) => ss.records)
  @JoinColumn({ name: 'solar_system_id' })
  system!: SolarSystem;
}
