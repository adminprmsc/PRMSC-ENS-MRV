import { memo, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Droplets,
  Gauge,
  MapPin,
  SlidersHorizontal,
  Sun,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hqRoutes } from "@/constants/routes";
import { StatCard } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LivePulseBadge } from "@/components/LivePulseBadge";
import { SearchableOptionField } from "@/components/common/SearchableOptionField";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import type {
  ProgramSolarSystemCoverage,
  ProgramTehsilFootprint,
  ProgramWaterSystemCoverage,
} from "./fetchScopedProgramDashboard";
import {
  InfoSectionHeader,
  buildAdminIssues,
  buildRankedTehsilCoverage,
} from "./AdminDashboardBlocks";
import { CoverageDemographicsCharts } from "./CoverageDemographicsCharts";
import { executiveYearLabel } from "./executivePeriodFilters";
import { PAGE_SIZE } from "./useClientPagination";

type SummaryData = {
  ohr_count: number;
  solar_facilities: number;
  bulk_meters: number;
  water_logs_count?: number;
  solar_logs_count?: number;
  water_sites_logged?: number;
  solar_sites_logged?: number;
  by_tehsil?: ProgramTehsilFootprint[];
  water_systems?: ProgramWaterSystemCoverage[];
  solar_systems?: ProgramSolarSystemCoverage[];
};

type ChartMonthRow = { month: string; [key: string]: string | number };

export type ScopeFilters = {
  tehsil: string;
  village: string;
  month: string;
  year: string;
};

type OrganizationKpiPanelProps = {
  loading: boolean;
  year: string;
  scopeLabel: string;
  scopeTooltip: string;
  summary: SummaryData;
  periodTotals: {
    waterM3: number;
    pumpH: number;
    solarKwh: number;
    gridKwh: number;
  };
  meterCoveragePct: number | null;
  waterVolumeChartData: ChartMonthRow[];
  pumpOnlyChartData: ChartMonthRow[];
  solarProgramChartData: ChartMonthRow[];
  formatKpiValue: (n: number) => string;
  formatTooltipNumber: (n: number) => string;
  /** Compact map rendered beside the footprint panel. */
  mapSlot?: React.ReactNode;
  scopeFilters?: ScopeFilters;
  onScopeChange?: (patch: Partial<ScopeFilters>) => void;
  villageOptions?: string[];
  allowedTehsils?: string[];
  restrictTehsils?: boolean;
  scopeFilterYears?: string[];
  scopeFilterMonths?: string[];
  /** When true hides heavy Performance / Trends / Demographics sections. */
  managementView?: boolean;
  /** Slot for a "today" card rendered above the health section. */
  todaySlot?: React.ReactNode;
};

const waterDeliveryConfig = {
  monthly: { label: "Monthly delivery", color: "#3b82f6" },
  ytd: { label: "Year-to-date", color: "#1d4ed8" },
} satisfies ChartConfig;

const pumpRuntimeConfig = {
  value: { label: "Pump hours", color: "#0ea5e9" },
} satisfies ChartConfig;

const solarEnergyConfig = {
  solarKwh: { label: "Solar export", color: "#d97706" },
  gridKwh: { label: "Grid import", color: "#ef4444" },
} satisfies ChartConfig;

