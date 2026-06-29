import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import {
  MeterReadingOrderError,
  WaterMeterVolumeService,
} from './water-meter-volume.service';

function log(
  overrides: Partial<WaterEnergyLoggingDaily> = {},
): WaterEnergyLoggingDaily {
  const record = new WaterEnergyLoggingDaily();
  record.id = 'log-1';
  record.waterSystemId = 'ws-1';
  record.status = 'submitted';
  record.logDate = new Date('2025-06-01');
  record.pumpStartTime = '08:00:00';
  record.pumpEndTime = '12:00:00';
  Object.assign(record, overrides);
  return record;
}

describe('WaterMeterVolumeService', () => {
  let service: WaterMeterVolumeService;
  const mockRepo = {
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaterMeterVolumeService,
        {
          provide: getRepositoryToken(WaterEnergyLoggingDaily),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get(WaterMeterVolumeService);
    jest.clearAllMocks();
  });

  describe('intervalVolumeFromLog', () => {
    it('computes interval from meter start and end', () => {
      const record = log({ meterReadingStart: 100, meterReadingEnd: 150 });
      const [vol, newEnd] = service.intervalVolumeFromLog(record, null);
      expect(vol).toBe(50);
      expect(newEnd).toBe(150);
    });

    it('computes interval from previous end', () => {
      const record = log({ meterReadingEnd: 200 });
      const [vol, newEnd] = service.intervalVolumeFromLog(record, 150);
      expect(vol).toBe(50);
      expect(newEnd).toBe(200);
    });
  });

  describe('resolveBulkMeterVolumes', () => {
    it('requires start reading for first log', async () => {
      jest
        .spyOn(service, 'getLatestSubmittedMeterReadingEnd')
        .mockResolvedValue(null);
      await expect(
        service.resolveBulkMeterVolumes({
          waterSystemId: 'ws-1',
          logDate: new Date('2025-06-01'),
          pumpEndTime: '12:00:00',
          meterReadingEnd: 100,
          meterReadingStart: null,
        }),
      ).rejects.toThrow('meter_reading_start is required');
    });

    it('computes delta from start on first log', async () => {
      jest
        .spyOn(service, 'getLatestSubmittedMeterReadingEnd')
        .mockResolvedValue(null);
      const result = await service.resolveBulkMeterVolumes({
        waterSystemId: 'ws-1',
        logDate: new Date('2025-06-01'),
        pumpEndTime: '12:00:00',
        meterReadingEnd: 150,
        meterReadingStart: 100,
      });
      expect(result.meter_reading_start).toBe(100);
      expect(result.meter_reading_end).toBe(150);
      expect(result.total_water_pumped).toBe(50);
    });

    it('rejects end reading not greater than latest submitted', async () => {
      jest
        .spyOn(service, 'getLatestSubmittedMeterReadingEnd')
        .mockResolvedValue(57082);
      await expect(
        service.resolveBulkMeterVolumes({
          waterSystemId: 'ws-1',
          logDate: new Date('2025-06-02'),
          pumpEndTime: '12:00:00',
          meterReadingEnd: 57082,
        }),
      ).rejects.toBeInstanceOf(MeterReadingOrderError);

      try {
        await service.resolveBulkMeterVolumes({
          waterSystemId: 'ws-1',
          logDate: new Date('2025-06-02'),
          pumpEndTime: '12:00:00',
          meterReadingEnd: 57082,
        });
      } catch (e) {
        const err = e as MeterReadingOrderError;
        expect(err.code).toBe('meter_reading_order');
        expect(err.baseVal).toBe(57082);
      }
    });

    it('accepts higher end reading after prior submitted end', async () => {
      jest
        .spyOn(service, 'getLatestSubmittedMeterReadingEnd')
        .mockResolvedValue(57082);
      const result = await service.resolveBulkMeterVolumes({
        waterSystemId: 'ws-1',
        logDate: new Date('2025-06-02'),
        pumpEndTime: '12:00:00',
        meterReadingEnd: 57100,
      });
      expect(result.meter_reading_start).toBe(57082);
      expect(result.meter_reading_end).toBe(57100);
      expect(result.total_water_pumped).toBe(18);
    });
  });
});
