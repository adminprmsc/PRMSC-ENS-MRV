import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { timestampColumnTransformer } from '../transformers/date.transformer';

/** Append-only audit of changes to a water system's bulk-meter start. */
@Entity('water_bulk_cutover_logs')
@Index('IDX_water_bulk_cutover_logs_system', ['waterSystemId', 'createdAt'])
export class WaterBulkCutoverLog {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'water_system_id', type: 'varchar', length: 36 })
  waterSystemId!: string;

  /** "YYYY-MM-DD HH:MM:SS" (Pakistan wall clock) or null = first reading. */
  @Column({
    name: 'previous_since',
    type: 'varchar',
    length: 19,
    nullable: true,
  })
  previousSince!: string | null;

  @Column({ name: 'new_since', type: 'varchar', length: 19, nullable: true })
  newSince!: string | null;

  @Column({ name: 'newly_unmetered_logs', type: 'integer', default: 0 })
  newlyUnmeteredLogs!: number;

  @Column({ name: 'performed_by', type: 'varchar', length: 36, nullable: true })
  performedBy!: string | null;

  @Column({
    name: 'performed_by_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  performedByName!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    transformer: timestampColumnTransformer,
  })
  createdAt!: Date;
}
