import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  PREDEFINED_TAHSILS,
  canonicalTehsil,
} from '../../domain/constants/tehsils';
import { LocationSettlement } from '../../infrastructure/database/entities/location-settlement.entity';
import { LocationVillage } from '../../infrastructure/database/entities/location-village.entity';

type LocationSeedFile = {
  tehsils: string[];
  villages: Array<{ tehsil: string; name: string }>;
  settlements: Array<{ tehsil: string; village: string; name: string }>;
};

export type LocationCatalogResponse = {
  tehsils: string[];
  villages_by_tehsil: Record<string, string[]>;
  settlements_by_tehsil_village: Record<string, Record<string, string[]>>;
  meta: {
    village_count: number;
    settlement_count: number;
    custom_village_count: number;
    custom_settlement_count: number;
  };
};

@Injectable()
export class LocationsService implements OnModuleInit {
  private readonly logger = new Logger(LocationsService.name);
  private seedPromise: Promise<void> | null = null;

  constructor(
    @InjectRepository(LocationVillage)
    private readonly villageRepo: Repository<LocationVillage>,
    @InjectRepository(LocationSettlement)
    private readonly settlementRepo: Repository<LocationSettlement>,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureSeeded();
    } catch (err) {
      this.logger.warn(
        `Location catalog seed skipped/failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private normalizeName(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
  }

  private async ensureSeeded(): Promise<void> {
    if (!this.seedPromise) {
      this.seedPromise = this.seedIfEmpty().catch((err) => {
        this.seedPromise = null;
        throw err;
      });
    }
    await this.seedPromise;
  }

  private loadSeedFile(): LocationSeedFile {
    const candidates = [
      join(__dirname, '../../domain/constants/location-seed.json'),
      join(process.cwd(), 'dist/domain/constants/location-seed.json'),
      join(process.cwd(), 'src/domain/constants/location-seed.json'),
    ];
    for (const path of candidates) {
      try {
        const raw = readFileSync(path, 'utf8');
        return JSON.parse(raw) as LocationSeedFile;
      } catch {
        // try next
      }
    }
    throw new Error('location-seed.json not found');
  }

  private dedupeKey(...parts: string[]): string {
    return parts.map((p) => p.trim().toUpperCase()).join('\0');
  }

  private async seedIfEmpty(): Promise<void> {
    const [villageCount, settlementCount] = await Promise.all([
      this.villageRepo.count(),
      this.settlementRepo.count(),
    ]);
    if (villageCount > 0 && settlementCount > 0) {
      return;
    }

    const seed = this.loadSeedFile();
    this.logger.log(
      `Seeding location catalog (villages=${villageCount}, settlements=${settlementCount}; source ${seed.villages.length}/${seed.settlements.length})…`,
    );

    const batchSize = 500;

    if (villageCount === 0) {
      const seenVillages = new Set<string>();
      const villageRows: LocationVillage[] = [];
      for (const v of seed.villages) {
        const tehsil = v.tehsil.trim();
        const name = this.normalizeName(v.name);
        if (!tehsil || !name) continue;
        const key = this.dedupeKey(tehsil, name);
        if (seenVillages.has(key)) continue;
        seenVillages.add(key);
        villageRows.push(
          this.villageRepo.create({
            id: uuidv4(),
            tehsil,
            name,
            isCustom: false,
            isActive: true,
            createdBy: null,
          }),
        );
      }
      for (let i = 0; i < villageRows.length; i += batchSize) {
        await this.villageRepo.save(villageRows.slice(i, i + batchSize));
      }
      this.logger.log(`Seeded ${villageRows.length} villages`);
    }

    if (settlementCount === 0) {
      const seenSettlements = new Set<string>();
      const settlementRows: LocationSettlement[] = [];
      for (const s of seed.settlements) {
        const tehsil = s.tehsil.trim();
        const village = this.normalizeName(s.village);
        const name = this.normalizeName(s.name);
        if (!tehsil || !village || !name) continue;
        const key = this.dedupeKey(tehsil, village, name);
        if (seenSettlements.has(key)) continue;
        seenSettlements.add(key);
        settlementRows.push(
          this.settlementRepo.create({
            id: uuidv4(),
            tehsil,
            village,
            name,
            isCustom: false,
            isActive: true,
            createdBy: null,
          }),
        );
      }
      for (let i = 0; i < settlementRows.length; i += batchSize) {
        await this.settlementRepo.save(settlementRows.slice(i, i + batchSize));
      }
      this.logger.log(`Seeded ${settlementRows.length} settlements`);
    }

    this.logger.log('Location catalog seed complete');
  }

  async getCatalog(options?: {
    tehsil?: string;
    includeInactive?: boolean;
  }): Promise<LocationCatalogResponse> {
    await this.ensureSeeded();

    const includeInactive = options?.includeInactive === true;
    let tehsilFilter: string | null = null;
    if (options?.tehsil) {
      tehsilFilter = canonicalTehsil(options.tehsil);
      if (!tehsilFilter) {
        throw new BadRequestException({ message: 'Invalid tehsil' });
      }
    }

    const villageWhere: Record<string, unknown> = {};
    if (!includeInactive) villageWhere.isActive = true;
    if (tehsilFilter) villageWhere.tehsil = tehsilFilter;

    const settlementWhere: Record<string, unknown> = {};
    if (!includeInactive) settlementWhere.isActive = true;
    if (tehsilFilter) settlementWhere.tehsil = tehsilFilter;

    const [villages, settlements] = await Promise.all([
      this.villageRepo.find({
        where: villageWhere,
        order: { tehsil: 'ASC', name: 'ASC' },
      }),
      this.settlementRepo.find({
        where: settlementWhere,
        order: { tehsil: 'ASC', village: 'ASC', name: 'ASC' },
      }),
    ]);

    const villagesByTehsil: Record<string, string[]> = {};
    for (const t of PREDEFINED_TAHSILS) {
      if (!tehsilFilter || t === tehsilFilter) {
        villagesByTehsil[t] = [];
      }
    }
    for (const v of villages) {
      if (!villagesByTehsil[v.tehsil]) villagesByTehsil[v.tehsil] = [];
      villagesByTehsil[v.tehsil].push(v.name);
    }

    const settlementsByTehsilVillage: Record<
      string,
      Record<string, string[]>
    > = {};
    for (const s of settlements) {
      if (!settlementsByTehsilVillage[s.tehsil]) {
        settlementsByTehsilVillage[s.tehsil] = {};
      }
      const byVillage = settlementsByTehsilVillage[s.tehsil];
      if (!byVillage[s.village]) byVillage[s.village] = [];
      byVillage[s.village].push(s.name);
    }

    return {
      tehsils: tehsilFilter ? [tehsilFilter] : [...PREDEFINED_TAHSILS],
      villages_by_tehsil: villagesByTehsil,
      settlements_by_tehsil_village: settlementsByTehsilVillage,
      meta: {
        village_count: villages.length,
        settlement_count: settlements.length,
        custom_village_count: villages.filter((v) => v.isCustom).length,
        custom_settlement_count: settlements.filter((s) => s.isCustom).length,
      },
    };
  }

  async listVillages(query: {
    tehsil?: string;
    customOnly?: boolean;
    includeInactive?: boolean;
  }) {
    await this.ensureSeeded();
    const where: Record<string, unknown> = {};
    if (query.tehsil) {
      const ct = canonicalTehsil(query.tehsil);
      if (!ct) throw new BadRequestException({ message: 'Invalid tehsil' });
      where.tehsil = ct;
    }
    if (query.customOnly) where.isCustom = true;
    if (!query.includeInactive) where.isActive = true;

    const rows = await this.villageRepo.find({
      where,
      order: { tehsil: 'ASC', name: 'ASC' },
    });
    return {
      villages: rows.map((r) => ({
        id: r.id,
        tehsil: r.tehsil,
        name: r.name,
        is_custom: r.isCustom,
        is_active: r.isActive,
        created_by: r.createdBy,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })),
    };
  }

  async listSettlements(query: {
    tehsil?: string;
    village?: string;
    customOnly?: boolean;
    includeInactive?: boolean;
  }) {
    await this.ensureSeeded();
    const where: Record<string, unknown> = {};
    if (query.tehsil) {
      const ct = canonicalTehsil(query.tehsil);
      if (!ct) throw new BadRequestException({ message: 'Invalid tehsil' });
      where.tehsil = ct;
    }
    if (query.village) where.village = this.normalizeName(query.village);
    if (query.customOnly) where.isCustom = true;
    if (!query.includeInactive) where.isActive = true;

    const rows = await this.settlementRepo.find({
      where,
      order: { tehsil: 'ASC', village: 'ASC', name: 'ASC' },
    });
    return {
      settlements: rows.map((r) => ({
        id: r.id,
        tehsil: r.tehsil,
        village: r.village,
        name: r.name,
        is_custom: r.isCustom,
        is_active: r.isActive,
        created_by: r.createdBy,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })),
    };
  }

  async addVillage(actorId: string, body: { tehsil?: string; name?: string }) {
    await this.ensureSeeded();
    const tehsil = canonicalTehsil(body.tehsil);
    if (!tehsil) {
      throw new BadRequestException({
        message: 'tehsil is required and must be a known tehsil',
      });
    }
    const name = this.normalizeName(body.name ?? '');
    if (name.length < 2) {
      throw new BadRequestException({
        message: 'Village name must be at least 2 characters',
      });
    }

    const existing = await this.villageRepo.findOne({
      where: { tehsil, name },
    });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.isCustom = true;
        existing.createdBy = actorId;
        const saved = await this.villageRepo.save(existing);
        return {
          message: 'Village reactivated',
          village: this.serializeVillage(saved),
        };
      }
      throw new ConflictException({
        message: `Village “${name}” already exists under ${tehsil}`,
      });
    }

    const row = this.villageRepo.create({
      id: uuidv4(),
      tehsil,
      name,
      isCustom: true,
      isActive: true,
      createdBy: actorId,
    });
    const saved = await this.villageRepo.save(row);
    return {
      message: 'Village added',
      village: this.serializeVillage(saved),
    };
  }

  async addSettlement(
    actorId: string,
    body: { tehsil?: string; village?: string; name?: string },
  ) {
    await this.ensureSeeded();
    const tehsil = canonicalTehsil(body.tehsil);
    if (!tehsil) {
      throw new BadRequestException({
        message: 'tehsil is required and must be a known tehsil',
      });
    }
    const village = this.normalizeName(body.village ?? '');
    if (village.length < 2) {
      throw new BadRequestException({ message: 'village is required' });
    }
    const name = this.normalizeName(body.name ?? '');
    if (name.length < 2) {
      throw new BadRequestException({
        message: 'Settlement name must be at least 2 characters',
      });
    }

    const parent = await this.villageRepo.findOne({
      where: { tehsil, name: village, isActive: true },
    });
    if (!parent) {
      throw new BadRequestException({
        message: `Village “${village}” is not in the catalog for ${tehsil}. Add the village first.`,
      });
    }

    const existing = await this.settlementRepo.findOne({
      where: { tehsil, village, name },
    });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.isCustom = true;
        existing.createdBy = actorId;
        const saved = await this.settlementRepo.save(existing);
        return {
          message: 'Settlement reactivated',
          settlement: this.serializeSettlement(saved),
        };
      }
      throw new ConflictException({
        message: `Settlement “${name}” already exists under ${village}`,
      });
    }

    const row = this.settlementRepo.create({
      id: uuidv4(),
      tehsil,
      village,
      name,
      isCustom: true,
      isActive: true,
      createdBy: actorId,
    });
    const saved = await this.settlementRepo.save(row);
    return {
      message: 'Settlement added',
      settlement: this.serializeSettlement(saved),
    };
  }

  async deactivateVillage(id: string) {
    await this.ensureSeeded();
    const row = await this.villageRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Village not found' });
    if (!row.isCustom) {
      throw new BadRequestException({
        message:
          'Baseline seeded villages cannot be removed. Only custom villages can be deactivated.',
      });
    }
    row.isActive = false;
    await this.villageRepo.save(row);
    // also deactivate settlements under it
    const settlements = await this.settlementRepo.find({
      where: { tehsil: row.tehsil, village: row.name, isActive: true },
    });
    if (settlements.length) {
      for (const s of settlements) s.isActive = false;
      await this.settlementRepo.save(settlements);
    }
    return { message: 'Village deactivated' };
  }

  async deactivateSettlement(id: string) {
    await this.ensureSeeded();
    const row = await this.settlementRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Settlement not found' });
    if (!row.isCustom) {
      throw new BadRequestException({
        message:
          'Baseline seeded settlements cannot be removed. Only custom settlements can be deactivated.',
      });
    }
    row.isActive = false;
    await this.settlementRepo.save(row);
    return { message: 'Settlement deactivated' };
  }

  /** Used by registration validation — optional soft check. */
  async assertVillageExists(tehsil: string, village: string): Promise<void> {
    await this.ensureSeeded();
    const ct = canonicalTehsil(tehsil);
    if (!ct) throw new BadRequestException({ message: 'Invalid tehsil' });
    const name = this.normalizeName(village);
    const row = await this.villageRepo.findOne({
      where: { tehsil: ct, name, isActive: true },
    });
    if (!row) {
      throw new BadRequestException({
        message: `Village “${name}” is not in the location catalog for ${ct}`,
      });
    }
  }

  async assertSettlementExists(
    tehsil: string,
    village: string,
    settlement: string,
  ): Promise<void> {
    await this.ensureSeeded();
    const ct = canonicalTehsil(tehsil);
    if (!ct) throw new BadRequestException({ message: 'Invalid tehsil' });
    const v = this.normalizeName(village);
    const s = this.normalizeName(settlement);
    if (!s) return;
    const row = await this.settlementRepo.findOne({
      where: { tehsil: ct, village: v, name: s, isActive: true },
    });
    if (!row) {
      throw new BadRequestException({
        message: `Settlement “${s}” is not in the location catalog for ${v}`,
      });
    }
  }

  private serializeVillage(r: LocationVillage) {
    return {
      id: r.id,
      tehsil: r.tehsil,
      name: r.name,
      is_custom: r.isCustom,
      is_active: r.isActive,
      created_by: r.createdBy,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    };
  }

  private serializeSettlement(r: LocationSettlement) {
    return {
      id: r.id,
      tehsil: r.tehsil,
      village: r.village,
      name: r.name,
      is_custom: r.isCustom,
      is_active: r.isActive,
      created_by: r.createdBy,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    };
  }
}
