import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { METER_TYPE_SOLAR, METER_TYPE_TUBEWELL } from '../../domain/constants/submission.constants';
import {
  toIsoDateString,
  toIsoDateTimeString,
} from '../../domain/utils/date.util';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { SystemMeter } from '../../infrastructure/database/entities/system-meter.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';

export const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'pdf']);

@Injectable()
export class OperatorHelpersService {
  constructor(
    @InjectRepository(SolarSystem)
    private readonly solarSystemRepo: Repository<SolarSystem>,
    @InjectRepository(SystemMeter)
    private readonly systemMeterRepo: Repository<SystemMeter>,
  ) {}

  parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) {
      return null;
    }
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  allowedFile(filename: string): boolean {
    const parts = filename.split('.');
    if (parts.length < 2) {
      return false;
    }
    const ext = parts[parts.length - 1].toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext);
  }

  async findSolarSystemByLocation(
    tehsilCanonical: string,
    village: string,
    settlementRaw?: string | null,
    repo: Repository<SolarSystem> = this.solarSystemRepo,
  ): Promise<SolarSystem | null> {
    if (!village) {
      return null;
    }
    const st = (settlementRaw ?? '').trim();
    if (st) {
      return repo.findOne({
        where: { tehsil: tehsilCanonical, village, settlement: st },
      });
    }
    return repo.findOne({
      where: [
        { tehsil: tehsilCanonical, village, settlement: IsNull() },
        { tehsil: tehsilCanonical, village, settlement: '' },
      ],
    });
  }

  coerceOptionalFloat(val: unknown): number | null {
    if (val == null || val === '') {
      return null;
    }
    if (typeof val === 'boolean') {
      throw new Error(`Invalid numeric value: ${String(val)}`);
    }
    if (typeof val === 'number') {
      return val;
    }
    const parsed = parseFloat(String(val).trim());
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid numeric value: ${String(val)}`);
    }
    return parsed;
  }

  coerceOptionalStr(value: unknown): string | null {
    if (value == null) {
      return null;
    }
    const s = String(value).trim();
    return s || null;
  }

  meterToDict(
    meter: SystemMeter | null | undefined,
  ): Record<string, unknown> | null {
    if (!meter) {
      return null;
    }
    return {
      id: String(meter.id),
      meter_type: meter.meterType,
      meter_model: meter.meterModel,
      meter_serial_number: meter.meterSerialNumber,
      meter_accuracy_class: meter.meterAccuracyClass,
      installation_date: toIsoDateString(meter.installationDate),
      is_active: Boolean(meter.isActive),
      created_at: toIsoDateTimeString(meter.createdAt),
      updated_at: toIsoDateTimeString(meter.updatedAt),
    };
  }

  async getSystemMeters(
    system: WaterSystem | SolarSystem,
    repo: Repository<SystemMeter> = this.systemMeterRepo,
  ): Promise<SystemMeter[]> {
    const isWater = 'bulkMeterInstalled' in system;
    return repo.find({
      where: isWater
        ? { waterSystemId: system.id }
        : { solarSystemId: system.id },
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveMeter(
    system: WaterSystem | SolarSystem,
    repo: Repository<SystemMeter> = this.systemMeterRepo,
  ): Promise<SystemMeter | null> {
    const active = system.activeMeter;
    if (active) {
      return active;
    }
    const meterType =
      'bulkMeterInstalled' in system ? METER_TYPE_TUBEWELL : METER_TYPE_SOLAR;
    const meters = await this.getSystemMeters(system, repo);
    return meters.find((m) => m.isActive && m.meterType === meterType) ?? null;
  }

  async upsertActiveSystemMeter(
    options: {
      meterType: string;
      waterSystemId?: string | null;
      solarSystemId?: string | null;
      meterModel?: string | null;
      meterSerialNumber?: string | null;
      meterAccuracyClass?: string | null;
      installationDate?: Date | string | null;
      updateMode?: string;
    },
    repo: Repository<SystemMeter> = this.systemMeterRepo,
  ): Promise<SystemMeter | null> {
    const {
      meterType,
      waterSystemId,
      solarSystemId,
      meterModel,
      meterSerialNumber,
      meterAccuracyClass,
      updateMode = 'auto',
    } = options;

    if (meterType !== METER_TYPE_TUBEWELL && meterType !== METER_TYPE_SOLAR) {
      throw new Error('Invalid meter_type');
    }
    if (Boolean(waterSystemId) === Boolean(solarSystemId)) {
      throw new Error('Exactly one system id is required for meter upsert');
    }

    const model = this.coerceOptionalStr(meterModel);
    const serial = this.coerceOptionalStr(meterSerialNumber);
    const accuracy = this.coerceOptionalStr(meterAccuracyClass);
    const parsedInstallationDate =
      options.installationDate instanceof Date
        ? options.installationDate
        : this.parseDate(
            options.installationDate != null
              ? String(options.installationDate)
              : null,
          );
    const hasPayload = Boolean(
      model || serial || accuracy || parsedInstallationDate,
    );

    const current = await repo.findOne({
      where: {
        meterType,
        waterSystemId: waterSystemId ?? undefined,
        solarSystemId: solarSystemId ?? undefined,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!hasPayload) {
      if (current) {
        current.isActive = false;
        await repo.save(current);
      }
      return null;
    }

    if (!['auto', 'update_current', 'switch_new'].includes(updateMode)) {
      throw new Error('Invalid meter update mode');
    }

    if (updateMode === 'update_current' && current) {
      current.meterModel = model;
      current.meterSerialNumber = serial;
      current.meterAccuracyClass = accuracy;
      current.installationDate = parsedInstallationDate;
      current.isActive = true;
      return repo.save(current);
    }

    if (
      current &&
      current.meterModel === model &&
      current.meterSerialNumber === serial &&
      current.meterAccuracyClass === accuracy &&
      current.installationDate?.getTime() === parsedInstallationDate?.getTime()
    ) {
      return current;
    }

    if (current) {
      current.isActive = false;
      await repo.save(current);
    }

    const meter = repo.create({
      meterType,
      waterSystemId: waterSystemId ?? null,
      solarSystemId: solarSystemId ?? null,
      meterModel: model,
      meterSerialNumber: serial,
      meterAccuracyClass: accuracy,
      installationDate: parsedInstallationDate,
      isActive: true,
    });
    return repo.save(meter);
  }
}
