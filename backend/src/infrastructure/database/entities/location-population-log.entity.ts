import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { timestampColumnTransformer } from '../transformers/date.transformer';

export const POPULATION_LOCATION_VILLAGE = 'village';
export const POPULATION_LOCATION_SETTLEMENT = 'settlement';
export type PopulationLocationType =
  typeof POPULATION_LOCATION_VILLAGE | typeof POPULATION_LOCATION_SETTLEMENT;

/** Append-only audit of village / settlement population changes. */
@Entity('location_population_logs')
@Index('IDX_location_population_logs_tehsil_created', ['tehsil', 'createdAt'])
export class LocationPopulationLog {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'location_type', type: 'varchar', length: 20 })
  locationType!: PopulationLocationType;

  @Column({ name: 'location_id', type: 'varchar', length: 36 })
  locationId!: string;

  @Column({ type: 'varchar', length: 100 })
  tehsil!: string;

  @Column({ type: 'varchar', length: 150 })
  village!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  settlement!: string | null;

  @Column({ name: 'previous_population', type: 'integer' })
  previousPopulation!: number;

  @Column({ name: 'new_population', type: 'integer' })
  newPopulation!: number;

  @Column({ name: 'performed_by', type: 'varchar', length: 36, nullable: true })
  performedBy!: string | null;

  @Column({
    name: 'performed_by_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  performedByName!: string | null;

  @Column({ name: 'performed_by_role', type: 'varchar', length: 50 })
  performedByRole!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    transformer: timestampColumnTransformer,
  })
  createdAt!: Date;
}
