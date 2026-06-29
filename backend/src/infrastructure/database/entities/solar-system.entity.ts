import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { METER_TYPE_SOLAR } from '../../../domain/constants/submission.constants';
import {
  dateColumnTransformer,
  timestampColumnTransformer,
} from '../transformers/date.transformer';
import { SolarEnergyLoggingMonthly } from './solar-energy-logging-monthly.entity';
import { SystemMeter } from './system-meter.entity';

@Entity('solar_systems')
export class SolarSystem {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  tehsil!: string;

  @Column({ type: 'varchar', length: 100 })
  village!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  settlement!: string | null;

  @Column({
    name: 'unique_identifier',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  uniqueIdentifier!: string;

  @Column({ type: 'float', nullable: true })
  latitude!: number | null;

  @Column({ type: 'float', nullable: true })
  longitude!: number | null;

  @Column({
    name: 'installation_location',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  installationLocation!: string | null;

  @Column({ name: 'disco_info', type: 'varchar', length: 100, nullable: true })
  discoInfo!: string | null;

  @Column({
    name: 'bill_reference_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  billReferenceNumber!: string | null;

  @Column({ name: 'solar_panel_capacity', type: 'float', nullable: true })
  solarPanelCapacity!: number | null;

  @Column({ name: 'inverter_capacity', type: 'float', nullable: true })
  inverterCapacity!: number | null;

  @Column({
    name: 'inverter_serial_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  inverterSerialNumber!: string | null;

  @Column({
    name: 'installation_date',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  installationDate!: Date | null;

  @Column({
    name: 'solar_connection_date',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  solarConnectionDate!: Date | null;

  @Column({
    name: 'electricity_connection_date',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  electricityConnectionDate!: Date | null;

  @Column({
    name: 'green_connection_date',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  greenConnectionDate!: Date | null;

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
    name: 'green_meter_connection_date',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  greenMeterConnectionDate!: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

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

  @OneToMany(() => SystemMeter, (meter) => meter.solarSystem, { cascade: true })
  meters!: SystemMeter[];

  @OneToMany(() => SolarEnergyLoggingMonthly, (record) => record.system)
  records!: SolarEnergyLoggingMonthly[];

  get activeMeter(): SystemMeter | undefined {
    const solarMeters = (this.meters ?? [])
      .filter((m) => m.isActive && m.meterType === METER_TYPE_SOLAR)
      .sort((a, b) => {
        const aKey = (a.createdAt?.getTime() ?? 0).toString() + String(a.id);
        const bKey = (b.createdAt?.getTime() ?? 0).toString() + String(b.id);
        return bKey.localeCompare(aKey);
      });
    return solarMeters[0];
  }
}