/** Full locale numbers for executive KPI tiles (not compact axis notation). */
function formatExecutiveMetric(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

type ProgressTone = "good" | "watch" | "risk" | "neutral";

function progressTone(pct: number | null): ProgressTone {
  if (pct == null || !Number.isFinite(pct)) return "neutral";
  if (pct >= 70) return "good";
  if (pct >= 40) return "watch";
  return "risk";
}

function toneLabel(tone: ProgressTone): string {
  if (tone === "good") return "On track";
  if (tone === "watch") return "Needs attention";
  if (tone === "risk") return "Behind";
  return "—";
}

function toneBadgeClass(tone: ProgressTone): string {
  if (tone === "good") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (tone === "watch") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (tone === "risk") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "";
}

function ProgressStatusBadge({
  tone,
  loading,
}: {
  tone: ProgressTone;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Badge variant="outline" className="font-normal">
        …
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-normal", toneBadgeClass(tone))}
    >
      {tone === "good" ? (
        <CheckCircle2 className="size-3" />
      ) : tone === "neutral" ? null : (
        <AlertTriangle className="size-3" />
      )}
      {toneLabel(tone)}
    </Badge>
  );
}

type SiteListItem = {
  id: string;
  unique_identifier?: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  logged: boolean;
  logs_count: number;
  days_logged?: number;
  months_logged?: number;
  last_log_date?: string | null;
  lifetime_last_log_date?: string | null;
  lifetime_last_log_year?: number | null;
  lifetime_last_log_month?: number | null;
};

const MONTH_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

function formatSiteLastLog(row: SiteListItem, isSolar: boolean): string {
  if (isSolar) {
    const y = row.lifetime_last_log_year;
    const m = row.lifetime_last_log_month;
    if (y && m) return `${MONTH_SHORT[m] ?? ""} ${y}`;
    return "No log yet";
  }
  const d = row.last_log_date ?? row.lifetime_last_log_date;
  if (!d) return "No log yet";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PK", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return d;
  }
}

function SiteCoverageRow({
  row,
  isSolar,
}: {
  row: SiteListItem;
  isSolar: boolean;
}) {
  const location = [row.settlement, row.village, row.tehsil]
    .filter(Boolean)
    .join(", ");
  const uid = row.unique_identifier ?? row.id.slice(0, 8);
  const logCount = isSolar ? (row.months_logged ?? row.logs_count) : row.logs_count;
  const logUnit = isSolar ? "mo." : "logs";
  const lastLog = formatSiteLastLog(row, isSolar);

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40">
      {row.logged ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <Clock className="size-3.5 shrink-0 text-rose-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{location || uid}</p>
        <p className="text-[11px] text-muted-foreground">
          {uid} · {logCount} {logUnit} · Last: {lastLog}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 text-[10px] font-medium",
          row.logged
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-600",
        )}
      >
        {row.logged ? "Logged" : "Pending"}
      </Badge>
    </div>
  );
}

