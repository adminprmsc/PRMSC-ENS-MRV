import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Droplets,
  FileCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  RefreshCcw,
  Send,
  Sun,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { PageHeader, PageShell } from "../../../components/layout";
import { Label } from "../../../components/ui/label";
import { Progress } from "../../../components/ui/progress";
import { Separator } from "../../../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { tehsilRoutes } from "../../../constants/routes";
import { useAuth } from "../../../contexts/AuthContext";
import {
  ALL_TEHSILS,
  ALL_VILLAGES,
  useLocationCatalog,
} from "../../../hooks/useLocationCatalog";
import { useTehsilProgramSummary } from "../../../hooks";
import type { TehsilProgramSummarySystemRow } from "../../../hooks/useTehsilProgramSummary";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getPakistanIsoDateString,
  getPakistanYear,
} from "../../../utils/pakistanTime";
import { getLoggingCompliance } from "../../../services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "../logging/loggingComplianceTypes";
import {
  formatAssignedOperators,
} from "../logging/loggingComplianceTypes";

// ─── Types ───────────────────────────────────────────────────────────────────

type Filters = {
  tehsil: string;
  village: string;
  month: string | number;
  year: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    label: "Water systems",
    description: "Tube wells",
    icon: Droplets,
    route: tehsilRoutes.waterSystems,
    accent: "text-blue-600 bg-blue-50",
  },
  {
    label: "Submissions",
    description: "Daily logs",
    icon: FileCheck,
    route: tehsilRoutes.waterSubmissions,
    accent: "text-violet-600 bg-violet-50",
  },
  {
    label: "Anomalies",
    description: "Volume flags",
    icon: AlertTriangle,
    route: tehsilRoutes.waterAlerts,
    accent: "text-amber-600 bg-amber-50",
  },
  {
    label: "Certificates",
    description: "Calibration",
    icon: FileText,
    route: tehsilRoutes.calibrationCertificates,
    accent: "text-emerald-600 bg-emerald-50",
  },
  {
    label: "Solar systems",
    description: "PV sites",
    icon: Sun,
    route: tehsilRoutes.solarSites,
    accent: "text-amber-600 bg-amber-50",
  },
  {
    label: "Monthly solar logs",
    description: "Grid import/export",
    icon: CalendarClock,
    route: tehsilRoutes.solarMonthlyLogging,
    accent: "text-orange-600 bg-orange-50",
  },
] as const;

const MONTH_LABELS: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

