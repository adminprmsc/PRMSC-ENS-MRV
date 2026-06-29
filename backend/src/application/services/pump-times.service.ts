import { Injectable } from '@nestjs/common';
import { OperatorHelpersService } from './operator-helpers.service';

@Injectable()
export class PumpTimesService {
  constructor(private readonly operatorHelpers: OperatorHelpersService) {}

  parseTimeOfDay(value: unknown): string | null {
    if (value == null) {
      return null;
    }
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) {
        return null;
      }
      for (const fmt of ['%H:%M:%S', '%H:%M']) {
        const match =
          fmt === '%H:%M:%S'
            ? /^(\d{2}):(\d{2}):(\d{2})$/.exec(s)
            : /^(\d{2}):(\d{2})$/.exec(s);
        if (match) {
          if (fmt === '%H:%M') {
            return `${match[1]}:${match[2]}:00`;
          }
          return s;
        }
      }
      try {
        const dt = new Date(s.replace('Z', '+00:00'));
        if (!Number.isNaN(dt.getTime())) {
          const h = String(dt.getUTCHours()).padStart(2, '0');
          const m = String(dt.getUTCMinutes()).padStart(2, '0');
          const sec = String(dt.getUTCSeconds()).padStart(2, '0');
          return `${h}:${m}:${sec}`;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  pumpHoursFromStartEnd(start: string, end: string): number {
    const base = new Date('2000-01-01');
    const [sh, sm, ss] = start.split(':').map(Number);
    const [eh, em, es] = end.split(':').map(Number);
    const dtStart = new Date(base);
    dtStart.setHours(sh, sm, ss || 0, 0);
    const dtEnd = new Date(base);
    dtEnd.setHours(eh, em, es || 0, 0);
    if (dtEnd <= dtStart) {
      dtEnd.setDate(dtEnd.getDate() + 1);
    }
    return (dtEnd.getTime() - dtStart.getTime()) / (1000 * 3600);
  }

  timeToJson(t: string | null | undefined): string | null {
    if (!t) {
      return null;
    }
    const parts = t.split(':');
    if (parts.length === 2) {
      return `${parts[0]}:${parts[1]}:00`;
    }
    return t;
  }

  applyPumpTimeFieldsFromPayload(
    record: {
      pumpStartTime?: string | null;
      pumpEndTime?: string | null;
      pumpOperatingHours?: number | null;
    },
    data: Record<string, unknown>,
  ): void {
    if ('pump_start_time' in data) {
      record.pumpStartTime = this.parseTimeOfDay(data.pump_start_time);
    }
    if ('pump_end_time' in data) {
      record.pumpEndTime = this.parseTimeOfDay(data.pump_end_time);
    }
    if (record.pumpStartTime && record.pumpEndTime) {
      record.pumpOperatingHours = this.pumpHoursFromStartEnd(
        record.pumpStartTime,
        record.pumpEndTime,
      );
    } else if ('pump_operating_hours' in data) {
      record.pumpOperatingHours = this.operatorHelpers.coerceOptionalFloat(
        data.pump_operating_hours,
      );
    }
  }
}
