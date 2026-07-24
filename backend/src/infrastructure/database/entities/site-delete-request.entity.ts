import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export const SITE_DELETE_RESOURCE_WATER = 'water';
export const SITE_DELETE_RESOURCE_SOLAR = 'solar';

export const SITE_DELETE_STATUS_PENDING = 'pending';
export const SITE_DELETE_STATUS_APPROVED = 'approved';
export const SITE_DELETE_STATUS_REJECTED = 'rejected';
export const SITE_DELETE_STATUS_CANCELLED = 'cancelled';

@Entity('site_delete_requests')
@Index('IDX_site_delete_requests_status_tehsil', ['status', 'tehsil'])
export class SiteDeleteRequest {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 20 })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 36 })
  resourceId!: string;

  @Column({ type: 'varchar', length: 100 })
  tehsil!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  village!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  settlement!: string | null;

  @Column({ name: 'unique_identifier', type: 'varchar', length: 100 })
  uniqueIdentifier!: string;

  @Column({ type: 'varchar', length: 30, default: SITE_DELETE_STATUS_PENDING })
  status!: string;

  @Column({ name: 'requested_by', type: 'varchar', length: 36 })
  requestedBy!: string;

  @Column({ name: 'requested_at', type: 'timestamp', default: () => 'now()' })
  requestedAt!: Date;

  @Column({ name: 'request_reason', type: 'text', nullable: true })
  requestReason!: string | null;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 36, nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_remarks', type: 'text', nullable: true })
  reviewRemarks!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
