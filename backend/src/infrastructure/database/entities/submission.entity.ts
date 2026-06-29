import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SUBMISSION_STATUS_DRAFTED } from '../../../domain/constants/submission.constants';
import { timestampColumnTransformer } from '../transformers/date.transformer';
import { User } from './user.entity';
import { Notification } from './notification.entity';
import { VerificationLog } from './verification-log.entity';

@Entity('submissions')
export class Submission {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'operator_id', type: 'varchar', length: 36 })
  operatorId!: string;

  @Column({ name: 'submission_type', type: 'varchar', length: 50 })
  submissionType!: string;

  @Column({ name: 'record_id', type: 'varchar', length: 36 })
  recordId!: string;

  @Column({ type: 'varchar', length: 30, default: SUBMISSION_STATUS_DRAFTED })
  status!: string;

  @Column({
    name: 'submitted_at',
    type: 'timestamp',
    nullable: true,
    transformer: timestampColumnTransformer,
  })
  submittedAt!: Date | null;

  @Column({
    name: 'reviewed_at',
    type: 'timestamp',
    nullable: true,
    transformer: timestampColumnTransformer,
  })
  reviewedAt!: Date | null;

  @Column({
    name: 'approved_at',
    type: 'timestamp',
    nullable: true,
    transformer: timestampColumnTransformer,
  })
  approvedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 36, nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 36, nullable: true })
  approvedBy!: string | null;

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

  @ManyToOne(() => User)
  @JoinColumn({ name: 'operator_id' })
  operator!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewed_by' })
  reviewer!: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver!: User | null;

  @OneToMany(() => VerificationLog, (log) => log.submission)
  logs!: VerificationLog[];

  @OneToMany(() => Notification, (n) => n.submission)
  notifications!: Notification[];
}
