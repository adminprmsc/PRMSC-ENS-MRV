import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  Droplets,
  ListChecks,
  Sun,
} from "lucide-react";
import DataGrid, { type DataGridColumnMeta } from "@/components/DataGrid";
import DataGridSkeleton from "@/components/DataGridSkeleton";
import { DetailTile } from "@/components/common/DetailTile";
import { LivePulseBadge } from "@/components/LivePulseBadge";
import { PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hqRoutes } from "@/constants/routes";
import { useAuth } from "@/contexts/AuthContext";
import { useProgramDashboardApi } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import { LOCATION_DATA, TEHSIL_OPTIONS } from "@/utils/locationData";
import {
  TehsilCoveragePanel,
  buildRankedTehsilCoverage,
  formatAdminDate,
  formatSolarPeriod,
} from "./AdminDashboardBlocks";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import {
  fetchScopedProgramDashboard,
  type ProgramSolarSystemCoverage,
  type ProgramSummary,
  type ProgramWaterSystemCoverage,
} from "./fetchScopedProgramDashboard";

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

type ScopeFilters = {
  tehsil: string;
  village: string;
  month: string;
  year: string;
};

type WaterGridRow = ProgramWaterSystemCoverage & {
  statusLabel: string;
  operatorLabel: string;
  lastLogLabel: string;
} & Record<string, unknown>;

type SolarGridRow = ProgramSolarSystemCoverage & {
  statusLabel: string;
  lastLogLabel: string;
} & Record<string, unknown>;

function statusBadge(logged: boolean) {
  if (logged) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 font-normal text-emerald-800"
      >
        Logged
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-rose-200 bg-rose-50 font-normal text-rose-800"
    >
      Missing
    </Badge>
  );
}

function WaterSiteDetails({ row }: { row: WaterGridRow }) {
  const progressHint = Math.min(100, row.days_logged * 10);
  const progress = row.logged ? Math.max(progressHint, 8) : 0;
  return (
    <DetailTile
      title="Daily logging"
      summary={`${row.days_logged}d logged · ${row.logs_count} submissions`}
      badge={statusBadge(row.logged)}
      progress={progress}
      progressHint={`${progress}% period progress`}
      actionHref={hqRoutes.waterSystem(row.id)}
      actionLabel="Open site"
      fields={[
        {
          label: "Location",
          value:
            [row.village, row.settlement, row.tehsil]
              .filter(Boolean)
              .join(" · ") || "—",
        },
        {
          label: "Last log",
          value: formatAdminDate(row.last_log_date ?? row.lifetime_last_log_date),
        },
        {
          label: "Meter",
          value: row.bulk_meter_installed ? "Installed" : "Not installed",
        },
        {
          label: "Operators",
          value:
            (row.assigned_operators?.length ?? 0) === 0
              ? "Unassigned"
              : row.assigned_operators
                  .map((o) => [o.name, o.phone].filter(Boolean).join(" · "))
                  .join("; "),
          className: "sm:col-span-2 lg:col-span-1",
        },
      ]}
    />
  );
}

function SolarSiteDetails({ row }: { row: SolarGridRow }) {
  const progressHint = Math.min(100, row.months_logged * 25);
  const progress = row.logged ? Math.max(progressHint, 8) : 0;
  return (
    <DetailTile
      title="Monthly logging"
      summary={`${row.months_logged} mo logged · ${row.logs_count} records`}
      badge={statusBadge(row.logged)}
      progress={progress}
      progressHint={`${progress}% period progress`}
      actionHref={hqRoutes.solarSite(row.id)}
      actionLabel="Open site"
      fields={[
        {
          label: "Location",
          value:
            [row.village, row.settlement, row.tehsil]
              .filter(Boolean)
              .join(" · ") || "—",
        },
        {
          label: "Last period",
          value: formatSolarPeriod(
            row.lifetime_last_log_year,
            row.lifetime_last_log_month,
          ),
        },
      ]}
    />
  );
}

