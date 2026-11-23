import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ADMIN, SUPER_ADMIN, SYSTEM_ADMIN } from '../../domain/constants/roles';
import {
  PREDEFINED_TAHSILS,
  canonicalTehsil,
} from '../../domain/constants/tehsils';
import {
  buildPopulationTree,
  parsePopulation,
  type TehsilNode,
} from '../../domain/utils/population.util';
import { computeCoverage } from '../../domain/utils/population-coverage.util';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { LocationPopulationLog } from '../../infrastructure/database/entities/location-population-log.entity';
import { LocationSettlement } from '../../infrastructure/database/entities/location-settlement.entity';
import { LocationVillage } from '../../infrastructure/database/entities/location-village.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { RbacService } from './rbac.service';
import { TehsilAccessService } from './tehsil-access.service';
import { UserService } from './user.service';

export type GeographyScope = {
  role: string;
  tehsils: string[];
  can_edit: boolean;
};

export type PopulationUpdate = {
  type: 'village' | 'settlement';
  id: string;
  population: number;
};

const MAX_UPDATES_PER_REQUEST = 500;

@Injectable()
export class GeographyService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LocationVillage)
    private readonly villageRepo: Repository<LocationVillage>,
    @InjectRepository(LocationSettlement)
    private readonly settlementRepo: Repository<LocationSettlement>,
    @InjectRepository(LocationPopulationLog)
    private readonly logRepo: Repository<LocationPopulationLog>,
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    private readonly userService: UserService,
    private readonly rbac: RbacService,
    private readonly tehsilAccess: TehsilAccessService,
  ) {}

  /** Role and tehsil scope come from the DB, not the JWT. */
  private async loadActor(userId: string | undefined): Promise<User> {
    const actor = userId ? await this.userService.getUserById(userId) : null;
    if (!actor) throw new UnauthorizedException({ message: 'User not found' });
    if (actor.isActive === false) {
      throw new ForbiddenException({ message: 'Account is deactivated' });
    }
    return actor;
  }

  /**
   * Managerial scope:
   *  - Tehsil Manager (ADMIN)          → tehsils in `user_tehsils`
   *  - Manager Operations (SUPER_ADMIN) → tehsils in `user_manageroperation`
   *  - Platform admin (SYSTEM_ADMIN)    → all tehsils (catalog owner)
   * Tubewell operators have no access.
   */
  scopeFor(actor: User): GeographyScope {
    const role = this.rbac.userRoleCode(actor);
    let tehsils: string[];
    if (role === SYSTEM_ADMIN) {
      tehsils = [...PREDEFINED_TAHSILS];
    } else if (role === SUPER_ADMIN) {
      tehsils = [...this.rbac.managerOperationTehsilSet(actor)];
    } else if (role === ADMIN) {
      tehsils = [...this.tehsilAccess.canonicalAssignedTehsilSet(actor)];
    } else {
      throw new ForbiddenException({
        message: 'Geography is available to managerial roles only',
      });
    }
    tehsils.sort((a, b) => a.localeCompare(b));
    return { role, tehsils, can_edit: tehsils.length > 0 };
  }

  private narrowScope(scope: GeographyScope, rawTehsil?: string): string[] {
    if (!rawTehsil || rawTehsil === 'all') return scope.tehsils;
    const c = canonicalTehsil(rawTehsil);
    if (!c) throw new BadRequestException({ message: 'Invalid tehsil' });
    if (!scope.tehsils.includes(c)) {
      throw new ForbiddenException({
        message: 'This tehsil is not assigned to you',
      });
    }
    return [c];
  }

  private async loadTree(tehsils: string[]): Promise<TehsilNode[]> {
    if (!tehsils.length) return [];
    const [villages, settlements] = await Promise.all([
      this.villageRepo.find({
        where: { tehsil: In(tehsils), isActive: true },
      }),
      this.settlementRepo.find({
        where: { tehsil: In(tehsils), isActive: true },
      }),
    ]);
    return buildPopulationTree(tehsils, villages, settlements);
  }

  private totals(tree: TehsilNode[]) {
    return {
      tehsil_count: tree.length,
      village_count: tree.reduce((a, t) => a + t.village_count, 0),
      settlement_count: tree.reduce((a, t) => a + t.settlement_count, 0),
      total_population: tree.reduce((a, t) => a + t.total_population, 0),
      villages_with_population: tree.reduce(
        (a, t) => a + t.villages_with_population,
        0,
      ),
    };
  }

  /** Full village/settlement tree for the Geography page. */
  async getGeography(userId: string | undefined, rawTehsil?: string) {
    const actor = await this.loadActor(userId);
    const scope = this.scopeFor(actor);
    const tehsils = this.narrowScope(scope, rawTehsil);
    const tree = await this.loadTree(tehsils);
    return { scope, totals: this.totals(tree), tehsils: tree };
  }

  /**
   * Lightweight roll-up for dashboards (Command Center).
   * `village` narrows the totals to one village within a single tehsil.
   */
  async getSummary(
    userId: string | undefined,
    rawTehsil?: string,
    rawVillage?: string,
  ) {
    const actor = await this.loadActor(userId);
    const scope = this.scopeFor(actor);
    const tehsils = this.narrowScope(scope, rawTehsil);
    const tree = await this.loadTree(tehsils);

    const villageFilter =
      rawVillage && tehsils.length === 1 && !/^all\b/i.test(rawVillage)
        ? rawVillage.trim().toUpperCase()
        : null;

    const villages = tree
      .flatMap((t) =>
        t.villages.map((v) => ({
          tehsil: t.tehsil,
          village: v.name,
          population: v.population,
          settlements_population: v.settlements_population,
          total_population: v.total_population,
          settlement_count: v.settlement_count,
          settlements: v.settlements.map((s) => ({
            name: s.name,
            population: s.population,
          })),
        })),
      )
      .filter(
        (v) => !villageFilter || v.village.toUpperCase() === villageFilter,
      )
      .sort((a, b) => b.total_population - a.total_population);

    const totals = villageFilter
      ? {
          tehsil_count: 1,
          village_count: villages.length,
          settlement_count: villages.reduce(
            (a, v) => a + v.settlement_count,
            0,
          ),
          total_population: villages.reduce(
            (a, v) => a + v.total_population,
            0,
          ),
          villages_with_population: villages.filter(
            (v) => v.total_population > 0,
          ).length,
        }
      : this.totals(tree);

    return {
      scope,
      totals,
      by_tehsil: tree
        .map((t) => ({
          tehsil: t.tehsil,
          village_count: t.village_count,
          settlement_count: t.settlement_count,
          total_population: t.total_population,
          villages_with_population: t.villages_with_population,
        }))
        .sort((a, b) => b.total_population - a.total_population),
      // Every village in scope (sorted by population) so dashboards can join
      // population onto water systems and map markers. ~2k rows max.
      by_village: villages,
    };
  }

  /**
   * Population served per water site, plus village / settlement / tehsil
   * served-vs-unserved roll-ups (see population-coverage.util for the rules).
   * `village` narrows villages and sites to one village (tehsil required).
   */
  async getCoverage(
    userId: string | undefined,
    rawTehsil?: string,
    rawVillage?: string,
  ) {
    const actor = await this.loadActor(userId);
    const scope = this.scopeFor(actor);
    const tehsils = this.narrowScope(scope, rawTehsil);
    const tree = await this.loadTree(tehsils);
    const allowed = new Set(tehsils);
    const systems = tehsils.length
      ? await this.waterSystemRepo.find({
          select: {
            id: true,
            uniqueIdentifier: true,
            tehsil: true,
            village: true,
            settlement: true,
          },
        })
      : [];
    const sites = systems.flatMap((w) => {
      const c = canonicalTehsil(w.tehsil);
      return c && allowed.has(c)
        ? [
            {
              id: String(w.id),
              uniqueIdentifier: String(w.uniqueIdentifier ?? w.id),
              tehsil: c,
              village: String(w.village ?? ''),
              settlement: w.settlement ?? null,
            },
          ]
        : [];
    });
    const coverage = computeCoverage(tree, sites);

    const wantVillage =
      rawVillage && tehsils.length === 1 && !/^all\b/i.test(rawVillage)
        ? rawVillage.trim().replace(/\s+/g, ' ').toUpperCase()
        : null;
    const matchVillage = (v: string) =>
      !wantVillage ||
      v.trim().replace(/\s+/g, ' ').toUpperCase() === wantVillage;

    const villages = coverage.villages.filter((v) => matchVillage(v.village));
    const siteRows = coverage.sites.filter((s) => matchVillage(s.village));
    const sum = (k: 'total_population' | 'served_population') =>
      villages.reduce((a, v) => a + v[k], 0);
    const total = sum('total_population');
    const served = sum('served_population');

    return {
      scope,
      totals: {
        total_population: total,
        served_population: served,
        unserved_population: total - served,
        served_pct: total > 0 ? Math.round((1000 * served) / total) / 10 : null,
        village_count: villages.length,
        villages_served: villages.filter((v) => v.site_count > 0).length,
        site_count: siteRows.length,
      },
      tehsils: coverage.tehsils.sort(
        (a, b) => b.total_population - a.total_population,
      ),
      villages: villages.sort(
        (a, b) => b.total_population - a.total_population,
      ),
      sites: siteRows,
    };
  }

  private parseUpdates(body: unknown): PopulationUpdate[] {
    const raw = (body as { updates?: unknown })?.updates;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new BadRequestException({
        message: 'updates must be a non-empty array',
      });
    }
    if (raw.length > MAX_UPDATES_PER_REQUEST) {
      throw new BadRequestException({
        message: `At most ${MAX_UPDATES_PER_REQUEST} changes can be saved at once`,
      });
    }
    const seen = new Set<string>();
    const out: PopulationUpdate[] = [];
    for (const item of raw as Array<Record<string, unknown>>) {
      const type = item?.type;
      const id = typeof item?.id === 'string' ? item.id.trim() : '';
      if (type !== 'village' && type !== 'settlement') {
        throw new BadRequestException({
          message: 'type must be "village" or "settlement"',
        });
      }
      if (!id || id.length > 36) {
        throw new BadRequestException({ message: 'id is required' });
      }
      const population = parsePopulation(item?.population);
      if (population === null) {
        throw new BadRequestException({
          message: 'population must be a whole number between 0 and 10,000,000',
        });
      }
      const k = `${type}:${id}`;
      if (seen.has(k)) {
        throw new BadRequestException({ message: `Duplicate entry for ${k}` });
      }
      seen.add(k);
      out.push({ type, id, population });
    }
    return out;
  }

  /** Atomic batch update; every changed value is written to the audit log. */
  async updatePopulation(userId: string | undefined, body: unknown) {
    const actor = await this.loadActor(userId);
    const scope = this.scopeFor(actor);
    if (!scope.can_edit) {
      throw new ForbiddenException({
        message: 'No tehsils assigned — population cannot be edited',
      });
    }
    const updates = this.parseUpdates(body);
    const allowed = new Set(scope.tehsils);
    const now = new Date();

    const changed = await this.dataSource.transaction(async (em) => {
      const villageIds = updates
        .filter((u) => u.type === 'village')
        .map((u) => u.id);
      const settlementIds = updates
        .filter((u) => u.type === 'settlement')
        .map((u) => u.id);
      const [villages, settlements] = await Promise.all([
        villageIds.length
          ? em.find(LocationVillage, { where: { id: In(villageIds) } })
          : Promise.resolve([] as LocationVillage[]),
        settlementIds.length
          ? em.find(LocationSettlement, { where: { id: In(settlementIds) } })
          : Promise.resolve([] as LocationSettlement[]),
      ]);
      const vById = new Map(villages.map((v) => [v.id, v]));
      const sById = new Map(settlements.map((s) => [s.id, s]));

      const logs: LocationPopulationLog[] = [];
      const dirtyVillages: LocationVillage[] = [];
      const dirtySettlements: LocationSettlement[] = [];

      for (const u of updates) {
        const row = u.type === 'village' ? vById.get(u.id) : sById.get(u.id);
        if (!row || !row.isActive) {
          throw new NotFoundException({
            message: `${u.type === 'village' ? 'Village' : 'Settlement'} not found`,
          });
        }
        const c = canonicalTehsil(row.tehsil);
        if (!c || !allowed.has(c)) {
          throw new ForbiddenException({
            message: `${row.name} is in a tehsil that is not assigned to you`,
          });
        }
        const previous = Number(row.population ?? 0);
        if (previous === u.population) continue;

        row.population = u.population;
        row.populationUpdatedAt = now;
        row.populationUpdatedBy = actor.id;
        logs.push(
          em.create(LocationPopulationLog, {
            id: uuidv4(),
            locationType: u.type,
            locationId: row.id,
            tehsil: row.tehsil,
            village:
              u.type === 'village'
                ? row.name
                : (row as LocationSettlement).village,
            settlement: u.type === 'settlement' ? row.name : null,
            previousPopulation: previous,
            newPopulation: u.population,
            performedBy: actor.id,
            performedByName: actor.name ?? null,
            performedByRole: scope.role,
          }),
        );
        if (row instanceof LocationSettlement) dirtySettlements.push(row);
        else dirtyVillages.push(row);
      }

      if (dirtyVillages.length) await em.save(LocationVillage, dirtyVillages);
      if (dirtySettlements.length) {
        await em.save(LocationSettlement, dirtySettlements);
      }
      if (logs.length) await em.save(LocationPopulationLog, logs);
      return logs.length;
    });

    return {
      message: changed
        ? `Population updated for ${changed} location${changed === 1 ? '' : 's'}`
        : 'No changes',
      updated: changed,
    };
  }

  async getHistory(
    userId: string | undefined,
    rawTehsil?: string,
    rawLimit?: string,
  ) {
    const actor = await this.loadActor(userId);
    const scope = this.scopeFor(actor);
    const tehsils = this.narrowScope(scope, rawTehsil);
    if (!tehsils.length) return { items: [] };
    const limit = Math.min(Math.max(Number(rawLimit) || 50, 1), 200);
    const rows = await this.logRepo.find({
      where: { tehsil: In(tehsils) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        location_type: r.locationType,
        tehsil: r.tehsil,
        village: r.village,
        settlement: r.settlement,
        previous_population: r.previousPopulation,
        new_population: r.newPopulation,
        delta: r.newPopulation - r.previousPopulation,
        performed_by_name: r.performedByName,
        performed_by_role: r.performedByRole,
        created_at: r.createdAt?.toISOString?.() ?? null,
      })),
    };
  }
}
