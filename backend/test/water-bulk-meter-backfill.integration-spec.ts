import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../src/app.module';
import { TubewellOperatorService } from '../src/application/services/tubewell-operator.service';
import { WaterMeterVolumeService } from '../src/application/services/water-meter-volume.service';
import { SUBMISSION_STATUS_SUBMITTED } from '../src/domain/constants/submission.constants';
import { Submission } from '../src/infrastructure/database/entities/submission.entity';
import { User } from '../src/infrastructure/database/entities/user.entity';
import { UserWaterSystem } from '../src/infrastructure/database/entities/user-water-system.entity';
import { WaterEnergyLoggingDaily } from '../src/infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../src/infrastructure/database/entities/water-system.entity';
import {
  integrationDatabaseUrl,
  isPostgresReachable,
} from './integration-env';

/** Tubewell operator role id (seed / InitialSchema). */
const TUBEWELL_OPERATOR_ROLE_ID = 'f1111111-1111-4111-a111-111111111101';

/** UTC calendar date (matches TypeORM `date` column serialization). */
function utcLogDate(isoYmd: string): Date {
  return new Date(`${isoYmd}T00:00:00.000Z`);
}

describe('Water bulk meter backfill (Postgres integration)', () => {
  let dbAvailable = false;
  let moduleRef: TestingModule | undefined;
  let dataSource: DataSource;
  let meterVolume: WaterMeterVolumeService;
  let tubewellOperator: TubewellOperatorService;

  let waterSystemId: string;
  let operatorUserId: string;
  let firstMeterLogId: string;
  const testTag = `int-${uuidv4().slice(0, 8)}`;
  const tehsil = 'PAKPATTAN';
  const village = `INT-VIL-${testTag}`;

  const createdLogIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl();
    dbAvailable = await isPostgresReachable();
    if (!dbAvailable) {
      console.warn(
        '[integration] Postgres not reachable — skipping water bulk meter backfill tests. ' +
          'Start: docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up -d postgres',
      );
      return;
    }

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    meterVolume = moduleRef.get(WaterMeterVolumeService);
    tubewellOperator = moduleRef.get(TubewellOperatorService);

    const userRepo = dataSource.getRepository(User);
    const operator = await userRepo
      .createQueryBuilder('u')
      .where('u.role_id = :roleId', { roleId: TUBEWELL_OPERATOR_ROLE_ID })
      .andWhere('u.is_active = true')
      .andWhere('u.signature_svg IS NOT NULL')
      .andWhere("trim(u.signature_svg) <> ''")
      .orderBy('u.created_at', 'ASC')
      .getOne();

    if (!operator) {
      throw new Error(
        'Integration fixture: no active tubewell operator with signature in database',
      );
    }
    operatorUserId = operator.id;

    waterSystemId = uuidv4();
    const wsRepo = dataSource.getRepository(WaterSystem);
    await wsRepo.save(
      wsRepo.create({
        id: waterSystemId,
        tehsil,
        village,
        settlement: '',
        uniqueIdentifier: `UID-${testTag}`,
        bulkMeterInstalled: true,
      }),
    );

    const linkRepo = dataSource.getRepository(UserWaterSystem);
    await linkRepo.save(
      linkRepo.create({
        userId: operatorUserId,
        waterSystemId,
      }),
    );

    const logRepo = dataSource.getRepository(WaterEnergyLoggingDaily);
    firstMeterLogId = uuidv4();
    await logRepo.save(
      logRepo.create({
        id: firstMeterLogId,
        waterSystemId,
        logDate: utcLogDate('2026-06-04'),
        pumpStartTime: '08:00:00',
        pumpEndTime: '11:30:00',
        pumpOperatingHours: 3.5,
        meterReadingStart: 900,
        meterReadingEnd: 1000,
        totalWaterPumped: 100,
        status: SUBMISSION_STATUS_SUBMITTED,
        signed: true,
      }),
    );
  }, 120_000);

  afterAll(async () => {
    if (!dbAvailable || !moduleRef) return;

    try {
      const logRepo = dataSource.getRepository(WaterEnergyLoggingDaily);
      const subRepo = dataSource.getRepository(Submission);
      const allLogIds = [
        firstMeterLogId,
        ...createdLogIds.filter((id) => id !== firstMeterLogId),
      ];

      for (const logId of allLogIds) {
        const subs = await subRepo.find({ where: { recordId: logId } });
        for (const sub of subs) {
          await dataSource.query(
            'DELETE FROM notifications WHERE submission_id = $1',
            [sub.id],
          );
          await dataSource.query(
            'DELETE FROM verification_logs WHERE submission_id = $1',
            [sub.id],
          );
          await subRepo.delete(sub.id);
        }
        await logRepo.delete(logId);
      }

      await dataSource.getRepository(UserWaterSystem).delete({
        userId: operatorUserId,
        waterSystemId,
      });
      await dataSource.getRepository(WaterSystem).delete(waterSystemId);
    } finally {
      await moduleRef.close();
    }
  }, 60_000);

  function skipIfNoDb(): boolean {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  }

  it('logRequiresBulkMeterCapture is false before first meter log date', async () => {
    if (skipIfNoDb()) return;

    const requires = await meterVolume.logRequiresBulkMeterCapture({
      bulkMeterInstalled: true,
      waterSystemId,
      logDate: utcLogDate('2025-07-15'),
      pumpEndTime: '12:00:00',
    });
    expect(requires).toBe(false);
  });

  it('logRequiresBulkMeterCapture is false on first meter day before first interval ends', async () => {
    if (skipIfNoDb()) return;

    const requires = await meterVolume.logRequiresBulkMeterCapture({
      bulkMeterInstalled: true,
      waterSystemId,
      logDate: utcLogDate('2026-06-04'),
      pumpEndTime: '09:00:00',
    });
    expect(requires).toBe(false);
  });

  it('logRequiresBulkMeterCapture is true on/after first meter log', async () => {
    if (skipIfNoDb()) return;

    const requires = await meterVolume.logRequiresBulkMeterCapture({
      bulkMeterInstalled: true,
      waterSystemId,
      logDate: utcLogDate('2026-06-05'),
      pumpEndTime: '12:00:00',
    });
    expect(requires).toBe(true);
  });

  it('getWaterMeterContext exposes requires_bulk_meter_log for backfill date', async () => {
    if (skipIfNoDb()) return;

    const ctx = await tubewellOperator.getWaterMeterContext(operatorUserId, {
      system_id: waterSystemId,
      log_date: '2025-07-15',
    });
    expect(ctx.bulk_meter_installed).toBe(true);
    expect(ctx.requires_bulk_meter_log).toBe(false);
  });

  it('saveWaterSupplyData accepts pump-only submit before meter era', async () => {
    if (skipIfNoDb()) return;

    const result = await tubewellOperator.saveWaterSupplyData(operatorUserId, {
      year: 2025,
      status: 'submitted',
      data: [
        {
          system_id: waterSystemId,
          tehsil,
          village,
          settlement: '',
          monthlyData: [
            {
              month: 7,
              day: 20,
              pump_start_time: '07:30:00',
              pump_end_time: '11:00:00',
            },
          ],
        },
      ],
    });

    expect(result.record_ids?.length).toBe(1);
    createdLogIds.push(String(result.record_ids![0]));

    const logRepo = dataSource.getRepository(WaterEnergyLoggingDaily);
    const saved = await logRepo.findOne({
      where: { id: String(result.record_ids![0]) },
    });
    expect(saved?.meterReadingEnd).toBeNull();
    expect(saved?.pumpOperatingHours).not.toBeNull();
  });

  it('saveWaterSupplyData rejects pump-only submit in meter era', async () => {
    if (skipIfNoDb()) return;

    await expect(
      tubewellOperator.saveWaterSupplyData(operatorUserId, {
        year: 2026,
        status: 'submitted',
        data: [
          {
            system_id: waterSystemId,
            tehsil,
            village,
            settlement: '',
            monthlyData: [
              {
                month: 6,
                day: 6,
                pump_start_time: '08:00:00',
                pump_end_time: '10:00:00',
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