const ExecutiveSitesProgress = () => {
  const { user } = useAuth();
  const { getDashboardProgramSummary } = useProgramDashboardApi();

  const allowedTehsils = useMemo(() => {
    const t = (user?.tehsils ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    return t.length ? t : [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);
  const restrictTehsils = (user?.tehsils ?? []).length > 0;
  const initialTehsil =
    restrictTehsils && allowedTehsils.length > 1
      ? ALL_ASSIGNED_TEHSILS
      : restrictTehsils
        ? String(allowedTehsils[0] ?? "").trim() || ALL_ASSIGNED_TEHSILS
        : ALL_ASSIGNED_TEHSILS;

  const [searchParams] = useSearchParams();
  const urlTehsil = searchParams.get("tehsil")?.trim() || "";
  const urlYear = searchParams.get("year")?.trim() || "";
  const urlMonth = searchParams.get("month")?.trim() || "";
  const urlTab = searchParams.get("tab")?.trim() || "water";
  const resolvedTehsil =
    urlTehsil &&
    (urlTehsil === ALL_ASSIGNED_TEHSILS ||
      allowedTehsils.includes(urlTehsil) ||
      !restrictTehsils)
      ? urlTehsil
      : initialTehsil;

  const [filters, setFilters] = useState<ScopeFilters>(() => ({
    tehsil: resolvedTehsil,
    village: searchParams.get("village")?.trim() || "All Villages",
    month: urlMonth || "All Months",
    year: urlYear || "2026",
  }));
  const [activeTab, setActiveTab] = useState(() =>
    urlTab === "solar" || urlTab === "coverage" || urlTab === "water"
      ? urlTab
      : "water",
  );
  const [summary, setSummary] = useState<ProgramSummary>({
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const villageOptions = useMemo(() => {
    if (filters.tehsil === ALL_ASSIGNED_TEHSILS) {
      if (restrictTehsils && allowedTehsils.length) {
        const villages = new Set<string>();
        for (const tehsil of allowedTehsils) {
          for (const village of (LOCATION_DATA[tehsil.toUpperCase()] ||
            []) as string[]) {
            villages.add(village);
          }
        }
        return ["All Villages", ...[...villages].sort()];
      }
      return ["All Villages"];
    }
    return [
      "All Villages",
      ...((LOCATION_DATA[filters.tehsil.toUpperCase()] || []) as string[]),
    ];
  }, [filters.tehsil, restrictTehsils, allowedTehsils]);

  const updateScope = useCallback((patch: Partial<ScopeFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.tehsil !== undefined) next.village = "All Villages";
      return next;
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const apiFilters = {
          tehsil: filters.tehsil,
          village: filters.village,
          year: Number(filters.year),
          ...(filters.month !== "All Months"
            ? { month: Number(filters.month) }
            : {}),
        };
        const { summary: sum } = await fetchScopedProgramDashboard(
          apiFilters,
          allowedTehsils,
          {
            summary: (f) =>
              getDashboardProgramSummary(f) as Promise<
                ProgramSummary | undefined
              >,
            water: async () => [],
            pump: async () => [],
            solar: async () => [],
            grid: async () => [],
          },
        );
        setSummary(sum);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load sites progress"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filters, allowedTehsils, getDashboardProgramSummary]);

  const periodHint = useMemo(() => {
    if (filters.month !== "All Months") {
      return `${MONTHS[Number(filters.month) - 1] ?? "Month"} ${filters.year}`;
    }
    return filters.year;
  }, [filters.month, filters.year]);

  const waterRows = useMemo<WaterGridRow[]>(() => {
    return (summary.water_systems ?? []).map((s) => ({
      ...s,
      statusLabel: s.logged ? "Logged" : "Missing",
      operatorLabel:
        (s.assigned_operators?.length ?? 0) === 0
          ? "Unassigned"
          : s.assigned_operators.map((o) => o.name).join(", "),
      lastLogLabel: formatAdminDate(
        s.last_log_date ?? s.lifetime_last_log_date,
      ),
    }));
  }, [summary.water_systems]);

  const solarRows = useMemo<SolarGridRow[]>(() => {
    return (summary.solar_systems ?? []).map((s) => ({
      ...s,
      statusLabel: s.logged ? "Logged" : "Missing",
      lastLogLabel: formatSolarPeriod(
        s.lifetime_last_log_year,
        s.lifetime_last_log_month,
      ),
    }));
  }, [summary.solar_systems]);

  const rankedTehsils = useMemo(
    () =>
      buildRankedTehsilCoverage(
        summary.by_tehsil ?? [],
        summary.water_systems ?? [],
        summary.solar_systems ?? [],
      ),
    [summary.by_tehsil, summary.water_systems, summary.solar_systems],
  );

  const tehsilsBehind = rankedTehsils.filter((r) => r.tone === "risk").length;
  const tehsilsWatch = rankedTehsils.filter((r) => r.tone === "watch").length;

  const waterColumns = useMemo<Array<ColumnDef<WaterGridRow, unknown>>>(
    () => [
      {
        accessorKey: "unique_identifier",
        header: "System ID",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.unique_identifier}</span>
        ),
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "statusLabel",
        header: "Status",
        cell: ({ row }) => statusBadge(row.original.logged),
        meta: {
          filterVariant: "select",
          filterOptions: ["Logged", "Missing"],
        } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "tehsil",
        header: "Tehsil",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "settlement",
        header: "Settlement",
        cell: ({ getValue }) => String(getValue() ?? "—") || "—",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "days_logged",
        header: "Days logged",
        cell: ({ getValue }) => (
          <span className="font-mono tabular-nums">{String(getValue())}</span>
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "lastLogLabel",
        header: "Last log",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        id: "meter",
        header: "Meter",
        accessorFn: (row) =>
          row.bulk_meter_installed ? "Installed" : "Not installed",
        cell: ({ row }) =>
          row.original.bulk_meter_installed ? "Installed" : "Not installed",
        meta: {
          filterVariant: "select",
          filterOptions: ["Installed", "Not installed"],
        } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "operatorLabel",
        header: "Operator",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={hqRoutes.waterSystem(row.original.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open
            <ArrowRight className="size-3" />
          </Link>
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
    ],
    [],
  );

  const solarColumns = useMemo<Array<ColumnDef<SolarGridRow, unknown>>>(
    () => [
      {
        accessorKey: "unique_identifier",
        header: "Site ID",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.unique_identifier}</span>
        ),
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "statusLabel",
        header: "Status",
        cell: ({ row }) => statusBadge(row.original.logged),
        meta: {
          filterVariant: "select",
          filterOptions: ["Logged", "Missing"],
        } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "tehsil",
        header: "Tehsil",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "settlement",
        header: "Settlement",
        cell: ({ getValue }) => String(getValue() ?? "—") || "—",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "months_logged",
        header: "Months logged",
        cell: ({ getValue }) => (
          <span className="font-mono tabular-nums">{String(getValue())}</span>
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "lastLogLabel",
        header: "Last log",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={hqRoutes.solarSite(row.original.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open
            <ArrowRight className="size-3" />
          </Link>
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
    ],
    [],
  );

  const tehsilOptions = useMemo(() => {
    if (restrictTehsils && allowedTehsils.length > 1) {
      return [ALL_ASSIGNED_TEHSILS, ...allowedTehsils];
    }
    if (restrictTehsils) return allowedTehsils;
    return [ALL_ASSIGNED_TEHSILS, ...TEHSIL_OPTIONS];
  }, [restrictTehsils, allowedTehsils]);

  const waterLogged = Number(summary.water_sites_logged ?? 0);
  const solarLogged = Number(summary.solar_sites_logged ?? 0);

  return (

    
    <PageShell className="animate-fade-in-up">
      <PageHeader
        title="Sites Progress"
        description={`${periodHint} · per-site logging status`}
        icon={<ListChecks className="size-5" />}
        badge={<LivePulseBadge syncing={loading} />}
      />

      <Card className="gap-0 overflow-hidden py-0 shadow-sm ring-1 ring-foreground/10">
        <CardHeader className="border-b border-border/80 bg-muted/20 py-4 [.border-b]:pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight">
                Scope
              </CardTitle>
              <CardDescription className="text-xs">
                Filters apply to sites and coverage.
              </CardDescription>
            </div>
            <LivePulseBadge syncing={loading} />
          </div>
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
                  updateScope({ tehsil: v ?? filters.tehsil })
                }
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Tehsil" />
                </SelectTrigger>
                <SelectContent>
                  {tehsilOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === ALL_ASSIGNED_TEHSILS
                        ? `All assigned (${allowedTehsils.length})`
                        : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Village
              </FieldLabel>
              <Select
                value={filters.village}
                onValueChange={(v) =>
                  updateScope({ village: v ?? filters.village })
                }
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Village" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {villageOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Year
              </FieldLabel>
              <Select
                value={filters.year}
                onValueChange={(v) => updateScope({ year: v ?? filters.year })}
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
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
                onValueChange={(v) =>
                  updateScope({ month: v ?? filters.month })
                }
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Months">All months</SelectItem>
                  {MONTHS.map((m, i) => (
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

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="relative gap-0 overflow-hidden py-0 shadow-sm ring-1 ring-foreground/10">
          <div className="absolute inset-y-0 left-0 w-1 bg-blue-500/70" />
          <CardContent className="flex items-center gap-3 py-4 pl-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700">
              <Droplets className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Water systems
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                {loading
                  ? "—"
                  : `${waterLogged}/${summary.ohr_count} logged`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="relative gap-0 overflow-hidden py-0 shadow-sm ring-1 ring-foreground/10">
          <div className="absolute inset-y-0 left-0 w-1 bg-amber-500/70" />
          <CardContent className="flex items-center gap-3 py-4 pl-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-800">
              <Sun className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Solar sites
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                {loading
                  ? "—"
                  : `${solarLogged}/${summary.solar_facilities} logged`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="relative gap-0 overflow-hidden py-0 shadow-sm ring-1 ring-foreground/10">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
          <CardContent className="flex items-center gap-3 py-4 pl-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tehsils tracked
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                {loading ? "—" : rankedTehsils.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (v === "water" || v === "solar" || v === "coverage") {
            setActiveTab(v);
          }
        }}
        className="w-full min-w-0"
      >
        <TabsList className="flex h-auto w-full flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/60 p-1.5 sm:flex-row">
          <TabsTrigger
            value="water"
            className="h-11 w-full flex-1 justify-start gap-2 rounded-lg px-3 data-active:ring-1 data-active:ring-border"
          >
            <Droplets className="size-4 shrink-0 text-blue-600" />
            <span className="truncate">Water systems</span>
            <Badge
              variant="secondary"
              className="ml-auto font-mono text-[10px] tabular-nums"
            >
              {loading ? "…" : waterRows.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="solar"
            className="h-11 w-full flex-1 justify-start gap-2 rounded-lg px-3 data-active:ring-1 data-active:ring-border"
          >
            <Sun className="size-4 shrink-0 text-amber-600" />
            <span className="truncate">Solar sites</span>
            <Badge
              variant="secondary"
              className="ml-auto font-mono text-[10px] tabular-nums"
            >
              {loading ? "…" : solarRows.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="coverage"
            className="h-11 w-full flex-1 justify-start gap-2 rounded-lg px-3 data-active:ring-1 data-active:ring-border"
          >
            <ListChecks className="size-4 shrink-0 text-primary" />
            <span className="truncate">Coverage by tehsil</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="water" className="mt-0 w-full min-w-0 space-y-3">
          {loading ? (
            <DataGridSkeleton rows={10} columns={8} />
          ) : (
            <DataGrid
              title="Water systems progress"
              description="Expand a row for logging progress, meter, and operators — then open the full site record."
              exportFileName="hq-water-sites-progress"
              rows={waterRows}
              columns={waterColumns}
              getRowId={(row) => row.id}
              renderRowDetails={(row) => <WaterSiteDetails row={row} />}
            />
          )}
        </TabsContent>

        <TabsContent value="solar" className="mt-0 w-full min-w-0 space-y-3">
          {loading ? (
            <DataGridSkeleton rows={10} columns={7} />
          ) : (
            <DataGrid
              title="Solar sites progress"
              description="Expand a row for monthly logging progress, then open the full site record."
              exportFileName="hq-solar-sites-progress"
              rows={solarRows}
              columns={solarColumns}
              getRowId={(row) => row.id}
              renderRowDetails={(row) => <SolarSiteDetails row={row} />}
            />
          )}
        </TabsContent>

        <TabsContent value="coverage" className="mt-0 w-full min-w-0 space-y-3">
          <TehsilCoveragePanel
            rows={rankedTehsils}
            loading={loading}
            periodHint={periodHint}
            behindCount={tehsilsBehind}
            watchCount={tehsilsWatch}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default ExecutiveSitesProgress;
