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
import {
  checkPasswordHash,
  generatePasswordHash,
} from '../../auth/werkzeug-password';
import { Role } from './role.entity';
import { UserTehsil } from './user-tehsil.entity';
import { UserWaterSystem } from './user-water-system.entity';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 36, default: () => uuidv4() })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ name: 'signature_svg', type: 'text', nullable: true })
  signatureSvg!: string | null;

  @Column({ name: 'role_id', type: 'varchar', length: 36 })
  roleId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  @JoinColumn({ name: 'role_id' })
  assignedRole!: Role;

  @OneToMany(() => UserTehsil, (link) => link.user, { cascade: true })
  tehsilLinks!: UserTehsil[];

  @OneToMany(() => UserWaterSystem, (link) => link.user, { cascade: true })
  waterSystemLinks!: UserWaterSystem[];

  get role(): string | null {
    return this.assignedRole?.code ?? null;
  }

  get assignedWaterSystemIds(): string[] {
    return (this.waterSystemLinks ?? []).map((link) =>
      String(link.waterSystemId),
    );
  }

  setPassword(password: string): void {
    this.passwordHash = generatePasswordHash(password);
  }

  checkPassword(password: string): boolean {
    return checkPasswordHash(this.passwordHash, password);
  }
}
