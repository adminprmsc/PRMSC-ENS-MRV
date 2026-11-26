import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { timestampColumnTransformer } from '../transformers/date.transformer';

/** Per-user state for a release note (see domain/constants/release-notes.ts). */
@Entity('release_note_receipts')
@Index('UQ_release_note_receipts_user_release', ['userId', 'releaseId'], {
  unique: true,
})
export class ReleaseNoteReceipt {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'release_id', type: 'varchar', length: 100 })
  releaseId!: string;

  @Column({
    name: 'notified_at',
    type: 'timestamp',
    default: () => 'now()',
    transformer: timestampColumnTransformer,
  })
  notifiedAt!: Date;

  @Column({
    name: 'read_at',
    type: 'timestamp',
    nullable: true,
    transformer: timestampColumnTransformer,
  })
  readAt!: Date | null;

  @Column({
    name: 'dismissed_at',
    type: 'timestamp',
    nullable: true,
    transformer: timestampColumnTransformer,
  })
  dismissedAt!: Date | null;
}
