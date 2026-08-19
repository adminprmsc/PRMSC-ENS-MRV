import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Droplets, LayoutDashboard, RefreshCcw } from "lucide-react";
import { useProgramDashboardApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  ALL_VILLAGES,
  useLocationCatalog,
} from "../../hooks/useLocationCatalog";
import { useAuth } from "../../contexts/AuthContext";
import { isExecutiveRole } from "../../constants/roles";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import SystemsMapCard from "./SystemsMapCard";
import OrganizationKpiPanel, {
  type ScopeFilters,
} from "./OrganizationKpiPanel";
import { PageHeader, PageShell } from "@/components/layout";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import {
  fetchScopedProgramDashboard,
  type ProgramSummary,
} from "./fetchScopedProgramDashboard";
import { Link } from "react-router-dom";
import { hqRoutes } from "../../constants/routes";
import { getLoggingCompliance } from "../../services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "../tehsil/logging/loggingComplianceTypes";
import { formatAssignedOperators } from "../tehsil/logging/loggingComplianceTypes";
import { getPakistanIsoDateString } from "../../utils/pakistanTime";

type SummaryData = ProgramSummary;
type RowData = {
  month: number;
  total_water_pumped?: number;
  pump_operating_hours?: number;
  solar_generation_kwh?: number;
  grid_import_kwh?: number;
};

type AnomalyItem = {
  water_system: {
    id: string;
    unique_identifier?: string;
    tehsil: string;
    village: string;
    settlement?: string | null;
    bulk_meter_installed: boolean;
  };
  series: Array<{
    date: string;
    status?: string | null;
    pump_operating_hours?: number | null;
    total_water_pumped?: number | null;
    record_id?: string | null;
    operator?: { id: string; name: string; email: string; phone?: string | null } | null;
  }>;
  anomalies: Array<{ date: string; code: string; severity: string; message: string }>;
};

const YEARS = [2025, 2026, 2027, 2028, 2029];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatTooltipNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    n,
  );
}

function formatKpiValue(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    n,
  );
}

/** Map API rows (each has `month` 1–12) into 12 slots so charts stay correct if order changes. */
function seriesByMonth<T extends { month: number }>(
  rows: T[],
  pick: (r: T) => number,
): number[] {
  const out = Array.from({ length: 12 }, () => 0);
  for (const r of rows) {
    const m = r.month;
    if (m >= 1 && m <= 12) out[m - 1] = pick(r);
  }
  return out;
}

type ProgramDashboardProps = {
  headingTitle?: string;
  headingDescription?: string;
  /** When true, show a short plain-language note for programme / field leads. */
  managementView?: boolean;
  /** Executive layout: show map before KPI sections. */
  mapPosition?: "top" | "inline";
  /** Field-ops anomaly table; hidden on COO organization KPI view. */
  showAnomalies?: boolean;
};

