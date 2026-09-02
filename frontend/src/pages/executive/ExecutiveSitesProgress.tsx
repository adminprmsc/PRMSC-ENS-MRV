import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
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
import { CopyableId } from "@/components/common/CopyableId";
import { LivePulseBadge } from "@/components/LivePulseBadge";
import { PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import { SolarSiteTypeBadge } from "@/components/SolarSiteTypeBadge";
import { SOLAR_SITE_TYPES } from "@/constants/solarSiteTypes";
import { hqRoutes } from "@/constants/routes";
import { useAuth } from "@/contexts/AuthContext";
import { useProgramDashboardApi } from "@/hooks";
import {
  ALL_VILLAGES,
  useLocationCatalog,
} from "@/hooks/useLocationCatalog";
import { getApiErrorMessage } from "@/lib/api-error";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import { HQ_NEW_TAB_LINK_PROPS, withHqReturnPath } from "@/lib/hqDetailLink";
import {
  fetchScopedProgramDashboard,
  type ProgramSolarSystemCoverage,
  type ProgramSummary,
  type ProgramWaterSystemCoverage,
} from "./fetchScopedProgramDashboard";
import {
  buildExecutiveScopeApiFilters,
  executiveYearLabel,
  EXECUTIVE_YEAR_SELECT_OPTIONS,
  resolveExecutiveYearFromUrl,
} from "./executivePeriodFilters";
import {
  TehsilCoveragePanel,
  buildRankedTehsilCoverage,
  formatAdminDate,
  formatSolarPeriod,
} from "./AdminDashboardBlocks";

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
          label: "Site type",
          value: <SolarSiteTypeBadge value={row.site_type} />,
        },
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
  const location = useLocation();
  const returnPath = location.pathname + location.search;
  const { getDashboardProgramSummary } = useProgramDashboardApi();
  const {
    tehsils: catalogTehsils,
    resolveUserTehsils,
    scopeVillageOptions,
    scopeTehsilOptions,
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
    village: searchParams.get("village")?.trim() || ALL_VILLAGES,
    month: urlMonth || "All Months",
    year: resolveExecutiveYearFromUrl(urlYear),
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

  const villageOptions = useMemo(
    () =>
      scopeVillageOptions(filters.tehsil, {
        allowedTehsils,
      }),
    [scopeVillageOptions, filters.tehsil, allowedTehsils],
  );

  const updateScope = useCallback((patch: Partial<ScopeFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.tehsil !== undefined) next.village = ALL_VILLAGES;
      return next;
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const apiFilters = buildExecutiveScopeApiFilters({
          tehsil: filters.tehsil,
          village: filters.village,
          year: filters.year,
          month: filters.month,
        });
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
    const yearLabel = executiveYearLabel(filters.year);
    if (filters.month !== "All Months") {
      return `${MONTHS[Number(filters.month) - 1] ?? "Month"} ${yearLabel}`;
    }
    return yearLabel;
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
          <CopyableId
            value={String(row.original.unique_identifier ?? "")}
            label="System ID"
          />
        ),
        // Search covers System ID / location / operator — avoid a second filter row.
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
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
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "settlement",
        header: "Settlement",
        cell: ({ getValue }) => String(getValue() ?? "—") || "—",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
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
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "operatorLabel",
        header: "Operator",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={withHqReturnPath(hqRoutes.waterSystem(row.original.id), returnPath)}
            {...HQ_NEW_TAB_LINK_PROPS}
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
    [returnPath],
  );

  const solarColumns = useMemo<Array<ColumnDef<SolarGridRow, unknown>>>(
    () => [
      {
        accessorKey: "unique_identifier",
        header: "Site ID",
        cell: ({ row }) => (
          <CopyableId
            value={String(row.original.unique_identifier ?? "")}
            label="Site ID"
          />
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        id: "site_type",
        accessorFn: (row) => row.site_type?.trim() || "Not set",
        header: "Site type",
        cell: ({ row }) => <SolarSiteTypeBadge value={row.original.site_type} />,
        meta: {
          filterVariant: "select",
          filterOptions: [...SOLAR_SITE_TYPES, "Not set"],
        } satisfies DataGridColumnMeta,
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
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "settlement",
        header: "Settlement",
        cell: ({ getValue }) => String(getValue() ?? "—") || "—",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
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
            to={withHqReturnPath(hqRoutes.solarSite(row.original.id), returnPath)}
            {...HQ_NEW_TAB_LINK_PROPS}
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
    [returnPath],
  );

  const tehsilOptions = useMemo(
    () =>
      scopeTehsilOptions({
        allowedTehsils: restrictTehsils ? allowedTehsils : catalogTehsils,
        includeAll: true,
        allLabel: ALL_ASSIGNED_TEHSILS,
      }),
    [scopeTehsilOptions, restrictTehsils, allowedTehsils, catalogTehsils],
  );

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
        <CardContent className="p-3 sm:p-4">
          <FieldGroup className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            <Field className="gap-1">
              <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Tehsil
              </FieldLabel>
              <Select
                value={filters.tehsil}
                onValueChange={(v) =>
                  updateScope({ tehsil: v ?? filters.tehsil })
                }
              >
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
                  <SelectValue placeholder="Tehsil" />
                </SelectTrigger>
                <SelectContent>
                  {tehsilOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === ALL_ASSIGNED_TEHSILS
                        ? `All (${allowedTehsils.length})`
                        : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Village
              </FieldLabel>
              <Select
                value={filters.village}
                onValueChange={(v) =>
                  updateScope({ village: v ?? filters.village })
                }
              >
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
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
            <Field className="gap-1">
              <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Year
              </FieldLabel>
              <Select
                value={filters.year}
                onValueChange={(v) => updateScope({ year: v ?? filters.year })}
              >
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {EXECUTIVE_YEAR_SELECT_OPTIONS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {executiveYearLabel(y)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Month
              </FieldLabel>
              <Select
                value={filters.month}
                onValueChange={(v) =>
                  updateScope({ month: v ?? filters.month })
                }
              >
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
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
            <div className="col-span-2 flex items-end sm:col-span-1">
              <LivePulseBadge syncing={loading} />
            </div>
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
              description="Search by system ID, village, or operator. Filter by Logged / Missing if needed."
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
              description="Search by site ID or village. Filter by status or site type if needed."
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
