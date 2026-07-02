import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Narrow SYSTEM_ADMIN to platform user administration.
 * SUPER_ADMIN permissions reflect tehsil-scoped HQ review (scope via user_manageroperation).
 */
export class NarrowSystemAdminRole1740000000001 implements MigrationInterface {
  name = 'NarrowSystemAdminRole1740000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const superAdminPerms = JSON.stringify([
      'data.read_scoped',
      'dashboard.program',
      'submissions.read_scoped',
      'water_systems.read_scoped',
      'solar_systems.read_scoped',
      'water_logs.read_scoped',
      'solar_monthly_logs.read_scoped',
      'audit.read_scoped',
      'notifications.read',
    ]);

    const systemAdminPerms = JSON.stringify([
      'users.create',
      'users.read',
      'users.update',
      'users.update_role',
      'users.assign_tehsils',
      'users.reset_password',
      'dashboard.admin',
      'notifications.read',
    ]);

    await queryRunner.query(
      `UPDATE roles SET permissions = $1::jsonb, display_name = 'Manager Operations', updated_at = now()
       WHERE code = 'SUPER_ADMIN'`,
      [superAdminPerms],
    );

    await queryRunner.query(
      `UPDATE roles SET permissions = $1::jsonb, display_name = 'Platform Administrator', updated_at = now()
       WHERE code = 'SYSTEM_ADMIN'`,
      [systemAdminPerms],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const legacySuper = JSON.stringify([
      'data.read_all',
      'dashboard.program',
      'users.read',
      'submissions.read_all',
      'water_systems.read_all',
      'solar_systems.read_all',
      'water_logs.read_all',
      'solar_monthly_logs.read_all',
      'audit.read_all',
      'notifications.read',
    ]);
    const legacySystem = JSON.stringify([
      'data.read_all',
      'dashboard.program',
      'users.read',
      'submissions.read_all',
      'water_systems.read_all',
      'solar_systems.read_all',
      'water_logs.read_all',
      'solar_monthly_logs.read_all',
      'audit.read_all',
      'notifications.read',
      'org.read_all',
    ]);

    await queryRunner.query(
      `UPDATE roles SET permissions = $1::jsonb, display_name = 'Manager Operations', updated_at = now()
       WHERE code = 'SUPER_ADMIN'`,
      [legacySuper],
    );

    await queryRunner.query(
      `UPDATE roles SET permissions = $1::jsonb, display_name = 'MRV COO', updated_at = now()
       WHERE code = 'SYSTEM_ADMIN'`,
      [legacySystem],
    );
  }
}
