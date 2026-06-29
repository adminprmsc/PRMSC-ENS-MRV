import { PumpTimesService } from './pump-times.service';
import { OperatorHelpersService } from './operator-helpers.service';

describe('PumpTimesService', () => {
  const service = new PumpTimesService(new OperatorHelpersService());

  it('parses HH:MM time', () => {
    expect(service.parseTimeOfDay('08:30')).toBe('08:30:00');
  });

  it('computes pump hours including overnight', () => {
    const hours = service.pumpHoursFromStartEnd('22:00:00', '06:00:00');
    expect(hours).toBeCloseTo(8, 5);
  });

  it('derives pump hours when both times set on record', () => {
    const record: {
      pumpStartTime?: string | null;
      pumpEndTime?: string | null;
      pumpOperatingHours?: number | null;
    } = {};
    service.applyPumpTimeFieldsFromPayload(record, {
      pump_start_time: '08:00',
      pump_end_time: '12:00',
    });
    expect(record.pumpStartTime).toBe('08:00:00');
    expect(record.pumpEndTime).toBe('12:00:00');
    expect(record.pumpOperatingHours).toBeCloseTo(4, 5);
  });
});
