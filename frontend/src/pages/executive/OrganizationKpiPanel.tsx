import { memo, useMemo, useState } from "react";
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
  scopeFilterYears?: number[];
  scopeFilterMonths?: string[];
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

function HealthMetricCard({
  label,
  value,
  detail,
  tone,
  loading,
  icon,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  tone: ProgressTone;
  loading?: boolean;
  icon: React.ReactNode;
  progress?: number | null;
}) {
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
  years: number[];
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
                  <SelectItem key={y} value={String(y)}>
                    {y}
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
}: OrganizationKpiPanelProps) {
  const waterSystemsAll = summary.water_systems;
  const solarSystemsAll = summary.solar_systems;

  const periodHint = useMemo(() => {
    if (scopeFilters?.month && scopeFilters.month !== "All Months") {
      return `${scopeFilterMonths[Number(scopeFilters.month) - 1] ?? "Month"} ${scopeFilters.year}`;
    }
    return year;
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
    <div className="space-y-8 animate-fade-in-up">
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

      {/* 1. LIVE FOOTPRINT (map-first) */}
      {mapSlot ? (
        <section className="hq-section space-y-3">
          <InfoSectionHeader
            kind="map"
            title="Programme footprint"
            description={`${scopePhrase}${villagePhrase ? ` · ${villagePhrase}` : ""} · ${periodHint}`}
            actions={
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
            }
          />
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
              {loading
                ? "…"
                : formatExecutiveMetric(summary.solar_facilities)}{" "}
              solar
              {!loading && totalSites > 0 ? (
                <span className="text-muted-foreground">({solarShare}%)</span>
              ) : null}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {loading ? "…" : formatExecutiveMetric(totalSites)} total
            </Badge>
            {!loading && highPriorityCount > 0 ? (
              <Badge
                variant="outline"
                className="border-rose-200 bg-rose-50 font-normal text-rose-800"
              >
                {highPriorityCount} high priority
              </Badge>
            ) : null}
          </div>
          <div className="w-full">{mapSlot}</div>
        </section>
      ) : null}

      <Separator />

      {/* 2. STATUS */}
      <section className="hq-section">
        <InfoSectionHeader
          kind="status"
          title="Programme health"
          description={`Logging coverage · ${periodHint}`}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <HealthMetricCard
            label="Water logging"
            icon={<Droplets className="size-4 text-blue-600" />}
            value={`${waterLoggedPct}%`}
            progress={waterLoggedPct}
            tone={waterTone}
            loading={loading}
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
            value={
              meterCoveragePct == null ? "—" : `${meterCoveragePct}%`
            }
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
      </section>

      {/* 3. ATTENTION SUMMARY */}
      <section className="hq-section space-y-3">
        <InfoSectionHeader
          kind="issues"
          title="Attention needed"
          description={`${periodHint} · sites missing logs`}
          actions={
            !loading && adminIssues.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {highPriorityCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-rose-300 bg-rose-50 font-normal text-rose-800"
                  >
                    {highPriorityCount} high
                  </Badge>
                ) : null}
                <Badge variant="outline" className="font-normal">
                  {adminIssues.length} open
                </Badge>
              </div>
            ) : null
          }
        />
        <Card className="gap-0 overflow-hidden py-0 ring-border/50 transition-shadow duration-300 hover:shadow-md">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
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
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* 4. COVERAGE DEMOGRAPHICS */}
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

      <Separator />

      {/* 5. PERFORMANCE */}
      <section className="hq-section">
        <InfoSectionHeader
          kind="performance"
          title="Period performance"
          description={periodHint}
        />
        <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ExecutiveKpiRow loading={loading} periodTotals={periodTotals} />
        </div>
        <Card className="gap-0 overflow-hidden py-0 ring-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
            <CardTitle className="text-base font-semibold">Logging progress</CardTitle>
            <CardDescription>Share of facilities with at least one log</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 py-5 lg:grid-cols-2">
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
                        {formatExecutiveMetric(waterSitesLogged)} of{" "}
                        {formatExecutiveMetric(summary.ohr_count)} logged
                      </p>
                    </div>
                    <ProgressStatusBadge tone={waterTone} />
                  </div>
                  <Progress value={waterLoggedPct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatExecutiveMetric(waterLogs)} logs received
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {waterLoggedPct}%
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Solar — monthly</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatExecutiveMetric(solarSitesLogged)} of{" "}
                        {formatExecutiveMetric(summary.solar_facilities)} logged
                      </p>
                    </div>
                    <ProgressStatusBadge tone={solarTone} />
                  </div>
                  <Progress value={solarLoggedPct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatExecutiveMetric(solarLogs)} logs received
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {solarLoggedPct}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* 6. TRENDS */}
      <section className="hq-section">
        <InfoSectionHeader
          kind="trends"
          title="Monthly trends"
          description={year}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-0 overflow-hidden py-0 ring-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
              <CardTitle className="text-base font-semibold">Water delivery</CardTitle>
              <CardDescription className="text-xs">
                Volume (m³) and year-to-date
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto py-4">
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ChartContainer
                  config={waterDeliveryConfig}
                  className="h-[280px] min-w-[320px] w-full"
                >
                  <ComposedChart data={waterVolumeChartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatKpiValue(Number(v))}
                      width={48}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatKpiValue(Number(v))}
                      width={48}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) =>
                            `${String(label)} · ${scopeTooltip}`
                          }
                          formatter={(value, name) => {
                            const n = Number(value ?? 0);
                            const label =
                              name === "monthly"
                                ? "Monthly delivery"
                                : "Year-to-date";
                            return [
                              `${formatTooltipNumber(n)} m³`,
                              label,
                            ];
                          }}
                        />
                      }
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="monthly"
                      fill="var(--color-monthly)"
                      fillOpacity={0.22}
                      stroke="var(--color-monthly)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ytd"
                      stroke="var(--color-ytd)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0 ring-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
              <CardTitle className="text-base font-semibold">Pump runtime</CardTitle>
              <CardDescription className="text-xs">
                Operating hours
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto py-4">
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ChartContainer
                  config={pumpRuntimeConfig}
                  className="h-[280px] min-w-[320px] w-full"
                >
                  <ComposedChart data={pumpOnlyChartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatKpiValue(Number(v))}
                      width={48}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) =>
                            `${String(label)} · ${scopeTooltip}`
                          }
                          formatter={(value) => [
                            `${formatTooltipNumber(Number(value ?? 0))} h`,
                            "Pump hours",
                          ]}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      fill="var(--color-value)"
                      fillOpacity={0.25}
                      stroke="var(--color-value)"
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 gap-0 overflow-hidden py-0 ring-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
            <CardTitle className="text-base font-semibold">Solar energy balance</CardTitle>
            <CardDescription className="text-xs">
              Grid export vs import (kWh)
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto py-4">
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ChartContainer
                config={solarEnergyConfig}
                className="h-[300px] min-w-[320px] w-full"
              >
                <BarChart data={solarProgramChartData} barGap={4}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatKpiValue(Number(v))}
                    width={52}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) =>
                          `${String(label)} · ${scopeTooltip}`
                        }
                        formatter={(value, name) => [
                          `${formatTooltipNumber(Number(value ?? 0))} kWh`,
                          name === "solarKwh" ? "Solar export" : "Grid import",
                        ]}
                      />
                    }
                  />
                  <Bar
                    dataKey="solarKwh"
                    fill="var(--color-solarKwh)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="gridKwh"
                    fill="var(--color-gridKwh)"
                    radius={[4, 4, 0, 0]}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
});

export default OrganizationKpiPanel;
