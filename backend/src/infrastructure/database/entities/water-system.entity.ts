import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { METER_TYPE_TUBEWELL } from '../../../domain/constants/submission.constants';
import {
  dateColumnTransformer,
  timestampColumnTransformer,
} from '../transformers/date.transformer';
import { SystemMeter } from './system-meter.entity';
import { WaterEnergyLoggingDaily } from './water-energy-logging-daily.entity';
import { WaterSystemCalibrationCertificate } from './water-system-calibration-certificate.entity';

@Entity('water_systems')
export class WaterSystem {
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

  @Column({ name: 'pump_model', type: 'varchar', length: 100, nullable: true })
  pumpModel!: string | null;

  @Column({
    name: 'pump_serial_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  pumpSerialNumber!: string | null;

  @Column({
    name: 'start_of_operation',
    type: 'date',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  startOfOperation!: Date | null;

  @Column({ name: 'depth_of_water_intake', type: 'float', nullable: true })
  depthOfWaterIntake!: number | null;

  @Column({ name: 'height_to_ohr', type: 'float', nullable: true })
  heightToOhr!: number | null;

  @Column({ name: 'pump_flow_rate', type: 'float', nullable: true })
  pumpFlowRate!: number | null;

  @Column({ name: 'bulk_meter_installed', type: 'boolean', default: true })
  bulkMeterInstalled!: boolean;

  @Column({ name: 'ohr_tank_capacity', type: 'float', nullable: true })
  ohrTankCapacity!: number | null;

  @Column({ name: 'ohr_fill_required', type: 'float', nullable: true })
  ohrFillRequired!: number | null;

  @Column({ name: 'pump_capacity', type: 'float', nullable: true })
  pumpCapacity!: number | null;

  @Column({ name: 'pump_head', type: 'float', nullable: true })
  pumpHead!: number | null;

  @Column({ name: 'pump_horse_power', type: 'float', nullable: true })
  pumpHorsePower!: number | null;

  @Column({ name: 'time_to_fill', type: 'float', nullable: true })
  timeToFill!: number | null;

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

  @OneToMany(() => SystemMeter, (meter) => meter.waterSystem, { cascade: true })
  meters!: SystemMeter[];

  @OneToMany(() => WaterEnergyLoggingDaily, (record) => record.system)
  records!: WaterEnergyLoggingDaily[];

  @OneToMany(
    () => WaterSystemCalibrationCertificate,
    (cert) => cert.waterSystem,
  )
  calibrationCertificates!: WaterSystemCalibrationCertificate[];

  get activeMeter(): SystemMeter | undefined {
    const tubewellMeters = (this.meters ?? [])
      .filter((m) => m.isActive && m.meterType === METER_TYPE_TUBEWELL)
      .sort((a, b) => {
        const aKey = (a.createdAt?.getTime() ?? 0).toString() + String(a.id);
        const bKey = (b.createdAt?.getTime() ?? 0).toString() + String(b.id);
        return bKey.localeCompare(aKey);
      });
    return tubewellMeters[0];
  }
}
