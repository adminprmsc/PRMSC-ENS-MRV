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
import { User } from './user.entity';

@Entity('training_videos')
export class TrainingVideo {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'youtube_url', type: 'text' })
  youtubeUrl!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({
    name: 'audience_roles',
    type: 'simple-array',
    default: 'ADMIN,SUPER_ADMIN',
  })
  audienceRoles!: string[];

  @Column({
    name: 'created_by_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  createdById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User | null;
}
