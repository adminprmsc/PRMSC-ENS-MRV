import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SUBMISSION_STATUS_REJECTED } from '../../domain/constants/submission.constants';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { WaterMeterBackfillService } from './water-meter-backfill.service';
import { WaterMeterVolumeService } from './water-meter-volume.service';

describe('WaterMeterBackfillService', () => {
  let service: WaterMeterBackfillService;

  beforeEach(async () => {
    const waterLogRepo: Pick<
      Repository<WaterEnergyLoggingDaily>,
      'find' | 'findOne' | 'save'
    > = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const waterSystemRepo: Pick<
      Repository<WaterSystem>,
      'createQueryBuilder'
    > = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaterMeterBackfillService,
        WaterMeterVolumeService,
        {
          provide: getRepositoryToken(WaterEnergyLoggingDaily),
          useValue: waterLogRepo,
        },
        {
          provide: getRepositoryToken(WaterSystem),
          useValue: waterSystemRepo,
        },
      ],
    }).compile();

    service = module.get(WaterMeterBackfillService);
  });

  it('plans interval correction from legacy cumulative readings', () => {
    const log1 = new WaterEnergyLoggingDaily();
    log1.id = 'a';
    log1.waterSystemId = 'ws-1';
    log1.logDate = new Date('2025-01-01');
    log1.meterReadingStart = 100;
    log1.meterReadingEnd = 150;
    log1.totalWaterPumped = 50;

    const log2 = new WaterEnergyLoggingDaily();
    log2.id = 'b';
    log2.waterSystemId = 'ws-1';
    log2.logDate = new Date('2025-01-02');
    log2.totalWaterPumped = 180;

    const { corrections, issues } = service.planMeterCorrectionsForLogs(
      [log1, log2],
      true,
    );

    expect(issues).toHaveLength(0);
    expect(corrections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          logId: 'b',
          newMeterReadingStart: 150,
          newMeterReadingEnd: 180,
          newTotalWaterPumped: 30,
        }),
      ]),
    );
  });

  it('skips rejected logs', () => {
    const log = new WaterEnergyLoggingDaily();
    log.id = 'x';
    log.waterSystemId = 'ws-1';
    log.status = SUBMISSION_STATUS_REJECTED;
    log.totalWaterPumped = 100;

    const { corrections } = service.planMeterCorrectionsForLogs([log], true);
    expect(corrections).toHaveLength(0);
  });
});