/** Today's water logging card for the HQ command center. */
function HqTodayWaterCard({ tehsils }: { tehsils: string[] }) {
  const today = getPakistanIsoDateString(new Date());
  const [systems, setSystems] = useState<WaterSystemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { water_date: today };
      if (tehsils.length === 1 && tehsils[0]) params.tehsil = tehsils[0];
      const data = (await getLoggingCompliance(params)) as {
        water_systems?: WaterSystemRow[];
      };
      setSystems(data.water_systems ?? []);
    } catch {
      setSystems([]);
    } finally {
      setLoading(false);
    }
  }, [today, tehsils]);

  useEffect(() => { void load(); }, [load]);

  const total = systems.length;
  const entered = systems.filter((s) => s.daily_status !== "missing").length;
  const submitted = systems.filter((s) =>
    ["submitted", "accepted"].includes(s.daily_status),
  ).length;
  const missing = systems.filter((s) => s.daily_status === "missing").length;
  const pct = total > 0 ? Math.round((100 * entered) / total) : 0;
  const barColor =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  const statusLabel =
    pct >= 80 ? "On track" : pct >= 50 ? "Needs attention" : "Behind";
  const statusClass =
    pct >= 80
      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
      : pct >= 50
        ? "border-amber-200 text-amber-700 bg-amber-50"
        : "border-red-200 text-red-700 bg-red-50";

  const todayLabel = new Date(today + "T00:00:00").toLocaleDateString("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="hq-section">
      <Card className="border-blue-100 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Droplets className="size-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Today's water logging
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">{todayLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!loading && total > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${statusClass}`}
                >
                  {statusLabel}
                </Badge>
              )}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-2 animate-pulse rounded-full bg-muted" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : total === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No water systems in scope
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold tabular-nums">{pct}%</span>
                <div className="pb-1 text-right text-xs text-muted-foreground">
                  <p className="font-medium">{entered}/{total} have an entry</p>
                  <p>{submitted} submitted · {missing} missing</p>
                </div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/40 pt-1">
                {systems.map((s) => {
                  const isLogged = s.daily_status !== "missing";
                  const opLabel = formatAssignedOperators(s.assigned_operators);
                  const location = [s.unique_identifier, s.village, s.tehsil]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Link
                      key={s.id}
                      to={hqRoutes.waterSystem(s.id)}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-muted/40 ${
                        isLogged ? "bg-emerald-50/40" : "bg-red-50/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{location}</p>
                        {opLabel ? (
                          <p className="truncate text-muted-foreground">{opLabel}</p>
                        ) : null}
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] font-semibold ${
                          isLogged
                            ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                            : "border-red-200 text-red-700 bg-red-50"
                        }`}
                      >
                        {isLogged ? "Logged" : "Missing"}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

const ProgramDashboard = ({
  headingTitle = "Program Dashboard",
  headingDescription = "Water and solar by area and period.",
  managementView = true,
  mapPosition = "inline",
  showAnomalies = false,
}: ProgramDashboardProps) => {
  const { user } = useAuth();
  const showSystemsMap = isExecutiveRole(user?.role);
  const {
    tehsils: catalogTehsils,
    resolveUserTehsils,
    scopeVillageOptions,
  } = useLocationCatalog();
  const allowedTehsils = useMemo(() => {
    const fromUser = resolveUserTehsils(user?.tehsils);
    return fromUser.length ? fromUser : catalogTehsils;
  }, [user?.tehsils, resolveUserTehsils, catalogTehsils]);
  const restrictTehsils = (user?.tehsils ?? []).length > 0;
  const initialTehsil =
    restrictTehsils && allowedTehsils.length > 1
      ? ALL_ASSIGNED_TEHSILS
      : restrictTehsils
        ? String(allowedTehsils[0] ?? "").trim() || ALL_ASSIGNED_TEHSILS
        : ALL_ASSIGNED_TEHSILS;
  const {
    getDashboardProgramSummary,
    getDashboardWaterSupplied,
    getDashboardPumpHours,
    getDashboardSolarGeneration,
    getDashboardGridImport,
    getWaterAnomalies,
  } = useProgramDashboardApi();

  const [activeFilters, setActiveFilters] = useState(() => ({
    tehsil: initialTehsil,
    village: ALL_VILLAGES,
    month: "All Months",
    year: "2026",
  }));
  const [summary, setSummary] = useState<SummaryData>({
    ohr_count: 0,
    solar_facilities: 0,
    bulk_meters: 0,
    water_logs_count: 0,
    solar_logs_count: 0,
    water_sites_logged: 0,
    solar_sites_logged: 0,
    by_tehsil: [],
    water_systems: [],
    solar_systems: [],
  });
  const [waterSupplied, setWaterSupplied] = useState<RowData[]>([]);
  const [pumpHours, setPumpHours] = useState<RowData[]>([]);
  const [solarGeneration, setSolarGeneration] = useState<RowData[]>([]);
  const [gridImport, setGridImport] = useState<RowData[]>([]);
  const [anomalyItems, setAnomalyItems] = useState<AnomalyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const villageOptions = useMemo(
    () =>
      scopeVillageOptions(activeFilters.tehsil, {
        allowedTehsils,
      }),
    [scopeVillageOptions, activeFilters.tehsil, allowedTehsils],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const apiFilters = {
          tehsil: activeFilters.tehsil,
          village: activeFilters.village,
          year: Number(activeFilters.year),
          ...(activeFilters.month !== "All Months"
            ? { month: Number(activeFilters.month) }
            : {}),
        };
        const { summary: sum, water, pump, solar, grid } =
          await fetchScopedProgramDashboard(apiFilters, allowedTehsils, {
            summary: (f) =>
              getDashboardProgramSummary(f) as Promise<SummaryData | undefined>,
            water: (f) =>
              getDashboardWaterSupplied(f) as Promise<RowData[] | undefined>,
            pump: (f) =>
              getDashboardPumpHours(f) as Promise<RowData[] | undefined>,
            solar: (f) =>
              getDashboardSolarGeneration(f) as Promise<RowData[] | undefined>,
            grid: (f) =>
              getDashboardGridImport(f) as Promise<RowData[] | undefined>,
          });
        setSummary(sum);
        setWaterSupplied(water);
        setPumpHours(pump);
        setSolarGeneration(solar);
        setGridImport(grid);

        if (showAnomalies) {
          try {
            const anom = (await getWaterAnomalies({
              tehsil: apiFilters.tehsil,
              village: apiFilters.village,
              days: 4,
            })) as { items?: AnomalyItem[] };
            setAnomalyItems(Array.isArray(anom?.items) ? anom.items : []);
          } catch {
            setAnomalyItems([]);
          }
        } else {
          setAnomalyItems([]);
        }
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load program dashboard"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeFilters, showAnomalies, allowedTehsils]);

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      activeFilters.tehsil === ALL_ASSIGNED_TEHSILS
        ? restrictTehsils
          ? `All assigned tehsils (${allowedTehsils.length})`
          : "All tehsils"
        : activeFilters.tehsil;
    const village =
      activeFilters.village === "All Villages"
        ? "All villages"
        : activeFilters.village;
    const month =
      activeFilters.month === "All Months"
        ? "All months"
        : MONTHS[Number(activeFilters.month) - 1];
    return `${tehsil} · ${village} · ${activeFilters.year} · ${month}`;
  }, [activeFilters, allowedTehsils.length, restrictTehsils]);

  const activeScopeTooltip = useMemo(() => {
    const tehsilPart =
      activeFilters.tehsil === ALL_ASSIGNED_TEHSILS
        ? restrictTehsils
          ? `All assigned tehsils (${allowedTehsils.length})`
          : "All tehsils"
        : activeFilters.tehsil;
    if (activeFilters.village === "All Villages") {
      return activeFilters.tehsil === ALL_ASSIGNED_TEHSILS
        ? "All villages"
        : `All villages · ${tehsilPart}`;
    }
    return `${activeFilters.village} · ${tehsilPart}`;
  }, [activeFilters.tehsil, activeFilters.village, allowedTehsils.length, restrictTehsils]);

  const waterByMonth = useMemo(
    () =>
      seriesByMonth(waterSupplied as RowData[], (r) =>
        Number(r.total_water_pumped ?? 0),
      ),
    [waterSupplied],
  );
  const pumpByMonth = useMemo(
    () =>
      seriesByMonth(pumpHours as RowData[], (r) =>
        Number(r.pump_operating_hours ?? 0),
      ),
    [pumpHours],
  );
  const solarByMonth = useMemo(
    () =>
      seriesByMonth(solarGeneration as RowData[], (r) =>
        Number(r.solar_generation_kwh ?? 0),
      ),
    [solarGeneration],
  );
  const gridByMonth = useMemo(
    () =>
      seriesByMonth(gridImport as RowData[], (r) =>
        Number(r.grid_import_kwh ?? 0),
      ),
    [gridImport],
  );

  const periodTotals = useMemo(
    () => ({
      waterM3: waterByMonth.reduce((a, b) => a + b, 0),
      pumpH: pumpByMonth.reduce((a, b) => a + b, 0),
      solarKwh: solarByMonth.reduce((a, b) => a + b, 0),
      gridKwh: gridByMonth.reduce((a, b) => a + b, 0),
    }),
    [waterByMonth, pumpByMonth, solarByMonth, gridByMonth],
  );

  const meterCoveragePct = useMemo(() => {
    const total = summary.ohr_count;
    if (!total) return null;
    return Math.round((100 * summary.bulk_meters) / total);
  }, [summary.ohr_count, summary.bulk_meters]);

  const ytdWaterSeries = useMemo(() => {
    let acc = 0;
    return waterByMonth.map((v) => {
      acc += v;
      return acc;
    });
  }, [waterByMonth]);

  const waterVolumeChartData = useMemo(
    () =>
      MONTHS.map((m, i) => ({
        month: m,
        monthly: waterByMonth[i] ?? 0,
        ytd: ytdWaterSeries[i] ?? 0,
      })),
    [waterByMonth, ytdWaterSeries],
  );

  const pumpOnlyChartData = useMemo(
    () =>
      MONTHS.map((m, i) => ({
        month: m,
        value: pumpByMonth[i] ?? 0,
      })),
    [pumpByMonth],
  );

  const solarProgramChartData = useMemo(
    () =>
      MONTHS.map((m, i) => ({
        month: m,
        solarKwh: solarByMonth[i] ?? 0,
        gridKwh: gridByMonth[i] ?? 0,
      })),
    [solarByMonth, gridByMonth],
  );

  const updateScope = useCallback((patch: Partial<ScopeFilters>) => {
    setActiveFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.tehsil !== undefined) next.village = ALL_VILLAGES;
      return next;
    });
  }, []);

  return (
    <PageShell>
      <PageHeader
        title={headingTitle}
        description={headingDescription}
        icon={<LayoutDashboard className="size-5" />}
      />


        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <OrganizationKpiPanel
          loading={loading}
          year={activeFilters.year}
          scopeLabel={activeScopeLabel}
          scopeTooltip={activeScopeTooltip}
          summary={summary}
          periodTotals={periodTotals}
          meterCoveragePct={meterCoveragePct}
          waterVolumeChartData={waterVolumeChartData}
          pumpOnlyChartData={pumpOnlyChartData}
          solarProgramChartData={solarProgramChartData}
          formatKpiValue={formatKpiValue}
          formatTooltipNumber={formatTooltipNumber}
          scopeFilters={activeFilters}
          onScopeChange={updateScope}
          villageOptions={villageOptions}
          allowedTehsils={allowedTehsils}
          restrictTehsils={restrictTehsils}
          scopeFilterYears={YEARS}
          scopeFilterMonths={MONTHS}
          managementView={managementView}
          todaySlot={
            managementView ? (
              <HqTodayWaterCard tehsils={allowedTehsils} />
            ) : undefined
          }
          mapSlot={
            showSystemsMap && mapPosition === "top" ? (
              <SystemsMapCard
                key={`${activeFilters.tehsil}|${activeFilters.village}`}
                variant="hero"
                scopeLabel={activeScopeLabel}
                dataSyncing={loading}
                allowedTehsils={allowedTehsils}
                mapFilters={{
                  tehsil: activeFilters.tehsil,
                  village: activeFilters.village,
                }}
                summaryCounts={{
                  water: summary.ohr_count,
                  solar: summary.solar_facilities,
                }}
                waterCoverage={summary.water_systems ?? []}
                solarCoverage={summary.solar_systems ?? []}
              />
            ) : undefined
          }
        />

        {showSystemsMap && mapPosition === "inline" ? (
          <SystemsMapCard
            allowedTehsils={allowedTehsils}
            mapFilters={{
              tehsil: activeFilters.tehsil,
              village: activeFilters.village,
            }}
            summaryCounts={
              loading
                ? null
                : { water: summary.ohr_count, solar: summary.solar_facilities }
            }
            waterCoverage={summary.water_systems ?? []}
            solarCoverage={summary.solar_systems ?? []}
            defaultCollapsed
          />
        ) : null}

        {showAnomalies ? (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base">Anomalies tracking (last 4 days)</CardTitle>
                <CardDescription>
                  Flags sudden changes in <span className="font-medium">total water pumped</span> compared to the
                  previous 3‑day average (+10% / −50%).
                </CardDescription>
              </div>
              <Badge
                variant={
                  anomalyItems.filter((x) => (x.anomalies?.length ?? 0) > 0).length
                    ? "destructive"
                    : "outline"
                }
              >
                {anomalyItems.filter((x) => (x.anomalies?.length ?? 0) > 0).length} anomaly(ies)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : anomalyItems.filter((x) => (x.anomalies?.length ?? 0) > 0).length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No anomalies detected in the last 3 days for this filter.
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-background">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold">Flagged systems</p>
                  <p className="text-xs text-muted-foreground">
                    Scroll for more · Expand a row for details
                  </p>
                </div>
                <div className="max-h-[520px] overflow-y-auto p-2">
                  <Accordion className="w-full">
                    {anomalyItems
                      .filter((x) => (x.anomalies?.length ?? 0) > 0)
                      .slice(0, 40)
                      .map((it) => {
                    const series = Array.isArray(it.series) ? it.series : [];
                    const anomalyDates = new Set(
                      (it.anomalies ?? []).map((a) => String(a.date)),
                    );
                    const avg3ByDate = new Map<string, number>();
                    for (let i = 3; i < series.length; i += 1) {
                      const cur = series[i];
                      const p1 = series[i - 1];
                      const p2 = series[i - 2];
                      const p3 = series[i - 3];
                      const v1 = Number(p1?.total_water_pumped ?? NaN);
                      const v2 = Number(p2?.total_water_pumped ?? NaN);
                      const v3 = Number(p3?.total_water_pumped ?? NaN);
                      if (
                        cur?.date &&
                        Number.isFinite(v1) &&
                        Number.isFinite(v2) &&
                        Number.isFinite(v3)
                      ) {
                        avg3ByDate.set(String(cur.date), (v1 + v2 + v3) / 3);
                      }
                    }
                    const chartData = series.map((p) => ({
                      date: p.date,
                      pumpH: Number(p.pump_operating_hours ?? 0),
                      waterM3: Number(p.total_water_pumped ?? 0),
                      avg3: avg3ByDate.get(String(p.date)) ?? null,
                      anomaly: anomalyDates.has(String(p.date)),
                    }));
                    const lastOp =
                      [...series]
                        .reverse()
                        .find((p) => p.operator)?.operator ?? null;
                    const title = [
                      it.water_system.unique_identifier || it.water_system.id,
                      it.water_system.village,
                      it.water_system.tehsil,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <AccordionItem
                        key={it.water_system.id}
                        value={it.water_system.id}
                        className="rounded-lg border border-border/70 bg-card px-3"
                      >
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex w-full items-start justify-between gap-3 pr-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{title}</p>
                              {lastOp ? (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  Latest operator:{" "}
                                  <span className="font-medium text-foreground">
                                    {lastOp.name}
                                  </span>{" "}
                                  · {lastOp.email}
                                  {lastOp.phone ? ` · ${lastOp.phone}` : ""}
                                </p>
                              ) : (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  Latest operator: — (no submission linked yet)
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {(it.anomalies?.length ?? 0)} anomaly(ies)
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3">
                          <div className="grid gap-3 md:grid-cols-[1fr_360px] md:items-start">
                            <div>
                              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                                {(it.anomalies ?? []).slice(0, 6).map((a, idx) => (
                                  <li key={`${a.code}-${a.date}-${idx}`}>
                                    <span className="font-medium text-foreground">
                                      {a.date}
                                    </span>
                                    : {a.message}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                  data={chartData}
                                  margin={{ top: 10, right: 12, bottom: 6, left: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(d) => String(d).slice(5)}
                                    interval={0}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(v) => formatKpiValue(Number(v))}
                                    width={34}
                                  />
                                  <Tooltip
                                    labelFormatter={(label) => `Date: ${String(label)}`}
                                    formatter={(value, name) => {
                                      const n = Number(value ?? 0);
                                      if (name === "Water pumped") {
                                        return [`${formatTooltipNumber(n)} m³`, name];
                                      }
                                      if (name === "3‑day avg") {
                                        if (!Number.isFinite(n)) return ["—", name];
                                        return [`${formatTooltipNumber(n)} m³`, name];
                                      }
                                      return [formatTooltipNumber(n), String(name)];
                                    }}
                                  />
                                  <Legend />
                                  <Line
                                    type="monotone"
                                    dataKey="waterM3"
                                    name="Water pumped"
                                    stroke="#2563eb"
                                    strokeWidth={2.25}
                                    dot={({ cx, cy, payload }) => {
                                      if (cx == null || cy == null) return null;
                                      const isAnom = Boolean((payload as any)?.anomaly);
                                      return (
                                        <circle
                                          cx={cx}
                                          cy={cy}
                                          r={4}
                                          fill={isAnom ? "#ef4444" : "#2563eb"}
                                          stroke="#ffffff"
                                          strokeWidth={1.5}
                                        />
                                      );
                                    }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="avg3"
                                    name="3‑day avg"
                                    stroke="#64748b"
                                    strokeWidth={2}
                                    strokeDasharray="5 4"
                                    dot={false}
                                    connectNulls={false}
                                  />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                  </Accordion>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}
    </PageShell>
  );
};

export default ProgramDashboard;
