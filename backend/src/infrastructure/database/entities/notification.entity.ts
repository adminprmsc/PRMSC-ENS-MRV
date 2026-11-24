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
import { Submission } from './submission.entity';
import { User } from './user.entity';

/** Manager Operations rejected/deleted an approved entry; entity_id = entry_change_logs.id */
export const NOTIFICATION_TYPE_ENTRY_CHANGE = 'entry_change';

@Entity('notifications')
export class Notification {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({
    name: 'submission_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  submissionId!: string | null;

  /** e.g. 'entry_change' — null for legacy/general notices. */
  @Column({
    name: 'notification_type',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  notificationType!: string | null;

  /** Record the notification points at (meaning depends on the type). */
  @Column({ name: 'entity_id', type: 'varchar', length: 36, nullable: true })
  entityId!: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Submission, (s) => s.notifications, { nullable: true })
  @JoinColumn({ name: 'submission_id' })
  submission!: Submission | null;
}
