import { memo, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Gauge,
  MapPin,
  Search,
  SlidersHorizontal,
  Sun,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import type {
  ProgramSolarSystemCoverage,
  ProgramTehsilFootprint,
  ProgramWaterSystemCoverage,
} from "./fetchScopedProgramDashboard";
import {
  AdminIssuesPanel,
  InfoSectionHeader,
  TehsilCoveragePanel,
  buildAdminIssues,
} from "./AdminDashboardBlocks";
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

const portfolioConfig = {
  water: { label: "Water systems", color: "#2563eb" },
  solar: { label: "Solar systems", color: "#d97706" },
} satisfies ChartConfig;

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
    <Card className="gap-0 overflow-hidden py-0 ring-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
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
      <CardContent className="space-y-3 py-4">
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
  const [villageQuery, setVillageQuery] = useState("");
  const tehsilOptions = useMemo(
    () =>
      restrictTehsils
        ? allowedTehsils.length > 1
          ? [ALL_ASSIGNED_TEHSILS, ...allowedTehsils]
          : allowedTehsils
        : [ALL_ASSIGNED_TEHSILS, ...allowedTehsils],
    [restrictTehsils, allowedTehsils],
  );

  const villageChoices = useMemo(() => {
    const q = villageQuery.trim().toLowerCase();
    const withoutAll = villageOptions.filter((v) => v !== "All Villages");
    const matched = q
      ? withoutAll.filter((v) => v.toLowerCase().includes(q))
      : withoutAll;
    const capped = matched.slice(0, PAGE_SIZE.villages);
    return {
      items: ["All Villages", ...capped],
      truncated: matched.length > PAGE_SIZE.villages,
      matchCount: matched.length,
      total: withoutAll.length,
    };
  }, [villageOptions, villageQuery]);

  return (
    <Card className="gap-0 overflow-hidden py-0 ring-border/50">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/30 py-4 [.border-b]:pb-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              View settings
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Choose area and reporting period — status, issues, map, and trends
              update together.
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
              onValueChange={(v) => onChange({ tehsil: v ?? filters.tehsil })}
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
          <Field>
            <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Village
              {villageChoices.total > PAGE_SIZE.villages ? (
                <span className="ml-1 font-normal normal-case tracking-normal">
                  ({villageChoices.total})
                </span>
              ) : null}
            </FieldLabel>
            <div className="space-y-1.5">
              {villageChoices.total > 40 ? (
                <InputGroup className="h-8 bg-background">
                  <InputGroupAddon align="inline-start">
                    <Search className="size-3.5" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={villageQuery}
                    onChange={(e) => setVillageQuery(e.target.value)}
                    placeholder="Search villages…"
                    className="text-xs"
                  />
                </InputGroup>
              ) : null}
              <Select
                value={filters.village}
                onValueChange={(v) =>
                  onChange({ village: v ?? filters.village })
                }
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Village" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {villageChoices.items.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                  {villageChoices.truncated ? (
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      Showing {PAGE_SIZE.villages} of {villageChoices.matchCount}{" "}
                      matches — refine search.
                    </div>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </Field>
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
  const tehsilRows = summary.by_tehsil;

  const periodHint = useMemo(() => {
    if (scopeFilters?.month && scopeFilters.month !== "All Months") {
      return `${scopeFilterMonths[Number(scopeFilters.month) - 1] ?? "Month"} ${scopeFilters.year}`;
    }
    return year;
  }, [scopeFilters?.month, scopeFilters?.year, scopeFilterMonths, year]);

  const derived = useMemo(() => {
    const totalSites = summary.ohr_count + summary.solar_facilities;
    const portfolioData = [
      { key: "water", name: "Water systems", value: summary.ohr_count },
      { key: "solar", name: "Solar systems", value: summary.solar_facilities },
    ].filter((d) => d.value > 0);
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
    const tehsilList = tehsilRows ?? [];

    const waterByTehsil = new Map<string, ProgramWaterSystemCoverage[]>();
    for (const s of waterList) {
      const list = waterByTehsil.get(s.tehsil) ?? [];
      list.push(s);
      waterByTehsil.set(s.tehsil, list);
    }
    const solarByTehsil = new Map<string, ProgramSolarSystemCoverage[]>();
    for (const s of solarList) {
      const list = solarByTehsil.get(s.tehsil) ?? [];
      list.push(s);
      solarByTehsil.set(s.tehsil, list);
    }

    const rankedTehsils = tehsilList
      .map((row) => {
        const waterPct =
          row.water_sites > 0
            ? Math.round((100 * row.water_sites_logged) / row.water_sites)
            : null;
        const solarPct =
          row.solar_sites > 0
            ? Math.round((100 * row.solar_sites_logged) / row.solar_sites)
            : null;
        const scores = [waterPct, solarPct].filter(
          (v): v is number => v != null,
        );
        const avg =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;
        const waterSystems = waterByTehsil.get(row.tehsil) ?? [];
        const solarSystems = solarByTehsil.get(row.tehsil) ?? [];
        return {
          ...row,
          waterPct,
          solarPct,
          avg,
          tone: progressTone(avg),
          waterSystems,
          solarSystems,
          waterMissing: waterSystems.filter((s) => !s.logged),
          waterLogged: waterSystems.filter((s) => s.logged),
          solarMissing: solarSystems.filter((s) => !s.logged),
          solarLogged: solarSystems.filter((s) => s.logged),
        };
      })
      .sort((a, b) => a.avg - b.avg);

    const adminIssues = buildAdminIssues(waterList, solarList, periodHint);

    return {
      totalSites,
      portfolioData,
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
      rankedTehsils,
      tehsilsBehind: rankedTehsils.filter((r) => r.tone === "risk").length,
      tehsilsWatch: rankedTehsils.filter((r) => r.tone === "watch").length,
      adminIssues,
      highPriorityCount: adminIssues.filter((i) => i.priority === "high")
        .length,
      showTehsilDemo:
        tehsilList.length > 0 || waterList.length > 0 || solarList.length > 0,
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
    tehsilRows,
    periodHint,
    meterCoveragePct,
    scopeFilters?.tehsil,
    scopeFilters?.village,
    restrictTehsils,
    allowedTehsils.length,
  ]);

  const {
    totalSites,
    portfolioData,
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
    rankedTehsils,
    tehsilsBehind,
    tehsilsWatch,
    adminIssues,
    highPriorityCount,
    showTehsilDemo,
    scopePhrase,
    villagePhrase,
  } = derived;

  return (
    <div className="space-y-8">
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

      {/* 1. STATUS */}
      <section>
        <InfoSectionHeader
          kind="status"
          title="Programme health at a glance"
          description={`Coverage for ${periodHint}. Open Issues below for system-level follow-up.`}
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
                  ? `${formatExecutiveMetric(waterSitesLogged)} of ${formatExecutiveMetric(summary.ohr_count)} systems logged · ${formatExecutiveMetric(waterNotLogged)} open in Issues`
                  : summary.ohr_count === 0
                    ? "No water systems in this view"
                    : "All water systems have submitted a daily log"
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
                  ? `${formatExecutiveMetric(solarSitesLogged)} of ${formatExecutiveMetric(summary.solar_facilities)} systems logged · ${formatExecutiveMetric(solarNotLogged)} open in Issues`
                  : summary.solar_facilities === 0
                    ? "No solar systems in this view"
                    : "All solar systems have submitted a monthly log"
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
                : `${formatExecutiveMetric(summary.bulk_meters)} of ${formatExecutiveMetric(summary.ohr_count)} water systems have an active bulk meter`
            }
          />
        </div>
      </section>

      {/* 2. ISSUES */}
      <AdminIssuesPanel
        issues={adminIssues}
        loading={loading}
        periodHint={periodHint}
      />

      {/* 3. FOOTPRINT */}
      <section>
        <InfoSectionHeader
          kind="map"
          title="Programme footprint"
          description={`Map and facility mix for ${scopePhrase}${villagePhrase ? ` · ${villagePhrase}` : ""} · ${periodHint}. Expand the map only when you need location context.`}
        />
        <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
          {mapSlot ? <div className="lg:col-span-7">{mapSlot}</div> : null}

          <div className={mapSlot ? "lg:col-span-5" : "lg:col-span-12"}>
            <Card className="gap-0 overflow-hidden py-0 ring-border/50">
              <CardHeader className="border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
                <CardTitle className="text-sm font-semibold">Facility mix</CardTitle>
                <CardDescription className="text-xs">
                  Registered water and solar systems in this view
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-center gap-6 py-5">
                <div className="flex items-center gap-5">
                  <div className="shrink-0">
                    {loading ? (
                      <Skeleton className="size-28 rounded-full" />
                    ) : totalSites === 0 ? (
                      <div className="flex size-28 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                        Empty
                      </div>
                    ) : (
                      <ChartContainer
                        config={portfolioConfig}
                        className="aspect-square h-[120px] w-[120px]"
                      >
                        <PieChart>
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                hideLabel
                                formatter={(value, name) => (
                                  <span className="font-medium">
                                    {String(name)}:{" "}
                                    {formatKpiValue(Number(value))}
                                  </span>
                                )}
                              />
                            }
                          />
                          <Pie
                            data={portfolioData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={34}
                            outerRadius={48}
                            paddingAngle={portfolioData.length > 1 ? 3 : 0}
                            strokeWidth={2}
                          >
                            {portfolioData.map((entry) => (
                              <Cell
                                key={entry.key}
                                fill={
                                  portfolioConfig[
                                    entry.key as keyof typeof portfolioConfig
                                  ].color
                                }
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                      {loading ? "—" : formatExecutiveMetric(totalSites)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total facilities in this view
                    </p>
                    {!loading && highPriorityCount > 0 ? (
                      <p className="text-xs text-rose-700">
                        {highPriorityCount} high-priority issue
                        {highPriorityCount === 1 ? "" : "s"} need attention
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-full bg-[#2563eb]" />
                      <span className="text-sm font-medium">Water systems</span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-semibold tabular-nums">
                        {loading
                          ? "—"
                          : formatExecutiveMetric(summary.ohr_count)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {loading ? "" : `${waterShare}%`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-full bg-[#d97706]" />
                      <span className="text-sm font-medium">Solar systems</span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-semibold tabular-nums">
                        {loading
                          ? "—"
                          : formatExecutiveMetric(summary.solar_facilities)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {loading ? "" : `${solarShare}%`}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. PERFORMANCE */}
      <section>
        <InfoSectionHeader
          kind="performance"
          title="Period performance"
          description={`Submitted logs and coverage rates · ${periodHint}`}
        />
        <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ExecutiveKpiRow loading={loading} periodTotals={periodTotals} />
        </div>
        <Card className="gap-0 overflow-hidden py-0 ring-border/50">
          <CardHeader className="border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
            <CardTitle className="text-base font-semibold">Logging progress</CardTitle>
            <CardDescription>
              Share of facilities that submitted at least one log
            </CardDescription>
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
                      <p className="text-sm font-medium">Water — daily logs</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatExecutiveMetric(waterSitesLogged)} of{" "}
                        {formatExecutiveMetric(summary.ohr_count)} systems logged
                      </p>
                    </div>
                    <ProgressStatusBadge tone={waterTone} />
                  </div>
                  <Progress value={waterLoggedPct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatExecutiveMetric(waterLogs)} daily logs received
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {waterLoggedPct}%
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Solar — monthly logs</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatExecutiveMetric(solarSitesLogged)} of{" "}
                        {formatExecutiveMetric(summary.solar_facilities)} systems
                        logged
                      </p>
                    </div>
                    <ProgressStatusBadge tone={solarTone} />
                  </div>
                  <Progress value={solarLoggedPct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatExecutiveMetric(solarLogs)} monthly logs received
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

      {/* 5. COVERAGE BY TEHSIL */}
      {showTehsilDemo ? (
        <TehsilCoveragePanel
          rows={rankedTehsils}
          loading={loading}
          periodHint={periodHint}
          behindCount={tehsilsBehind}
          watchCount={tehsilsWatch}
        />
      ) : null}

      {/* 6. TRENDS */}
      <section>
        <InfoSectionHeader
          kind="trends"
          title="Monthly trends"
          description={`How delivery and energy change month by month in ${year}`}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-0 overflow-hidden py-0 ring-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
              <CardTitle className="text-base font-semibold">Water delivery</CardTitle>
              <CardDescription className="text-xs">
                Monthly volume (m³) with cumulative year-to-date
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
                Monthly operating hours across tube wells
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
              Monthly grid export vs import (kWh)
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
