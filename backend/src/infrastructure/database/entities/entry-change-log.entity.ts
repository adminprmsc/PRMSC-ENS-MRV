import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { timestampColumnTransformer } from '../transformers/date.transformer';

export const ENTRY_TYPE_WATER_LOG = 'water_log';
export const ENTRY_TYPE_SOLAR_LOG = 'solar_log';

export const ENTRY_ACTION_REJECT = 'reject';
export const ENTRY_ACTION_DELETE = 'delete';

/**
 * Immutable audit trail for Manager Operations overrides on already-approved
 * data entries (water daily logs / solar monthly logs).
 *
 * Rows are never updated or deleted by the app. `snapshot` holds the full
 * entry as it was immediately before the change, so a hard-deleted entry
 * remains reviewable.
 */
@Entity('entry_change_logs')
@Index('IDX_entry_change_logs_tehsil_created', ['tehsil', 'createdAt'])
@Index('IDX_entry_change_logs_entry', ['entryType', 'entryId'])
export class EntryChangeLog {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'entry_type', type: 'varchar', length: 20 })
  entryType!: string;

  @Column({ name: 'entry_id', type: 'varchar', length: 36 })
  entryId!: string;

  @Column({ type: 'varchar', length: 20 })
  action!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    name: 'previous_status',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  previousStatus!: string | null;

  @Column({ name: 'new_status', type: 'varchar', length: 30, nullable: true })
  newStatus!: string | null;

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

  @Column({ name: 'system_id', type: 'varchar', length: 36, nullable: true })
  systemId!: string | null;

  @Column({ name: 'system_uid', type: 'varchar', length: 100, nullable: true })
  systemUid!: string | null;

  @Column({ type: 'varchar', length: 100 })
  tehsil!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  village!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  settlement!: string | null;

  /** Water: YYYY-MM-DD log day. Solar: YYYY-MM (billing month). */
  @Column({ name: 'entry_period', type: 'varchar', length: 10, nullable: true })
  entryPeriod!: string | null;

  @Column({
    name: 'submission_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  submissionId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  snapshot!: Record<string, unknown> | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    transformer: timestampColumnTransformer,
  })
  createdAt!: Date;
}
