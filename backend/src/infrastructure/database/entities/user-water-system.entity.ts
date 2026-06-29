import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { WaterSystem } from './water-system.entity';

@Entity('user_water_systems')
export class UserWaterSystem {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @PrimaryColumn({ name: 'water_system_id', type: 'varchar', length: 36 })
  waterSystemId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.waterSystemLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => WaterSystem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'water_system_id' })
  waterSystem!: WaterSystem;
}
