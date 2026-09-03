import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleDot,
  Cpu,
  Droplets,
  Gauge,
  MapPin,
  RefreshCcw,
  Search,
  Settings2,
  Sun,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout";
import PaginatedListFooter from "@/components/PaginatedListFooter";
import { SearchableOptionField } from "@/components/common/SearchableOptionField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hqRoutes } from "@/constants/routes";
import {
  PUMP_TOTAL_DYNAMIC_HEAD_INFO,
  PUMP_TOTAL_DYNAMIC_HEAD_LABEL,
} from "@/constants/waterSystemSpecs";
import { useClientPagination } from "@/hooks/useClientPagination";
import {
  ALL_SETTLEMENTS,
  ALL_VILLAGES,
  useLocationCatalog,
} from "@/hooks/useLocationCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import {
  getSolarSystems,
  getWaterSystems,
} from "@/services/tehsilManagerOperatorService";
import type { SolarSystemRow, WaterSystemRow } from "@/types/api";
import { formatPumpCapacityKw } from "@/utils/waterPump";

/* ─── helpers ─── */

function val(v: unknown, unit = ""): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return unit ? `${v} ${unit}` : String(v);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ─── Sub-components ─── */

function SpecItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      {hint ? (
        <p className="text-[9px] leading-snug text-muted-foreground/60">{hint}</p>
      ) : null}
      <p className="text-sm font-medium text-foreground">
        {value === "—" ? <span className="text-muted-foreground/50">—</span> : value}
      </p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-2">
      <span className="flex size-5 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-4 gap-4 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Water site card ─── */
