import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('location_settlements')
@Index(
  'UQ_location_settlements_tehsil_village_name',
  ['tehsil', 'village', 'name'],
  {
    unique: true,
  },
)
@Index('IDX_location_settlements_tehsil_village', ['tehsil', 'village'])
export class LocationSettlement {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  tehsil!: string;

  @Column({ type: 'varchar', length: 150 })
  village!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  /** false = seeded baseline; true = added by SYSTEM_ADMIN */
  @Column({ name: 'is_custom', type: 'boolean', default: false })
  isCustom!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