const WATER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  missing: {
    label: "Not entered",
    color: "border-red-200 bg-red-50 text-red-700",
    icon: <XCircle className="size-3" />,
  },
  draft: {
    label: "Draft",
    color: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <Circle className="size-3" />,
  },
  submitted: {
    label: "Submitted",
    color: "border-blue-200 bg-blue-50 text-blue-700",
    icon: <Send className="size-3" />,
  },
  accepted: {
    label: "Approved",
    color: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="size-3" />,
  },
  rejected: {
    label: "Rejected",
    color: "border-red-200 bg-red-50 text-red-700",
    icon: <XCircle className="size-3" />,
  },
  reverted_back: {
    label: "Sent back",
    color: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <Clock className="size-3" />,
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function WaterStatusBadge({ status }: { status: string }) {
  const cfg = WATER_STATUS_CONFIG[status];
  if (!cfg) return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  return (
    <Badge
      variant="outline"
      className={`flex shrink-0 items-center gap-1 text-[10px] font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

/** Today's water logging card — auto-fetches for the current Pakistan date. */
function TodayWaterCard({ tehsil }: { tehsil?: string }) {
  const today = getPakistanIsoDateString(new Date());
  const [systems, setSystems] = useState<WaterSystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { water_date: today };
      if (tehsil && tehsil !== ALL_TEHSILS) params.tehsil = tehsil;
      const data = (await getLoggingCompliance(params)) as {
        water_systems?: WaterSystemRow[];
      };
      setSystems(data.water_systems ?? []);
    } catch {
      setSystems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tehsil]);

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

  const PREVIEW = 5;
  const shown = expanded ? systems : systems.slice(0, PREVIEW);

  const todayLabel = new Date(today + "T00:00:00").toLocaleDateString("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
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
              <RefreshCcw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-2 animate-pulse rounded-full bg-muted" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : total === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No water systems in scope
          </p>
        ) : (
          <>
            {/* KPI */}
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold tabular-nums">{pct}%</span>
              <div className="pb-1 text-right text-xs text-muted-foreground">
                <p className="font-medium">
                  {entered}/{total} have an entry
                </p>
                <p>
                  {submitted} submitted · {missing} missing
                </p>
              </div>
            </div>
            <ProgressBar pct={pct} color={barColor} />

            {/* Status summary pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "accepted",
                  "submitted",
                  "draft",
                  "reverted_back",
                  "rejected",
                  "missing",
                ] as const
              ).map((st) => {
                const count = systems.filter(
                  (s) => s.daily_status === st,
                ).length;
                if (!count) return null;
                const cfg = WATER_STATUS_CONFIG[st];
                return (
                  <span
                    key={st}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg?.color ?? ""}`}
                  >
                    {cfg?.icon}
                    {count} {cfg?.label ?? st}
                  </span>
                );
              })}
            </div>

            <Separator />

            {/* Per-site rows — pending first (API already sorts them) */}
            <div className="space-y-0.5">
              {shown.map((s) => {
                const location = [s.settlement, s.village, s.tehsil]
                  .filter(Boolean)
                  .join(", ");
                const ops = formatAssignedOperators(s.assigned_operators);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {location || s.unique_identifier}
                      </p>
                      {ops ? (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {ops}
                        </p>
                      ) : null}
                    </div>
                    <WaterStatusBadge status={s.daily_status} />
                  </div>
                );
              })}
            </div>

            {total > PREVIEW && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                <TrendingUp className="size-3" />
                {expanded ? "Show less" : `Show ${total - PREVIEW} more`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Period-based progress card for water or solar. */
function LoggingProgressCard({
  title,
  icon,
  iconColor,
  total,
  logged,
  systems,
  isSolar,
  loading,
  periodLabel,
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  total: number;
  logged: number;
  systems: TehsilProgramSummarySystemRow[];
  isSolar: boolean;
  loading: boolean;
  periodLabel: string;
}) {
  const pct = total > 0 ? Math.round((100 * logged) / total) : 0;
  const open = total - logged;
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

  const [expanded, setExpanded] = useState(false);
  const shownSystems = expanded ? systems : systems.slice(0, 4);

  function formatLastLog(row: TehsilProgramSummarySystemRow): string {
    if (isSolar) {
      const y = row.lifetime_last_log_year;
      const m = row.lifetime_last_log_month;
      if (y && m) return `${MONTH_LABELS[m] ?? ""} ${y}`;
      return "No log yet";
    }
    const d = row.last_log_date ?? row.lifetime_last_log_date;
    if (!d) return "No log yet";
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-2 animate-pulse rounded-full bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-lg ${iconColor}`}
            >
              {icon}
            </div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold ${statusClass}`}
          >
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold tabular-nums">{pct}%</span>
          <span className="pb-1 text-xs text-muted-foreground">
            {logged}/{total} logged · {open} open
          </span>
        </div>
        <ProgressBar pct={pct} color={barColor} />
        <p className="text-[11px] text-muted-foreground">{periodLabel}</p>

        {systems.length > 0 && (
          <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
            {shownSystems.map((s) => {
              const location = [s.settlement, s.village, s.tehsil]
                .filter(Boolean)
                .join(", ");
              const uid = s.unique_identifier ?? s.id.slice(0, 8);
              const logCount = isSolar
                ? (s.months_logged ?? s.logs_count)
                : s.logs_count;
              const logUnit = isSolar ? "mo." : "logs";
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                >
                  {s.logged ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {location || uid}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {uid} · {logCount} {logUnit} · Last:{" "}
                      {formatLastLog(s)}
                    </p>
                  </div>
                  <Badge
                    variant={s.logged ? "default" : "outline"}
                    className={`shrink-0 text-[10px] ${
                      s.logged
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        : "border-red-200 text-red-500"
                    }`}
                  >
                    {s.logged ? "Logged" : "Pending"}
                  </Badge>
                </div>
              );
            })}
            {systems.length > 4 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                <TrendingUp className="size-3" />
                {expanded
                  ? "Show less"
                  : `Show ${systems.length - 4} more sites`}
              </button>
            )}
          </div>
        )}

        {systems.length === 0 && total === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No sites in scope
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TehsilManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    tehsils: catalogTehsils,
    resolveUserTehsils,
    scopeVillageOptions,
  } = useLocationCatalog();

  const scopedTehsils = useMemo((): string[] => {
    const fromUser = resolveUserTehsils(user?.tehsils);
    return fromUser.length > 0 ? fromUser : catalogTehsils;
  }, [user?.tehsils, resolveUserTehsils, catalogTehsils]);

  const currentYear = getPakistanYear();
  const defaultTehsil = useMemo((): string => {
    if (scopedTehsils.length === 1) {
      const only = scopedTehsils[0];
      if (only !== undefined) return only;
    }
    return ALL_TEHSILS;
  }, [scopedTehsils]);

  const [filters, setFilters] = useState<Filters>({
    tehsil: defaultTehsil,
    village: ALL_VILLAGES,
    month: "",
    year: currentYear,
  });
  const [activeFilters, setActiveFilters] = useState<Filters>({ ...filters });

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      tehsil: defaultTehsil,
      village: ALL_VILLAGES,
    }));
    setActiveFilters((prev) => ({
      ...prev,
      tehsil: defaultTehsil,
      village: ALL_VILLAGES,
    }));
  }, [defaultTehsil]);

  const TEHSILS = useMemo(() => {
    if (scopedTehsils.length === 1) return scopedTehsils;
    return [ALL_TEHSILS, ...scopedTehsils];
  }, [scopedTehsils]);

  const villageOptions = useMemo(
    () =>
      scopeVillageOptions(filters.tehsil, { allowedTehsils: scopedTehsils }),
    [scopeVillageOptions, filters.tehsil, scopedTehsils],
  );

  const {
    data: summary,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorObject,
    refetch,
  } = useTehsilProgramSummary(activeFilters);

  const MONTHS: Array<{ value: string | number; label: string }> = [
    { value: "", label: "All months" },
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];
  const YEARS = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    if (!statsError) return;
    toast.error(
      getApiErrorMessage(statsErrorObject, "Failed to load dashboard statistics"),
    );
  }, [statsError, statsErrorObject]);

  const safeSummary = summary ?? {
    ohr_count: 0,
    solar_facilities: 0,
    bulk_meters: 0,
  };

  const meterCoveragePct = useMemo(() => {
    const total = safeSummary.ohr_count;
    if (!total) return null;
    return Math.round((100 * safeSummary.bulk_meters) / total);
  }, [safeSummary.ohr_count, safeSummary.bulk_meters]);

  const tehsilScope =
    scopedTehsils.length === 1
      ? scopedTehsils[0]
      : `${scopedTehsils.length} assigned tehsils`;

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      activeFilters.tehsil === ALL_TEHSILS ? "All tehsils" : activeFilters.tehsil;
    const village =
      activeFilters.village === ALL_VILLAGES ? "all villages" : activeFilters.village;
    const month =
      activeFilters.month === ""
        ? "all months"
        : (MONTHS.find((m) => m.value === activeFilters.month)?.label ??
          String(activeFilters.month));
    return `${tehsil} · ${village} · ${month} ${activeFilters.year}`;
  }, [activeFilters, MONTHS]);

  const periodLabel = useMemo(() => {
    const month =
      activeFilters.month === ""
        ? "All months"
        : (MONTHS.find((m) => m.value === activeFilters.month)?.label ??
          String(activeFilters.month));
    return `${month}, ${activeFilters.year}`;
  }, [activeFilters, MONTHS]);

  const waterSystems = safeSummary.water_systems ?? [];
  const solarSystems = safeSummary.solar_systems ?? [];
  const waterLogged =
    safeSummary.water_sites_logged ??
    waterSystems.filter((s) => s.logged).length;
  const solarLogged =
    safeSummary.solar_sites_logged ??
    solarSystems.filter((s) => s.logged).length;

  // The tehsil the today-card should scope to (single tehsil if assigned)
  const todayTehsil: string =
    scopedTehsils.length === 1
      ? (scopedTehsils[0] ?? ALL_TEHSILS)
      : activeFilters.tehsil;

  return (
    <PageShell>
      <PageHeader
        icon={<LayoutDashboard className="size-[18px]" />}
        title="Dashboard"
        description="At-a-glance view of infrastructure in your tehsil scope."
        badge={
          <Badge
            variant="outline"
            className="text-xs font-medium uppercase tracking-wide"
          >
            {tehsilScope}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void refetch()}
            disabled={statsLoading}
          >
            <Activity
              className={`size-4 ${statsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      {/* ── TODAY'S WATER LOGGING (live, always current date) ── */}
      <TodayWaterCard tehsil={todayTehsil} />

      {/* ── SCOPE filter ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Period scope</CardTitle>
          <CardDescription>
            Period metrics reflect:{" "}
            <span className="font-medium">{activeScopeLabel}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="Tehsil"
            value={filters.tehsil}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                tehsil: value,
                village: ALL_VILLAGES,
              }))
            }
            options={TEHSILS}
            disabled={scopedTehsils.length === 1}
          />
          <FilterSelect
            label="Village"
            value={filters.village}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, village: value }))
            }
            options={villageOptions}
          />
          <FilterSelect
            label="Month"
            value={String(filters.month)}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                month: value === "" ? "" : Number(value),
              }))
            }
            options={MONTHS.map((m) => ({
              label: m.label,
              value: String(m.value),
            }))}
          />
          <FilterSelect
            label="Year"
            value={String(filters.year)}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, year: Number(value) }))
            }
            options={YEARS.map((year) => ({
              label: String(year),
              value: String(year),
            }))}
          />
          <div className="flex items-end">
            <Button
              className="h-10 w-full"
              onClick={() => setActiveFilters({ ...filters })}
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── PERIOD LOGGING PROGRESS ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Period logging coverage
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LoggingProgressCard
            title="Water logging"
            icon={<Droplets className="size-4" />}
            iconColor="text-blue-600 bg-blue-50"
            total={safeSummary.ohr_count}
            logged={waterLogged}
            systems={waterSystems}
            isSolar={false}
            loading={statsLoading}
            periodLabel={`Daily logs · ${periodLabel}`}
          />
          <LoggingProgressCard
            title="Solar logging"
            icon={<Sun className="size-4" />}
            iconColor="text-amber-600 bg-amber-50"
            total={safeSummary.solar_facilities}
            logged={solarLogged}
            systems={solarSystems}
            isSolar={true}
            loading={statsLoading}
            periodLabel={`Monthly logs · ${periodLabel}`}
          />

          {/* Meter readiness */}
          <Card>
            {statsLoading ? (
              <CardContent className="space-y-3 pt-6">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-2 animate-pulse rounded-full bg-muted" />
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Gauge className="size-4" />
                      </div>
                      <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Meter readiness
                      </CardTitle>
                    </div>
                    {meterCoveragePct !== null && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          meterCoveragePct >= 80
                            ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                            : "border-amber-200 text-amber-700 bg-amber-50"
                        }`}
                      >
                        {meterCoveragePct >= 80 ? "On track" : "Needs attention"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold tabular-nums">
                      {meterCoveragePct !== null ? `${meterCoveragePct}%` : "—"}
                    </span>
                    <span className="pb-1 text-xs text-muted-foreground">
                      {safeSummary.bulk_meters}/{safeSummary.ohr_count} with
                      meter
                    </span>
                  </div>
                  <ProgressBar
                    pct={meterCoveragePct ?? 0}
                    color={
                      (meterCoveragePct ?? 0) >= 80
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Bulk meters installed on tube wells
                  </p>
                  <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {safeSummary.ohr_count - safeSummary.bulk_meters} tube well
                    {safeSummary.ohr_count - safeSummary.bulk_meters !== 1
                      ? "s"
                      : ""}{" "}
                    without a bulk meter in scope
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ── QUICK ACCESS ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick access
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.route}
                type="button"
                onClick={() => navigate(link.route)}
                className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${link.accent}`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {link.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
};

// ─── FilterSelect ─────────────────────────────────────────────────────────────

type FilterSelectOption = string | { label: string; value: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  disabled?: boolean;
}) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option,
  );
  const EMPTY_VALUE = "__all__";
  const selectValue = value === "" ? EMPTY_VALUE : value;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (nextValue === null) return;
          onChange(nextValue === EMPTY_VALUE ? "" : nextValue);
        }}
      >
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder={`Select ${label}`} />
        </SelectTrigger>
        <SelectContent align="start" className="max-h-72">
          {normalizedOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value === "" ? EMPTY_VALUE : option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default TehsilManagerDashboard;
