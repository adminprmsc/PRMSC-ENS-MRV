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

@Entity('verification_logs')
export class VerificationLog {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'submission_id', type: 'varchar', length: 36 })
  submissionId!: string;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: string;

  @Column({ name: 'performed_by', type: 'varchar', length: 36 })
  performedBy!: string;

  @Column({ type: 'varchar', length: 50 })
  role!: string;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => Submission, (s) => s.logs)
  @JoinColumn({ name: 'submission_id' })
  submission!: Submission;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  user!: User;
}