function HealthMetricCard({
  label,
  value,
  detail,
  tone,
  loading,
  icon,
  progress,
  sites,
  isSolar,
}: {
  label: string;
  value: string;
  detail: string;
  tone: ProgressTone;
  loading?: boolean;
  icon: React.ReactNode;
  progress?: number | null;
  sites?: SiteListItem[];
  isSolar?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const PREVIEW = 4;
  const shownSites = sites
    ? expanded
      ? sites
      : sites.slice(0, PREVIEW)
    : [];
  const hasMore = (sites?.length ?? 0) > PREVIEW;

  return (
    <Card className="relative gap-0 overflow-hidden py-0 shadow-sm ring-1 ring-foreground/10">
      <div className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/50 bg-muted/20 py-3.5 pl-5 [.border-b]:pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
            {icon}
          </div>
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </CardTitle>
        </div>
        <ProgressStatusBadge loading={loading === true} tone={tone} />
      </CardHeader>
      <CardContent className="space-y-3 py-4 pl-5">
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
          {loading ? "—" : value}
        </p>
        {progress != null && !loading ? (
          <Progress value={progress} className="h-1.5" />
        ) : loading ? (
          <Skeleton className="h-1.5 w-full" />
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>

        {/* Per-site breakdown */}
        {!loading && sites && sites.length > 0 && (
          <div className="border-t border-border/50 pt-2 space-y-0.5 pr-1">
            {shownSites.map((s) => (
              <SiteCoverageRow key={s.id} row={s} isSolar={isSolar ?? false} />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={toggle}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-md py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <SlidersHorizontal className="size-3" />
                {expanded
                  ? "Show less"
                  : `Show ${(sites.length - PREVIEW).toString()} more sites`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExecutiveKpiValue({
  value,
  unit,
  loading,
}: {
  value: number;
  unit: string;
  loading: boolean;
}) {
  if (loading) return null;
  return (
    <>
      <span className="font-mono tabular-nums tracking-tight">
        {formatExecutiveMetric(value)}
      </span>
      <span className="ml-1.5 text-lg font-medium text-muted-foreground">
        {unit}
      </span>
    </>
  );
}

function ExecutiveKpiRow({
  loading,
  periodTotals,
}: {
  loading: boolean;
  periodTotals: {
    waterM3: number;
    pumpH: number;
    solarKwh: number;
    gridKwh: number;
  };
}) {
  return (
    <>
      <StatCard
        accent="blue"
        label="Water delivered"
        loading={loading}
        description="From daily water logs this period"
        icon={<Droplets className="size-5" />}
        className="ring-border/50"
        value={
          <ExecutiveKpiValue
            loading={loading}
            value={periodTotals.waterM3}
            unit="m³"
          />
        }
      />
      <StatCard
        accent="slate"
        label="Pump runtime"
        loading={loading}
        description="Total pump hours this period"
        icon={<Clock className="size-5" />}
        className="ring-border/50"
        value={
          <ExecutiveKpiValue
            loading={loading}
            value={periodTotals.pumpH}
            unit="h"
          />
        }
      />
      <StatCard
        accent="amber"
        label="Solar export"
        loading={loading}
        description="Energy sent to the grid"
        icon={<Sun className="size-5" />}
        className="ring-border/50"
        value={
          <ExecutiveKpiValue
            loading={loading}
            value={periodTotals.solarKwh}
            unit="kWh"
          />
        }
      />
      <StatCard
        accent="violet"
        label="Grid import"
        loading={loading}
        description="Energy taken from the grid"
        icon={<Zap className="size-5" />}
        className="ring-border/50"
        value={
          <ExecutiveKpiValue
            loading={loading}
            value={periodTotals.gridKwh}
            unit="kWh"
          />
        }
      />
    </>
  );
}

function tehsilOptionLabel(value: string, assignedCount: number) {
  if (value === ALL_ASSIGNED_TEHSILS) {
    return assignedCount > 0
      ? `All assigned tehsils (${assignedCount})`
      : "All tehsils";
  }
  return value;
}

function ScopeFilterControls({
  filters,
  onChange,
  villageOptions,
  allowedTehsils,
  restrictTehsils,
  years,
  months,
  scopeLabel,
}: {
  filters: ScopeFilters;
  onChange: (patch: Partial<ScopeFilters>) => void;
  villageOptions: string[];
  allowedTehsils: string[];
  restrictTehsils: boolean;
  years: string[];
  months: string[];
  scopeLabel: string;
}) {
  const tehsilOptions = useMemo(
    () =>
      restrictTehsils
        ? allowedTehsils.length > 1
          ? [ALL_ASSIGNED_TEHSILS, ...allowedTehsils]
          : allowedTehsils
        : [ALL_ASSIGNED_TEHSILS, ...allowedTehsils],
    [restrictTehsils, allowedTehsils],
  );

  return (
    <Card className="gap-0 overflow-visible py-0 ring-border/50">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/30 py-4 [.border-b]:pb-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">
                Scope
              </CardTitle>
              <LivePulseBadge />
            </div>
            <CardDescription className="text-xs">
              Area and reporting period for this view.
            </CardDescription>
          </div>
        </div>
        <Badge
          variant="secondary"
          className="max-w-[min(100%,320px)] font-normal"
        >
          <MapPin className="mr-1 size-3 shrink-0" />
          <span className="truncate">{scopeLabel}</span>
        </Badge>
      </CardHeader>
      <CardContent className="py-4">
        <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Tehsil
            </FieldLabel>
            <Select
              value={filters.tehsil}
              onValueChange={(v) =>
                onChange({ tehsil: v ?? filters.tehsil })
              }
            >
              <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                <SelectValue placeholder="Tehsil" />
              </SelectTrigger>
              <SelectContent>
                {tehsilOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {tehsilOptionLabel(t, allowedTehsils.length)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <SearchableOptionField
            label="Village"
            value={filters.village}
            options={villageOptions}
            allValue="All Villages"
            maxResults={PAGE_SIZE.villages}
            onChange={(village) => onChange({ village })}
          />
          <Field>
            <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Year
            </FieldLabel>
            <Select
              value={filters.year}
              onValueChange={(v) => onChange({ year: v ?? filters.year })}
            >
              <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {executiveYearLabel(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Month
            </FieldLabel>
            <Select
              value={filters.month}
              onValueChange={(v) => onChange({ month: v ?? filters.month })}
            >
              <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Months">All months</SelectItem>
                {months.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

const OrganizationKpiPanel = memo(function OrganizationKpiPanel({
  loading,
  year,
  scopeLabel,
  scopeTooltip,
  summary,
  periodTotals,
  meterCoveragePct,
  waterVolumeChartData,
  pumpOnlyChartData,
  solarProgramChartData,
  formatKpiValue,
  formatTooltipNumber,
  mapSlot,
  scopeFilters,
  onScopeChange,
  villageOptions = ["All Villages"],
  allowedTehsils = [],
  restrictTehsils = false,
  scopeFilterYears = [],
  scopeFilterMonths = [],
  managementView = false,
  todaySlot,
}: OrganizationKpiPanelProps) {
  const waterSystemsAll = summary.water_systems;
  const solarSystemsAll = summary.solar_systems;

  const periodHint = useMemo(() => {
    const yearLabel = executiveYearLabel(
      scopeFilters?.year ?? year,
    );
    if (scopeFilters?.month && scopeFilters.month !== "All Months") {
      return `${scopeFilterMonths[Number(scopeFilters.month) - 1] ?? "Month"} ${yearLabel}`;
    }
    return yearLabel;
  }, [scopeFilters?.month, scopeFilters?.year, scopeFilterMonths, year]);

  const derived = useMemo(() => {
    const totalSites = summary.ohr_count + summary.solar_facilities;
    const waterShare =
      totalSites > 0 ? Math.round((100 * summary.ohr_count) / totalSites) : 0;
    const solarShare = totalSites > 0 ? 100 - waterShare : 0;
    const waterLogs = Number(summary.water_logs_count ?? 0);
    const solarLogs = Number(summary.solar_logs_count ?? 0);
    const waterSitesLogged = Number(summary.water_sites_logged ?? 0);
    const solarSitesLogged = Number(summary.solar_sites_logged ?? 0);
    const waterLoggedPct =
      summary.ohr_count > 0
        ? Math.round((100 * waterSitesLogged) / summary.ohr_count)
        : 0;
    const solarLoggedPct =
      summary.solar_facilities > 0
        ? Math.round((100 * solarSitesLogged) / summary.solar_facilities)
        : 0;

    const waterList = waterSystemsAll ?? [];
    const solarList = solarSystemsAll ?? [];
    const adminIssues = buildAdminIssues(waterList, solarList, periodHint);
    const rankedTehsils = buildRankedTehsilCoverage(
      summary.by_tehsil ?? [],
      waterList,
      solarList,
    );

    return {
      totalSites,
      waterShare,
      solarShare,
      waterLogs,
      solarLogs,
      waterSitesLogged,
      solarSitesLogged,
      waterLoggedPct,
      solarLoggedPct,
      waterTone: progressTone(
        summary.ohr_count > 0 ? waterLoggedPct : null,
      ),
      solarTone: progressTone(
        summary.solar_facilities > 0 ? solarLoggedPct : null,
      ),
      meterTone: progressTone(meterCoveragePct),
      waterNotLogged: Math.max(0, summary.ohr_count - waterSitesLogged),
      solarNotLogged: Math.max(
        0,
        summary.solar_facilities - solarSitesLogged,
      ),
      adminIssues,
      rankedTehsils,
      highPriorityCount: adminIssues.filter((i) => i.priority === "high")
        .length,
      scopePhrase:
        scopeFilters?.tehsil === ALL_ASSIGNED_TEHSILS
          ? restrictTehsils
            ? `Assigned tehsils (${allowedTehsils.length})`
            : "All tehsils"
          : (scopeFilters?.tehsil ?? "Selected scope"),
      villagePhrase:
        scopeFilters?.village && scopeFilters.village !== "All Villages"
          ? scopeFilters.village
          : null,
    };
  }, [
    summary,
    waterSystemsAll,
    solarSystemsAll,
    periodHint,
    meterCoveragePct,
    scopeFilters?.tehsil,
    scopeFilters?.village,
    restrictTehsils,
    allowedTehsils.length,
  ]);

  const {
    totalSites,
    waterShare,
    solarShare,
    waterLogs,
    solarLogs,
    waterSitesLogged,
    solarSitesLogged,
    waterLoggedPct,
    solarLoggedPct,
    waterTone,
    solarTone,
    meterTone,
    waterNotLogged,
    solarNotLogged,
    adminIssues,
    rankedTehsils,
    highPriorityCount,
    scopePhrase,
    villagePhrase,
  } = derived;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* SCOPE FILTER */}
      {scopeFilters && onScopeChange ? (
        <ScopeFilterControls
          filters={scopeFilters}
          onChange={onScopeChange}
          villageOptions={villageOptions}
          allowedTehsils={allowedTehsils}
          restrictTehsils={restrictTehsils}
          years={scopeFilterYears}
          months={scopeFilterMonths}
          scopeLabel={scopeLabel}
        />
      ) : null}

      {/* ── SECTION 1: PROGRAMME FOOTPRINT ─────────────────────────────── */}
      {mapSlot ? (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold">Programme footprint</CardTitle>
                <CardDescription className="text-xs">
                  {scopePhrase}{villagePhrase ? ` · ${villagePhrase}` : ""} · {periodHint}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LivePulseBadge syncing={loading} />
                <Link
                  to={hqRoutes.sitesProgress}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline"
                >
                  Sites Progress
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Facility mix
              </span>
              <Separator orientation="vertical" className="hidden h-4 sm:block" />
              <Badge variant="outline" className="gap-1.5 font-normal">
                <span className="size-2 rounded-full bg-[#2563eb]" />
                {loading ? "…" : formatExecutiveMetric(summary.ohr_count)} water
                {!loading && totalSites > 0 ? (
                  <span className="text-muted-foreground">({waterShare}%)</span>
                ) : null}
              </Badge>
              <Badge variant="outline" className="gap-1.5 font-normal">
                <span className="size-2 rounded-full bg-[#d97706]" />
                {loading ? "…" : formatExecutiveMetric(summary.solar_facilities)} solar
                {!loading && totalSites > 0 ? (
                  <span className="text-muted-foreground">({solarShare}%)</span>
                ) : null}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {loading ? "…" : formatExecutiveMetric(totalSites)} total
              </Badge>
              {!loading && highPriorityCount > 0 ? (
                <Badge variant="outline" className="border-rose-200 bg-rose-50 font-normal text-rose-800">
                  {highPriorityCount} high priority
                </Badge>
              ) : null}
            </div>
            <div className="w-full">{mapSlot}</div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── TODAY SLOT ──────────────────────────────────────────────────── */}
      {todaySlot ?? null}

      {/* ── SECTION 2: PROGRAMME HEALTH ────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30 py-3.5">
          <CardTitle className="text-base font-semibold">Programme health</CardTitle>
          <CardDescription className="text-xs">Logging coverage · {periodHint}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <HealthMetricCard
              label="Water logging"
              icon={<Droplets className="size-4 text-blue-600" />}
              value={`${waterLoggedPct}%`}
              progress={waterLoggedPct}
              tone={waterTone}
              loading={loading}
              isSolar={false}
              {...(waterSystemsAll ? { sites: waterSystemsAll as SiteListItem[] } : {})}
              detail={
                loading
                  ? "Loading…"
                  : waterNotLogged > 0
                    ? `${formatExecutiveMetric(waterSitesLogged)}/${formatExecutiveMetric(summary.ohr_count)} logged · ${formatExecutiveMetric(waterNotLogged)} open`
                    : summary.ohr_count === 0
                      ? "No water systems in view"
                      : "All water systems logged"
              }
            />
            <HealthMetricCard
              label="Solar logging"
              icon={<Sun className="size-4 text-amber-600" />}
              value={`${solarLoggedPct}%`}
              progress={solarLoggedPct}
              tone={solarTone}
              loading={loading}
              isSolar={true}
              {...(solarSystemsAll ? { sites: solarSystemsAll as SiteListItem[] } : {})}
              detail={
                loading
                  ? "Loading…"
                  : solarNotLogged > 0
                    ? `${formatExecutiveMetric(solarSitesLogged)}/${formatExecutiveMetric(summary.solar_facilities)} logged · ${formatExecutiveMetric(solarNotLogged)} open`
                    : summary.solar_facilities === 0
                      ? "No solar systems in view"
                      : "All solar systems logged"
              }
            />
            <HealthMetricCard
              label="Meter readiness"
              icon={<Gauge className="size-4 text-slate-600" />}
              value={meterCoveragePct == null ? "—" : `${meterCoveragePct}%`}
              progress={meterCoveragePct}
              tone={meterTone}
              loading={loading}
              detail={
                loading
                  ? "Loading…"
                  : `${formatExecutiveMetric(summary.bulk_meters)}/${formatExecutiveMetric(summary.ohr_count)} with active meter`
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 3: ATTENTION NEEDED ────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">Attention needed</CardTitle>
              <CardDescription className="text-xs">{periodHint} · sites missing logs</CardDescription>
            </div>
            {!loading && adminIssues.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {highPriorityCount > 0 ? (
                  <Badge variant="outline" className="border-rose-300 bg-rose-50 font-normal text-rose-800">
                    {highPriorityCount} high
                  </Badge>
                ) : null}
                <Badge variant="outline" className="font-normal">
                  {adminIssues.length} open
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg border",
                  !loading && adminIssues.length === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                )}
              >
                {!loading && adminIssues.length === 0 ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <AlertTriangle className="size-5" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold tracking-tight">
                  {loading
                    ? "Checking open items…"
                    : adminIssues.length === 0
                      ? "No open logging issues"
                      : `${formatExecutiveMetric(adminIssues.length)} sites need follow-up`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? "Syncing programme data"
                    : adminIssues.length === 0
                      ? "Water and solar logging is complete for this scope."
                      : `${formatExecutiveMetric(waterNotLogged)} water · ${formatExecutiveMetric(solarNotLogged)} solar · open full register for chase list.`}
                </p>
              </div>
            </div>
            <Link
              to={hqRoutes.attention}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open register
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 4: COVERAGE DEMOGRAPHICS ───────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30 py-3.5">
          <CardTitle className="text-base font-semibold">Coverage by tehsil</CardTitle>
          <CardDescription className="text-xs">Logging breakdown per area · {periodHint}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <CoverageDemographicsCharts
            rows={rankedTehsils}
            loading={loading}
            waterLogged={waterSitesLogged}
            waterTotal={summary.ohr_count}
            solarLogged={solarSitesLogged}
            solarTotal={summary.solar_facilities}
            periodHint={periodHint}
            scope={
              scopeFilters
                ? {
                    tehsil: scopeFilters.tehsil,
                    village: scopeFilters.village,
                    year: scopeFilters.year,
                    month: scopeFilters.month,
                  }
                : { year }
            }
          />
        </CardContent>
      </Card>

      {/* ── SECTION 5: PERIOD PERFORMANCE ──────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30 py-3.5">
          <CardTitle className="text-base font-semibold">Period performance</CardTitle>
          <CardDescription className="text-xs">{periodHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ExecutiveKpiRow loading={loading} periodTotals={periodTotals} />
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="mb-3 text-sm font-semibold">Logging progress</p>
            <p className="mb-4 text-xs text-muted-foreground">Share of facilities with at least one log</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {loading ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Water — daily</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatExecutiveMetric(waterSitesLogged)} of {formatExecutiveMetric(summary.ohr_count)} logged
                        </p>
                      </div>
                      <ProgressStatusBadge tone={waterTone} />
                    </div>
                    <Progress value={waterLoggedPct} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatExecutiveMetric(waterLogs)} logs received</span>
                      <span className="font-mono tabular-nums text-foreground">{waterLoggedPct}%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Solar — monthly</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatExecutiveMetric(solarSitesLogged)} of {formatExecutiveMetric(summary.solar_facilities)} logged
                        </p>
                      </div>
                      <ProgressStatusBadge tone={solarTone} />
                    </div>
                    <Progress value={solarLoggedPct} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatExecutiveMetric(solarLogs)} logs received</span>
                      <span className="font-mono tabular-nums text-foreground">{solarLoggedPct}%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 6: MONTHLY TRENDS ──────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30 py-3.5">
          <CardTitle className="text-base font-semibold">Monthly trends</CardTitle>
          <CardDescription className="text-xs">{executiveYearLabel(year)} · water delivery, pump runtime & solar energy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
                <p className="text-sm font-semibold">Water delivery</p>
                <p className="text-xs text-muted-foreground">Volume (m³) and year-to-date</p>
              </div>
              <div className="overflow-x-auto p-4">
                {loading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : (
                  <ChartContainer config={waterDeliveryConfig} className="h-[260px] min-w-[320px] w-full">
                    <ComposedChart data={waterVolumeChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={(v) => formatKpiValue(Number(v))} width={48} />
                      <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={(v) => formatKpiValue(Number(v))} width={48} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `${String(label)} · ${scopeTooltip}`}
                            formatter={(value, name) => {
                              const n = Number(value ?? 0);
                              return [`${formatTooltipNumber(n)} m³`, name === "monthly" ? "Monthly delivery" : "Year-to-date"];
                            }}
                          />
                        }
                      />
                      <Area yAxisId="left" type="monotone" dataKey="monthly" fill="var(--color-monthly)" fillOpacity={0.22} stroke="var(--color-monthly)" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="ytd" stroke="var(--color-ytd)" strokeWidth={2} dot={false} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </ComposedChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
                <p className="text-sm font-semibold">Pump runtime</p>
                <p className="text-xs text-muted-foreground">Operating hours</p>
              </div>
              <div className="overflow-x-auto p-4">
                {loading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : (
                  <ChartContainer config={pumpRuntimeConfig} className="h-[260px] min-w-[320px] w-full">
                    <ComposedChart data={pumpOnlyChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatKpiValue(Number(v))} width={48} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label) => `${String(label)} · ${scopeTooltip}`}
                            formatter={(value) => [`${formatTooltipNumber(Number(value ?? 0))} h`, "Pump hours"]}
                          />
                        }
                      />
                      <Area type="monotone" dataKey="value" fill="var(--color-value)" fillOpacity={0.25} stroke="var(--color-value)" strokeWidth={2} />
                    </ComposedChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
            <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
              <p className="text-sm font-semibold">Solar energy balance</p>
              <p className="text-xs text-muted-foreground">Grid export vs import (kWh)</p>
            </div>
            <div className="overflow-x-auto p-4">
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ChartContainer config={solarEnergyConfig} className="h-[280px] min-w-[320px] w-full">
                  <BarChart data={solarProgramChartData} barGap={4}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatKpiValue(Number(v))} width={52} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => `${String(label)} · ${scopeTooltip}`}
                          formatter={(value, name) => [
                            `${formatTooltipNumber(Number(value ?? 0))} kWh`,
                            name === "solarKwh" ? "Solar export" : "Grid import",
                          ]}
                        />
                      }
                    />
                    <Bar dataKey="solarKwh" fill="var(--color-solarKwh)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gridKwh" fill="var(--color-gridKwh)" radius={[4, 4, 0, 0]} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default OrganizationKpiPanel;