function WaterSiteCard({
  s,
  onView,
}: {
  s: WaterSystemRow;
  onView: () => void;
}) {
  return (
    <Card className="overflow-hidden border-border/50 transition-all hover:border-border hover:shadow-sm">
      <CardContent className="p-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[15px] font-bold tracking-tight text-foreground">
                {val(s.unique_identifier)}
              </span>
              {s.bulk_meter_installed ? (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Gauge className="size-3" /> Bulk meter installed
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-[11px] text-muted-foreground"
                >
                  No bulk meter
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="font-medium text-foreground/80">{val(s.village)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{val(s.tehsil)}</span>
              {s.settlement ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{s.settlement}</span>
                </>
              ) : null}
              {s.start_of_operation ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <CalendarDays className="size-3 shrink-0" />
                  <span>Since {fmtDate(s.start_of_operation)}</span>
                </>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 font-medium"
            onClick={onView}
          >
            View full details
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        <div className="mt-5 space-y-5">
          {/* ── Pump ── */}
          <div>
            <SectionHeader
              icon={<Settings2 className="size-3.5" />}
              title="Pump"
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <SpecItem label="Model" value={val(s.pump_model)} />
              <SpecItem label="Serial number" value={val(s.pump_serial_number)} />
              <SpecItem label="Horsepower" value={val(s.pump_horse_power, "HP")} />
              <SpecItem label="Capacity" value={formatPumpCapacityKw(s.pump_horse_power)} />
              <SpecItem
                label={PUMP_TOTAL_DYNAMIC_HEAD_LABEL}
                hint={PUMP_TOTAL_DYNAMIC_HEAD_INFO}
                value={val(s.pump_head, "m")}
              />
              <SpecItem label="Flow rate" value={val(s.pump_flow_rate, "m³/h")} />
              <SpecItem label="Height to OHR" value={val(s.height_to_ohr, "m")} />
            </div>
          </div>

          {/* ── OHR ── */}
          <div>
            <SectionHeader
              icon={<Building2 className="size-3.5" />}
              title="Overhead Reservoir (OHR)"
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <SpecItem label="Tank capacity" value={val(s.ohr_tank_capacity, "m³")} />
              <SpecItem label="Design fill time" value={val(s.ohr_fill_required, "min")} />
              <SpecItem label="Actual fill time" value={val(s.time_to_fill, "min")} />
            </div>
          </div>

          {/* ── Meter ── */}
          <div>
            <SectionHeader
              icon={<CircleDot className="size-3.5" />}
              title="Bulk meter"
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <SpecItem label="Model" value={val(s.meter_model)} />
              <SpecItem label="Serial number" value={val(s.meter_serial_number)} />
              <SpecItem label="Accuracy class" value={val(s.meter_accuracy_class)} />
              <SpecItem label="Installation date" value={fmtDate(s.installation_date)} />
            </div>
          </div>
        </div>

        {/* GPS */}
        {s.latitude && s.longitude ? (
          <a
            href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <MapPin className="size-3" />
            {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
            <span className="text-muted-foreground/40">·</span>
            Open in Maps
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─── Solar site card ─── */
function SolarSiteCard({
  s,
  onView,
}: {
  s: SolarSystemRow;
  onView: () => void;
}) {
  return (
    <Card className="overflow-hidden border-border/50 transition-all hover:border-border hover:shadow-sm">
      <CardContent className="p-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[15px] font-bold tracking-tight text-foreground">
                {val(s.unique_identifier)}
              </span>
              {s.site_type ? (
                <Badge variant="outline" className="text-[11px]">
                  {s.site_type}
                </Badge>
              ) : null}
              {s.solar_panel_capacity != null ? (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Sun className="size-3" /> {s.solar_panel_capacity} kWp
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="font-medium text-foreground/80">{val(s.village)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{val(s.tehsil)}</span>
              {s.settlement ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{s.settlement}</span>
                </>
              ) : null}
              {s.installation_location ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{s.installation_location}</span>
                </>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 font-medium"
            onClick={onView}
          >
            View full details
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        <div className="mt-5 space-y-5">
          {/* ── Solar system ── */}
          <div>
            <SectionHeader
              icon={<Sun className="size-3.5" />}
              title="Solar system"
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <SpecItem label="Panel capacity" value={val(s.solar_panel_capacity, "kWp")} />
              <SpecItem label="Inverter capacity" value={val(s.inverter_capacity, "kW")} />
              <SpecItem label="Inverter serial" value={val(s.inverter_serial_number)} />
              <SpecItem label="Installation date" value={fmtDate(s.installation_date)} />
            </div>
          </div>

          {/* ── Metering ── */}
          <div>
            <SectionHeader
              icon={<CircleDot className="size-3.5" />}
              title="Metering"
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <SpecItem label="Meter model" value={val(s.meter_model)} />
              <SpecItem label="Meter serial" value={val(s.meter_serial_number)} />
              <SpecItem label="Green meter connected" value={fmtDate(s.green_meter_connection_date)} />
            </div>
          </div>

          {/* ── Connections ── */}
          <div>
            <SectionHeader
              icon={<Zap className="size-3.5" />}
              title="Utility connections"
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <SpecItem label="Solar connection" value={fmtDate(s.solar_connection_date)} />
              <SpecItem label="Grid connection" value={fmtDate(s.electricity_connection_date)} />
              <SpecItem label="Green connection" value={fmtDate(s.green_connection_date)} />
              <SpecItem label="DISCO" value={val(s.disco_info)} />
              <SpecItem label="Bill reference" value={val(s.bill_reference_number)} />
            </div>
          </div>
        </div>

        {/* Remarks */}
        {s.remarks ? (
          <div className="mt-4 rounded-md border border-border/40 bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Remarks
            </p>
            <p className="mt-0.5 text-sm text-foreground/80">{s.remarks}</p>
          </div>
        ) : null}

        {/* GPS */}
        {s.latitude && s.longitude ? (
          <a
            href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <MapPin className="size-3" />
            {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
            <span className="text-muted-foreground/40">·</span>
            Open in Maps
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─── Paginated list wrappers ─── */

const PAGE_SIZE = 5;

type LocationScopeFilters = {
  tehsil: string;
  village: string;
  settlement: string;
};

function tehsilFilterLabel(value: string, assignedCount: number) {
  if (value === ALL_ASSIGNED_TEHSILS) {
    return assignedCount > 0
      ? `All assigned tehsils (${assignedCount})`
      : "All tehsils";
  }
  return value;
}

function matchesLocationScope(
  row: { tehsil?: string; village?: string; settlement?: string | null },
  filters: LocationScopeFilters,
  allowedTehsils: string[],
): boolean {
  const tehsil = String(row.tehsil ?? "").trim();
  const village = String(row.village ?? "").trim();
  const settlement = String(row.settlement ?? "").trim();

  if (filters.tehsil === ALL_ASSIGNED_TEHSILS) {
    if (allowedTehsils.length > 0 && !allowedTehsils.includes(tehsil)) {
      return false;
    }
  } else if (tehsil !== filters.tehsil) {
    return false;
  }

  if (filters.village !== ALL_VILLAGES && village !== filters.village) {
    return false;
  }

  if (filters.settlement !== ALL_SETTLEMENTS && settlement !== filters.settlement) {
    return false;
  }

  return true;
}

function matchesSearchQuery(
  values: Array<string | null | undefined>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.join(" ").toLowerCase().includes(q);
}

function WaterList({
  rows,
  loading,
  onView,
}: {
  rows: WaterSystemRow[];
  loading: boolean;
  onView: (id: string) => void;
}) {
  const { pageItems, pageIndex, pageSize, pageCount, total, setPageSize, goToPage, resetPage } =
    useClientPagination(rows, PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [rows, resetPage]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 py-16">
        <Droplets className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No water sites found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pageItems.map((s) => (
        <WaterSiteCard key={s.id} s={s} onView={() => onView(s.id)} />
      ))}
      <Card className="border-border/40">
        <PaginatedListFooter
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={pageCount}
          total={total}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}

function SolarList({
  rows,
  loading,
  onView,
}: {
  rows: SolarSystemRow[];
  loading: boolean;
  onView: (id: string) => void;
}) {
  const { pageItems, pageIndex, pageSize, pageCount, total, setPageSize, goToPage, resetPage } =
    useClientPagination(rows, PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [rows, resetPage]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 py-16">
        <Sun className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No solar sites found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pageItems.map((s) => (
        <SolarSiteCard key={s.id} s={s} onView={() => onView(s.id)} />
      ))}
      <Card className="border-border/40">
        <PaginatedListFooter
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={pageCount}
          total={total}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}

/* ─── Main page ─── */
export default function HqSitesTechInfoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tehsils: catalogTehsils,
    resolveUserTehsils,
    scopeTehsilOptions,
    scopeVillageOptions,
    scopeSettlementOptions,
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

  const [locationFilters, setLocationFilters] = useState<LocationScopeFilters>(
    () => ({
      tehsil: initialTehsil,
      village: ALL_VILLAGES,
      settlement: ALL_SETTLEMENTS,
    }),
  );

  const tehsilOptions = useMemo(
    () =>
      scopeTehsilOptions({
        allowedTehsils,
        includeAll: true,
        allLabel: ALL_ASSIGNED_TEHSILS,
      }),
    [scopeTehsilOptions, allowedTehsils],
  );

  const villageOptions = useMemo(
    () =>
      scopeVillageOptions(locationFilters.tehsil, {
        allowedTehsils,
      }),
    [scopeVillageOptions, locationFilters.tehsil, allowedTehsils],
  );

  const settlementOptions = useMemo(
    () =>
      scopeSettlementOptions(
        locationFilters.tehsil,
        locationFilters.village,
        { allowedTehsils },
      ),
    [
      scopeSettlementOptions,
      locationFilters.tehsil,
      locationFilters.village,
      allowedTehsils,
    ],
  );

  const updateLocationFilter = useCallback(
    (patch: Partial<LocationScopeFilters>) => {
      setLocationFilters((prev) => {
        const next = { ...prev, ...patch };
        if (patch.tehsil !== undefined) {
          next.village = ALL_VILLAGES;
          next.settlement = ALL_SETTLEMENTS;
        } else if (patch.village !== undefined) {
          next.settlement = ALL_SETTLEMENTS;
        }
        return next;
      });
    },
    [],
  );

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      locationFilters.tehsil === ALL_ASSIGNED_TEHSILS
        ? restrictTehsils
          ? `All assigned tehsils (${allowedTehsils.length})`
          : "All tehsils"
        : locationFilters.tehsil;
    const village =
      locationFilters.village === ALL_VILLAGES
        ? "All villages"
        : locationFilters.village;
    const settlement =
      locationFilters.settlement === ALL_SETTLEMENTS
        ? "All settlements"
        : locationFilters.settlement;
    return `${tehsil} · ${village} · ${settlement}`;
  }, [locationFilters, allowedTehsils.length, restrictTehsils]);

  const [waterRows, setWaterRows] = useState<WaterSystemRow[]>([]);
  const [solarRows, setSolarRows] = useState<SolarSystemRow[]>([]);
  const [loadingWater, setLoadingWater] = useState(true);
  const [loadingSolar, setLoadingSolar] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"water" | "solar">("water");

  const load = async (soft = false) => {
    if (soft) setRefreshing(true);
    else {
      setLoadingWater(true);
      setLoadingSolar(true);
    }

    await Promise.allSettled([
      (async () => {
        try {
          const data = (await getWaterSystems({})) as
            | WaterSystemRow[]
            | { data?: WaterSystemRow[] };
          setWaterRows(
            Array.isArray(data)
              ? data
              : ((data as { data?: WaterSystemRow[] }).data ?? []),
          );
        } catch (e) {
          toast.error(getApiErrorMessage(e, "Could not load water sites"));
        } finally {
          setLoadingWater(false);
        }
      })(),
      (async () => {
        try {
          const data = (await getSolarSystems({})) as
            | SolarSystemRow[]
            | { data?: SolarSystemRow[] };
          setSolarRows(
            Array.isArray(data)
              ? data
              : ((data as { data?: SolarSystemRow[] }).data ?? []),
          );
        } catch (e) {
          toast.error(getApiErrorMessage(e, "Could not load solar sites"));
        } finally {
          setLoadingSolar(false);
        }
      })(),
    ]);

    if (soft) setRefreshing(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredWater = useMemo(() => {
    return waterRows.filter((s) => {
      if (!matchesLocationScope(s, locationFilters, allowedTehsils)) {
        return false;
      }
      return matchesSearchQuery(
        [
          s.unique_identifier,
          s.village,
          s.tehsil,
          s.settlement,
          s.pump_model,
          s.pump_serial_number,
          s.meter_model,
          s.meter_serial_number,
        ],
        search,
      );
    });
  }, [waterRows, locationFilters, allowedTehsils, search]);

  const filteredSolar = useMemo(() => {
    return solarRows.filter((s) => {
      if (!matchesLocationScope(s, locationFilters, allowedTehsils)) {
        return false;
      }
      return matchesSearchQuery(
        [
          s.unique_identifier,
          s.village,
          s.tehsil,
          s.settlement,
          s.site_type,
          s.inverter_serial_number,
          s.meter_model,
          s.meter_serial_number,
          s.disco_info,
          s.bill_reference_number,
          s.installation_location,
        ],
        search,
      );
    });
  }, [solarRows, locationFilters, allowedTehsils, search]);

  return (
    <PageShell>
      <PageHeader
        icon={<Cpu />}
        title="Sites Technical Info"
        description="Engineering specifications for all registered water and solar sites"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing || loadingWater || loadingSolar}
          >
            <RefreshCcw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      <Card className="gap-0 overflow-visible py-0 shadow-sm ring-border/40">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Filters</p>
            <Badge
              variant="secondary"
              className="max-w-[min(100%,320px)] truncate font-normal"
            >
              <MapPin className="mr-1 size-3 shrink-0" />
              <span className="truncate">{activeScopeLabel}</span>
            </Badge>
          </div>

          <FieldGroup className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field className="min-w-0 gap-1">
              <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Tehsil
              </FieldLabel>
              <Select
                value={locationFilters.tehsil}
                onValueChange={(v) =>
                  updateLocationFilter({ tehsil: v ?? locationFilters.tehsil })
                }
              >
                <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
                  <SelectValue placeholder="Tehsil" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {tehsilOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {tehsilFilterLabel(t, allowedTehsils.length)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <SearchableOptionField
              label="Village"
              value={locationFilters.village}
              options={villageOptions}
              allValue={ALL_VILLAGES}
              placeholder="Village"
              onChange={(village) => updateLocationFilter({ village })}
            />

            <SearchableOptionField
              label="Settlement"
              value={locationFilters.settlement}
              options={settlementOptions}
              allValue={ALL_SETTLEMENTS}
              placeholder="Settlement"
              onChange={(settlement) => updateLocationFilter({ settlement })}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by site ID, village, tehsil, pump model, serial number…"
          className="h-10 pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "water" | "solar")}>
        <TabsList>
          <TabsTrigger value="water" className="gap-2">
            <Droplets className="size-3.5" />
            Water sites
            {!loadingWater && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {filteredWater.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="solar" className="gap-2">
            <Sun className="size-3.5" />
            Solar sites
            {!loadingSolar && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {filteredSolar.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="water" className="mt-4">
          <WaterList
            rows={filteredWater}
            loading={loadingWater}
            onView={(id) => navigate(hqRoutes.waterSystem(id))}
          />
        </TabsContent>

        <TabsContent value="solar" className="mt-4">
          <SolarList
            rows={filteredSolar}
            loading={loadingSolar}
            onView={(id) => navigate(hqRoutes.solarSite(id))}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
