import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sun,
} from "lucide-react";

import { CopyableId } from "@/components/common/CopyableId";
import { kv, PageHeader, PageShell, StatCard } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { SolarSiteTypeBadge } from "@/components/SolarSiteTypeBadge";
import { cn } from "@/lib/utils";
import { hqRoutes } from "@/constants/routes";
import { HQ_NEW_TAB_LINK_PROPS, resolveHqReturnPath, withHqReturnPath } from "@/lib/hqDetailLink";
import { useClientPagination } from "@/hooks/useClientPagination";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getSolarSupplyData,
  getSolarSystem,
} from "@/services/tehsilManagerOperatorService";
import type { SolarMonthlySupplyListItem, SolarSystemRow } from "@/types/api";
import { formatPakistanDateTime } from "@/utils/pakistanTime";
import type { SolarSystemDetailRow } from "./executiveAnalysisTypes";
import { EXECUTIVE_MONTHS, EXECUTIVE_YEARS } from "./executiveAnalysisTypes";
import PaginatedListFooter from "./PaginatedListFooter";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function MetaItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function fmtNum(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function recordTotals(row: SolarMonthlySupplyListItem) {
  const exportKwh =
    row.export_total ??
    Number(row.export_off_peak ?? 0) + Number(row.export_peak ?? 0);
  const importKwh =
    row.import_total ??
    Number(row.import_off_peak ?? 0) + Number(row.import_peak ?? 0);
  const netKwh =
    row.net_total ?? Number(row.net_off_peak ?? 0) + Number(row.net_peak ?? 0);
  return { exportKwh, importKwh, netKwh };
}

function monthLabel(month: number): string {
  return month >= 1 && month <= 12
    ? (MONTH_NAMES[month] ?? `Month ${month}`)
    : `Month ${month}`;
}

function monthSortKey(row: SolarMonthlySupplyListItem): string {
  return `${row.year}-${String(row.month).padStart(2, "0")}`;
}

type MonthBranch = {
  key: string;
  year: number;
  month: number;
  records: SolarMonthlySupplyListItem[];
  exportKwh: number;
  importKwh: number;
  netKwh: number;
};

type LocationState = {
  from?: string;
  metrics?: SolarSystemDetailRow;
  year?: number;
};

export default function HqSolarSiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const systemId = String(id ?? "").trim();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = (location.state as LocationState | null) ?? {};

  const initialYear = String(
    searchParams.get("year")?.trim() ||
      state.year ||
      new Date().getFullYear(),
  );
  const initialMonth =
    searchParams.get("month")?.trim() || "All Months";

  const [filterYear, setFilterYear] = useState(initialYear);
  const [filterMonth, setFilterMonth] = useState(initialMonth);
  const [activeYear, setActiveYear] = useState(initialYear);
  const [activeMonth, setActiveMonth] = useState(initialMonth);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [site, setSite] = useState<SolarSystemRow | null>(null);
  const [records, setRecords] = useState<SolarMonthlySupplyListItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [siteDetailsOpen, setSiteDetailsOpen] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const backTo = resolveHqReturnPath(state, searchParams, hqRoutes.solarAnalysis);
  const metrics = state.metrics;
  const activeYearNum = Number(activeYear);

  const applyPeriodFilters = () => {
    setActiveYear(filterYear);
    setActiveMonth(filterMonth);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("year", filterYear);
      if (filterMonth === "All Months") next.delete("month");
      else next.set("month", filterMonth);
      return next;
    });
  };

  const loadAll = async () => {
    if (!systemId) {
      setError("Missing solar site id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setRecordsLoading(true);
    setRecordsError("");
    try {
      const res = (await getSolarSystem(systemId)) as SolarSystemRow;
      setSite(res);
      try {
        const data = await getSolarSupplyData({
          solar_system_id: systemId,
          tehsil: res.tehsil,
          village: res.village,
          settlement: res.settlement ?? "",
          year: activeYear,
        });
        setRecords(
          Array.isArray(data) ? (data as SolarMonthlySupplyListItem[]) : [],
        );
      } catch (err) {
        setRecordsError(
          getApiErrorMessage(err, "Could not load monthly records"),
        );
        setRecords([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load solar site"));
      setSite(null);
    } finally {
      setLoading(false);
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId, activeYear]);

  const periodScopeLabel = useMemo(() => {
    const monthLabelText =
      activeMonth === "All Months"
        ? "All months"
        : (EXECUTIVE_MONTHS[Number(activeMonth) - 1] ?? activeMonth);
    return `${activeYear} · ${monthLabelText}`;
  }, [activeYear, activeMonth]);

  const title = site?.unique_identifier
    ? kv(site.unique_identifier)
    : metrics?.unique_identifier
      ? kv(metrics.unique_identifier)
      : "Solar site";

  const monthBranches = useMemo((): MonthBranch[] => {
    const byMonth = new Map<string, SolarMonthlySupplyListItem[]>();
    const monthNum =
      activeMonth === "All Months" ? null : Number(activeMonth);
    for (const row of records) {
      if (monthNum != null && row.month !== monthNum) continue;
      const key = monthSortKey(row);
      const list = byMonth.get(key);
      if (list) list.push(row);
      else byMonth.set(key, [row]);
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) =>
          String(b.updated_at ?? b.created_at ?? "").localeCompare(
            String(a.updated_at ?? a.created_at ?? ""),
          ),
        );
        let exportKwh = 0;
        let importKwh = 0;
        let netKwh = 0;
        for (const r of sorted) {
          const t = recordTotals(r);
          exportKwh += Number(t.exportKwh) || 0;
          importKwh += Number(t.importKwh) || 0;
          netKwh += Number(t.netKwh) || 0;
        }
        const first = sorted[0];
        return {
          key,
          year: first?.year ?? activeYearNum,
          month: first?.month ?? 0,
          records: sorted,
          exportKwh,
          importKwh,
          netKwh,
        };
      });
  }, [records, activeMonth, activeYearNum]);

  const latestMonthKey = monthBranches[0]?.key ?? "";

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const monthsPagination = useClientPagination(monthBranches, 8);

  useEffect(() => {
    if (activeMonth !== "All Months") {
      const key = `${activeYear}-${String(activeMonth).padStart(2, "0")}`;
      setExpandedMonths(new Set([key]));
      return;
    }
    setExpandedMonths(new Set(latestMonthKey ? [latestMonthKey] : []));
  }, [activeMonth, activeYear, latestMonthKey]);

  useEffect(() => {
    monthsPagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthBranches.length, activeYear, activeMonth]);

  return (
    <PageShell>
      <PageHeader
        icon={<Sun className="text-amber-600" />}
        title={loading ? "Solar site" : title}
        description={
          site
            ? [site.tehsil, site.village, site.settlement]
                .filter(Boolean)
                .join(" · ")
            : "Site profile and monthly energy records"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(backTo)}
            >
              <ArrowLeft className="size-4" />
              Back to previous page
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadAll()}
              disabled={loading || recordsLoading}
            >
              {loading || recordsLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="space-y-3 pt-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : site ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{kv(site.unique_identifier)}</Badge>
            <SolarSiteTypeBadge value={site.site_type} />
            <Badge variant="outline">{kv(site.tehsil)}</Badge>
            <Badge variant="outline">{kv(site.village)}</Badge>
            {site.settlement ? (
              <Badge variant="outline">{kv(site.settlement)}</Badge>
            ) : null}
          </div>

          {metrics ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total export"
                value={`${Number(metrics.total_export_kwh ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`}
                accent="amber"
              />
              <StatCard
                label="Total import"
                value={`${Number(metrics.total_import_kwh ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`}
                accent="slate"
              />
              <StatCard
                label="Total net"
                value={`${Number(metrics.total_net_kwh ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`}
                accent="green"
              />
              <StatCard
                label="Months logged"
                value={metrics.months_logged}
                accent="amber"
              />
            </div>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-muted/10">
            <button
              type="button"
              onClick={() => setSiteDetailsOpen((o) => !o)}
              aria-expanded={siteDetailsOpen}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
            >
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    Site details
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Optional registry info
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {kv(site.installation_location)} · {kv(site.disco_info)} ·
                  Panel {kv(site.solar_panel_capacity)} kW · Updated{" "}
                  {formatPakistanDateTime(site.updated_at)}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
                  siteDetailsOpen && "rotate-180",
                )}
              />
            </button>

            {siteDetailsOpen ? (
              <div className="border-t border-border/60 px-3 py-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                  <MetaItem
                    label="System ID"
                    mono
                    value={
                      <CopyableId
                        value={site.id}
                        label="System ID"
                        className="inline-flex max-w-full items-center gap-0.5 [&_span]:truncate [&_span]:font-mono [&_span]:text-xs"
                      />
                    }
                  />
                  <MetaItem label="UID" value={kv(site.unique_identifier)} />
                  <MetaItem
                    label="Site type"
                    value={<SolarSiteTypeBadge value={site.site_type} />}
                  />
                  <MetaItem
                    label="Created"
                    value={formatPakistanDateTime(site.created_at)}
                  />
                  <MetaItem
                    label="Updated"
                    value={formatPakistanDateTime(site.updated_at)}
                  />
                  <MetaItem
                    label="Location"
                    value={kv(site.installation_location)}
                  />
                  <MetaItem label="DISCO" value={kv(site.disco_info)} />
                  <MetaItem
                    label="Bill ref"
                    value={kv(site.bill_reference_number)}
                  />
                  <MetaItem
                    label="Panel (kW)"
                    value={kv(site.solar_panel_capacity)}
                  />
                  <MetaItem
                    label="Inverter (kW)"
                    value={kv(site.inverter_capacity)}
                  />
                  <MetaItem
                    label="Meter serial"
                    value={kv(site.meter_serial_number)}
                  />
                </dl>
              </div>
            ) : null}
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4 text-muted-foreground" />
                Monthly energy records
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Filter by year and month, then expand a branch for peak / off-peak
                detail — newest update first within a month.
              </p>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Period filters</p>
                <Badge variant="secondary" className="font-normal">
                  {periodScopeLabel}
                </Badge>
              </div>

              <FieldGroup className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field className="min-w-0 gap-1">
                  <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Year
                  </FieldLabel>
                  <Select
                    value={filterYear}
                    onValueChange={(v) => setFilterYear(v ?? filterYear)}
                  >
                    <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXECUTIVE_YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="min-w-0 gap-1">
                  <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Month
                  </FieldLabel>
                  <Select
                    value={filterMonth}
                    onValueChange={(v) => setFilterMonth(v ?? filterMonth)}
                  >
                    <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Months">All months</SelectItem>
                      {EXECUTIVE_MONTHS.map((label, index) => (
                        <SelectItem key={label} value={String(index + 1)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="col-span-2 flex items-end sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full sm:w-auto sm:min-w-[6rem]"
                    onClick={applyPeriodFilters}
                    disabled={recordsLoading}
                  >
                    Apply
                  </Button>
                </div>
              </FieldGroup>

              {!recordsLoading && !recordsError && records.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {latestMonthKey ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const [, m] = latestMonthKey.split("-");
                        setFilterMonth(String(Number(m)));
                        setActiveMonth(String(Number(m)));
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set("year", activeYear);
                          next.set("month", String(Number(m)));
                          return next;
                        });
                      }}
                    >
                      Latest month
                    </Button>
                  ) : null}
                  {activeMonth !== "All Months" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => {
                        setFilterMonth("All Months");
                        setActiveMonth("All Months");
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.delete("month");
                          return next;
                        });
                      }}
                    >
                      Show all months
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {recordsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading records…
                </div>
              ) : recordsError ? (
                <p className="text-sm text-destructive">{recordsError}</p>
              ) : records.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No monthly records for {activeYear} at this site.
                </p>
              ) : monthBranches.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-sm font-medium">
                    No records for {periodScopeLabel}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8"
                    onClick={() => {
                      setFilterMonth("All Months");
                      setActiveMonth("All Months");
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.delete("month");
                        return next;
                      });
                    }}
                  >
                    Show all months
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {monthBranches.reduce(
                          (n, b) => n + b.records.length,
                          0,
                        )}
                      </span>{" "}
                      record
                      {monthBranches.reduce(
                        (n, b) => n + b.records.length,
                        0,
                      ) === 1
                        ? ""
                        : "s"}{" "}
                      ·{" "}
                      <span className="font-medium text-foreground">
                        {monthBranches.length}
                      </span>{" "}
                      month{monthBranches.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          setExpandedMonths(
                            new Set(
                              monthsPagination.pageItems.map((b) => b.key),
                            ),
                          )
                        }
                      >
                        Expand page
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setExpandedMonths(new Set())}
                      >
                        Collapse
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto overscroll-x-contain">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="sr-only">
                        <tr>
                          <th>Month energy records</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthsPagination.pageItems.map((branch) => (
                          <MonthTreeBranch
                            key={branch.key}
                            branch={branch}
                            open={expandedMonths.has(branch.key)}
                            fromPath={location.pathname + location.search}
                            onToggle={() => toggleMonth(branch.key)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <PaginatedListFooter
                    pageIndex={monthsPagination.pageIndex}
                    pageSize={monthsPagination.pageSize}
                    pageCount={monthsPagination.pageCount}
                    total={monthsPagination.total}
                    onPageChange={monthsPagination.goToPage}
                    onPageSizeChange={monthsPagination.setPageSize}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Site not found.
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

function MetricChip({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-[4.5rem] rounded-md border border-border/70 bg-background/80 px-2 py-1 text-right">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums leading-tight",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MonthTreeBranch({
  branch,
  open,
  fromPath,
  onToggle,
}: {
  branch: MonthBranch;
  open: boolean;
  fromPath: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-border/80 bg-muted/25 hover:bg-muted/40">
        <td className="p-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-3 px-3 py-3 text-left"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors duration-200",
                open &&
                  "border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform duration-300 ease-out",
                  open && "rotate-90",
                )}
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  {monthLabel(branch.month)} {branch.year}
                </span>
                <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground ring-1 ring-border/70">
                  {branch.records.length} record
                  {branch.records.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Click to {open ? "hide" : "view"} peak / off-peak breakdown
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <MetricChip
                label="Export"
                value={fmtNum(branch.exportKwh)}
                valueClassName="text-amber-700 dark:text-amber-400"
              />
              <MetricChip
                label="Import"
                value={fmtNum(branch.importKwh)}
                valueClassName="text-red-700 dark:text-red-400"
              />
              <MetricChip
                label="Net"
                value={fmtNum(branch.netKwh)}
                valueClassName="text-foreground"
              />
            </div>
          </button>
          {/* Mobile metrics under title when chips are hidden */}
          <div className="flex gap-1.5 border-t border-border/50 px-3 py-2 sm:hidden">
            <MetricChip
              label="Export"
              value={fmtNum(branch.exportKwh)}
              valueClassName="text-amber-700"
            />
            <MetricChip
              label="Import"
              value={fmtNum(branch.importKwh)}
              valueClassName="text-red-700"
            />
            <MetricChip label="Net" value={fmtNum(branch.netKwh)} />
          </div>
        </td>
      </tr>

      <tr className="border-0">
        <td className="p-0">
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={cn(
                  "space-y-2 border-b border-border/80 bg-muted/10 px-3 py-3 ps-12 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                  open
                    ? "translate-y-0 opacity-100"
                    : "-translate-y-1 opacity-0",
                )}
              >
                {branch.records.map((row, idx) => {
                  const { exportKwh, importKwh, netKwh } = recordTotals(row);
                  return (
                    <article
                      key={row.id}
                      className={cn(
                        "overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm",
                        idx > 0 && "mt-0",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/20 px-3 py-2.5">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              Monthly record
                            </span>
                            {idx === 0 && branch.records.length > 1 ? (
                              <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                Latest update
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>
                              Updated{" "}
                              <span className="font-medium text-foreground/80">
                                {formatPakistanDateTime(row.updated_at)}
                              </span>
                            </span>
                            {row.created_at ? (
                              <span>
                                Created{" "}
                                <span className="font-medium text-foreground/80">
                                  {formatPakistanDateTime(row.created_at)}
                                </span>
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Record ID
                            </span>
                            <CopyableId
                              value={row.id}
                              label="Record ID"
                              className="inline-flex max-w-[14rem] items-center gap-0.5 [&_button]:size-6 [&_span]:truncate [&_span]:font-mono [&_span]:text-[11px]"
                            />
                          </div>
                        </div>
                        <Link
                          to={withHqReturnPath(
                            hqRoutes.solarRecordDetails(row.id),
                            fromPath,
                          )}
                          state={{ from: fromPath }}
                          {...HQ_NEW_TAB_LINK_PROPS}
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "h-8 shrink-0",
                          )}
                        >
                          Open record
                          <ChevronRight className="size-3.5" />
                        </Link>
                      </div>

                      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Totals (kWh)
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-md border border-amber-200/80 bg-amber-50/70 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
                                Export
                              </p>
                              <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-800 dark:text-amber-200">
                                {fmtNum(exportKwh)}
                              </p>
                            </div>
                            <div className="rounded-md border border-red-200/80 bg-red-50/70 px-2.5 py-2 dark:border-red-900/50 dark:bg-red-950/30">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-red-800/80 dark:text-red-200/80">
                                Import
                              </p>
                              <p className="mt-0.5 text-lg font-semibold tabular-nums text-red-800 dark:text-red-200">
                                {fmtNum(importKwh)}
                              </p>
                            </div>
                            <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Net
                              </p>
                              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                                {fmtNum(netKwh)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Time-of-use split
                          </p>
                          <div className="overflow-hidden rounded-md border border-border/70">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/70 bg-muted/40">
                                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Band
                                  </th>
                                  <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Export
                                  </th>
                                  <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Import
                                  </th>
                                  <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Net
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-border/50">
                                  <td className="px-2.5 py-2 text-xs font-medium">
                                    Peak
                                  </td>
                                  <td className="px-2.5 py-2 text-right text-xs tabular-nums text-amber-700">
                                    {fmtNum(row.export_peak)}
                                  </td>
                                  <td className="px-2.5 py-2 text-right text-xs tabular-nums text-red-700">
                                    {fmtNum(row.import_peak)}
                                  </td>
                                  <td className="px-2.5 py-2 text-right text-xs font-medium tabular-nums">
                                    {fmtNum(row.net_peak)}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-2.5 py-2 text-xs font-medium">
                                    Off-peak
                                  </td>
                                  <td className="px-2.5 py-2 text-right text-xs tabular-nums text-amber-700">
                                    {fmtNum(row.export_off_peak)}
                                  </td>
                                  <td className="px-2.5 py-2 text-right text-xs tabular-nums text-red-700">
                                    {fmtNum(row.import_off_peak)}
                                  </td>
                                  <td className="px-2.5 py-2 text-right text-xs font-medium tabular-nums">
                                    {fmtNum(row.net_off_peak)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
