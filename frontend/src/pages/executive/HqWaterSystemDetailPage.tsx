import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Droplets,
  Loader2,
  RotateCcw,
  Star,
} from "lucide-react";

import { SearchableOptionField } from "@/components/common/SearchableOptionField";
import { CopyableId } from "@/components/common/CopyableId";
import { kv, PageHeader, PageShell, StatCard } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { hqRoutes } from "@/constants/routes";
import { HQ_NEW_TAB_LINK_PROPS, resolveHqReturnPath, withHqReturnPath } from "@/lib/hqDetailLink";
import { useClientPagination } from "@/hooks/useClientPagination";
import { getApiErrorMessage } from "@/lib/api-error";
import { getWaterSystem } from "@/services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "@/types/api";
import {
  formatPakistanDateTime,
  formatPakistanIsoDateLabel,
} from "@/utils/pakistanTime";
import type { WaterSystemDetailRow } from "./executiveAnalysisTypes";
import type { HqSubmissionRow, HqSubmissionScope } from "./hqSubmissionTypes";
import { submissionLogDateKey } from "./hqSubmissionTypes";
import {
  filterApprovedSubmissions,
  useHqSubmissions,
} from "./useHqSubmissions";
import PaginatedListFooter from "./PaginatedListFooter";

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

function fmt2(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
}

function fmtMetric(n: number, digits = 2): string {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Design flow is stored as m³/h system-wide. */
const FLOW_RATE_UNIT = "m³/h";

/** Indicative volume = flow rate (m³/h) × operating hours. */
function estimatedPumpedM3(
  hours: unknown,
  flowRateM3h: number | null,
): number | null {
  const h = numOrNull(hours);
  if (h === null || flowRateM3h === null) return null;
  return h * flowRateM3h;
}

function formatWithUnit(value: unknown, unit: string): string {
  const n = numOrNull(value);
  if (n === null) return "—";
  return `${fmt2(n)} ${unit}`;
}

function sumFinite(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => {
    const n = Number(v);
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);
}

/** Compact mono id with copy — labels live in column headers only. */
function GridId({ value, label }: { value?: string | null | undefined; label: string }) {
  const text = value?.trim() ?? "";
  if (!text) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <CopyableId
      value={text}
      label={label}
      className="inline-flex max-w-[12rem] shrink-0 items-center gap-0.5 [&_button]:size-6 [&_span]:truncate [&_span]:font-mono [&_span]:text-[11px] [&_span]:font-normal sm:[&_span]:text-xs"
    />
  );
}

function submissionSortKey(row: HqSubmissionRow): string {
  return String(
    row.submitted_at ??
      row.reviewed_at ??
      row.system_info?.last_edited_at ??
      "",
  );
}

/** Newest submission first (user-facing tree children order). */
function compareBySubmittedDesc(a: HqSubmissionRow, b: HqSubmissionRow): number {
  return submissionSortKey(b).localeCompare(submissionSortKey(a));
}

function formatClock(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function formatPakistanTimeOnly(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Pump window when available, otherwise submitted time. */
function formatPumpWindow(row: HqSubmissionRow): string {
  const start = formatClock(row.system_info?.pump_start_time);
  const end = formatClock(row.system_info?.pump_end_time);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return formatPakistanTimeOnly(row.submitted_at ?? null) ?? "—";
}

type DayBranch = {
  day: string;
  logs: HqSubmissionRow[];
  count: number;
  pumped: number;
  runtime: number;
  estimated: number | null;
};

function fullDayLabel(iso: string): string {
  return formatPakistanIsoDateLabel(iso, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type LocationState = {
  from?: string;
  metrics?: WaterSystemDetailRow;
  year?: number;
  month?: number;
};

export default function HqWaterSystemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const systemId = String(id ?? "").trim();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = (location.state as LocationState | null) ?? {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [system, setSystem] = useState<WaterSystemRow | null>(null);
  /** YYYY-MM-DD filter for exploring a single log day */
  const [dayFilter, setDayFilter] = useState("");
  /** Secondary system registry details — collapsed by default */
  const [systemDetailsOpen, setSystemDetailsOpen] = useState(false);
  const { submissions, loading: logsLoading, error: logsError, reload } =
    useHqSubmissions();

  const backTo = resolveHqReturnPath(state, searchParams, hqRoutes.waterAnalysis);
  const metrics = state.metrics;
  const bulkMeter = Boolean(system?.bulk_meter_installed);
  const flowRateM3h = numOrNull(system?.pump_flow_rate);

  const periodLogs = useMemo(() => {
    const filterOpts: { waterSystemId: string; scope?: HqSubmissionScope } = {
      waterSystemId: systemId,
    };
    if (state.year != null || state.month != null) {
      filterOpts.scope = {
        ...(state.year != null ? { year: state.year } : {}),
        ...(state.month != null ? { month: state.month } : {}),
      };
    }
    const rows = filterApprovedSubmissions(submissions, filterOpts);
    return rows;
  }, [submissions, systemId, state.year, state.month]);

  const dayStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; pumped: number; runtime: number }
    >();
    for (const row of periodLogs) {
      const key = submissionLogDateKey(row);
      if (!key) continue;
      const prev = map.get(key) ?? { count: 0, pumped: 0, runtime: 0 };
      const pumped = Number(row.system_info?.total_water_pumped);
      const runtime = Number(row.system_info?.pump_operating_hours);
      map.set(key, {
        count: prev.count + 1,
        pumped: prev.pumped + (Number.isFinite(pumped) ? pumped : 0),
        runtime: prev.runtime + (Number.isFinite(runtime) ? runtime : 0),
      });
    }
    return map;
  }, [periodLogs]);

  const availableLogDays = useMemo(
    () => Array.from(dayStats.keys()).sort((a, b) => b.localeCompare(a)),
    [dayStats],
  );

  const latestLogDay = availableLogDays[0] ?? "";

  const dayPickerLabel = (iso: string) => {
    const count = dayStats.get(iso)?.count ?? 0;
    return `${formatPakistanIsoDateLabel(iso, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })} · ${count} log${count === 1 ? "" : "s"}`;
  };

  const acceptedLogs = useMemo(() => {
    if (!dayFilter) return periodLogs;
    return filterApprovedSubmissions(periodLogs, {
      waterSystemId: systemId,
      scope: { logDate: dayFilter },
    });
  }, [periodLogs, dayFilter, systemId]);

  /** Date branches: parent day + child logs (newest submission first). */
  const dayBranches = useMemo((): DayBranch[] => {
    const byDay = new Map<string, HqSubmissionRow[]>();
    for (const row of acceptedLogs) {
      const day = submissionLogDateKey(row);
      if (!day) continue;
      const list = byDay.get(day);
      if (list) list.push(row);
      else byDay.set(day, [row]);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, logs]) => {
        const sorted = [...logs].sort(compareBySubmittedDesc);
        const runtime = sumFinite(
          sorted.map((r) => r.system_info?.pump_operating_hours ?? null),
        );
        const pumped = sumFinite(
          sorted.map((r) => r.system_info?.total_water_pumped ?? null),
        );
        return {
          day,
          logs: sorted,
          count: sorted.length,
          pumped,
          runtime,
          estimated: estimatedPumpedM3(runtime, flowRateM3h),
        };
      });
  }, [acceptedLogs, flowRateM3h]);

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (dayFilter) {
      setExpandedDays(new Set([dayFilter]));
      return;
    }
    // When showing all days, keep the newest day open by default.
    setExpandedDays(new Set(latestLogDay ? [latestLogDay] : []));
  }, [dayFilter, latestLogDay]);

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const daysPagination = useClientPagination(dayBranches, 8);

  useEffect(() => {
    daysPagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayBranches.length, state.year, state.month, dayFilter]);

  const loadSystem = async () => {
    if (!systemId) {
      setError("Missing water system id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = (await getWaterSystem(systemId)) as WaterSystemRow;
      setSystem(res);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load water system"));
      setSystem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId]);

  const title = system?.unique_identifier
    ? kv(system.unique_identifier)
    : metrics?.unique_identifier
      ? kv(metrics.unique_identifier)
      : "Water system";

  return (
    <PageShell>
      <PageHeader
        icon={<Droplets className="text-blue-600" />}
        title={loading ? "Water system" : title}
        description={
          system
            ? [system.tehsil, system.village, system.settlement].filter(Boolean).join(" · ")
            : "Facility profile and operator logging history"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>
              <ArrowLeft className="size-4" />
              Back to previous page
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadSystem();
                void reload();
              }}
              disabled={loading || logsLoading}
            >
              {loading || logsLoading ? (
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
      ) : system ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{kv(system.unique_identifier)}</Badge>
            <Badge variant="outline">{kv(system.tehsil)}</Badge>
            <Badge variant="outline">{kv(system.village)}</Badge>
            {system.settlement ? (
              <Badge variant="outline">{kv(system.settlement)}</Badge>
            ) : null}
          </div>

          {metrics ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total pumped"
                value={`${Number(metrics.total_water_pumped_m3 ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} m³`}
                accent="blue"
              />
              <StatCard
                label="Pump runtime"
                value={`${Number(metrics.total_pump_hours_h ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`}
                accent="slate"
              />
              <StatCard
                label="Days logged"
                value={metrics.days_logged}
                accent="blue"
              />
              <StatCard
                label="Latest meter"
                value={`${Number(metrics.latest_meter_reading_end_m3 ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} m³`}
                accent="slate"
              />
            </div>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-muted/10">
            <button
              type="button"
              onClick={() => setSystemDetailsOpen((open) => !open)}
              aria-expanded={systemDetailsOpen}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
            >
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    System details
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Optional registry info
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {system.bulk_meter_installed ? "Bulk meter" : "OHR"}
                  {" · "}
                  Flow {formatWithUnit(system.pump_flow_rate, FLOW_RATE_UNIT)}
                  {system.bulk_meter_installed && system.meter_serial_number
                    ? ` · Meter ${kv(system.meter_serial_number)}`
                    : null}
                  {" · "}
                  Updated {formatPakistanDateTime(system.updated_at)}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  systemDetailsOpen && "rotate-180",
                )}
              />
            </button>

            {systemDetailsOpen ? (
              <div className="border-t border-border/60 px-3 py-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                  <MetaItem
                    label="System ID"
                    mono
                    value={
                      <CopyableId
                        value={system.id}
                        label="System ID"
                        className="inline-flex max-w-full items-center gap-0.5 [&_span]:truncate [&_span]:font-mono [&_span]:text-xs"
                      />
                    }
                  />
                  <MetaItem
                    label="UID"
                    value={kv(system.unique_identifier)}
                  />
                  <MetaItem
                    label="Created"
                    value={formatPakistanDateTime(system.created_at)}
                  />
                  <MetaItem
                    label="Updated"
                    value={formatPakistanDateTime(system.updated_at)}
                  />
                  <MetaItem
                    label="Bulk meter"
                    value={system.bulk_meter_installed ? "Yes" : "No"}
                  />
                  <MetaItem label="Pump model" value={kv(system.pump_model)} />
                  <MetaItem
                    label="Pump serial"
                    value={kv(system.pump_serial_number)}
                  />
                  <MetaItem
                    label={`Flow rate (${FLOW_RATE_UNIT})`}
                    value={kv(system.pump_flow_rate)}
                  />
                  {system.bulk_meter_installed ? (
                    <>
                      <MetaItem
                        label="Meter model"
                        value={kv(system.meter_model)}
                      />
                      <MetaItem
                        label="Meter serial"
                        value={kv(system.meter_serial_number)}
                      />
                      <MetaItem
                        label="Accuracy class"
                        value={kv(system.meter_accuracy_class)}
                      />
                      <MetaItem
                        label="Installation"
                        value={kv(system.installation_date)}
                      />
                    </>
                  ) : (
                    <>
                      <MetaItem
                        label="Tank capacity"
                        value={kv(system.ohr_tank_capacity)}
                      />
                      <MetaItem
                        label="Fill required"
                        value={kv(system.ohr_fill_required)}
                      />
                    </>
                  )}
                </dl>
              </div>
            ) : null}
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4 text-muted-foreground" />
                Operator daily logs
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Tree view: each day is a branch. Expand to see submissions for that
                day, ordered newest submission first.
              </p>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
              {!logsLoading && !logsError && periodLogs.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-end sm:gap-3">
                  <div className="min-w-0 flex-1 sm:max-w-md">
                    <SearchableOptionField
                      label="Jump to day"
                      value={dayFilter}
                      options={availableLogDays}
                      allValue=""
                      allLabel={`All days · ${periodLogs.length} logs · ${availableLogDays.length} calendar days`}
                      placeholder="Search day (Jun, 23, 2026-06…)…"
                      maxResults={80}
                      onChange={setDayFilter}
                      optionLabel={dayPickerLabel}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:ms-auto sm:pb-px">
                    {latestLogDay ? (
                      <Button
                        type="button"
                        variant={
                          dayFilter === latestLogDay ? "secondary" : "outline"
                        }
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setDayFilter(latestLogDay)}
                      >
                        Latest day
                      </Button>
                    ) : null}
                    {dayFilter ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => setDayFilter("")}
                      >
                        Show all days
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {logsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading logs…
                </div>
              ) : logsError ? (
                <p className="text-sm text-destructive">{logsError}</p>
              ) : periodLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No accepted operator logs for this system in the selected period.
                </p>
              ) : dayBranches.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-sm font-medium">No logs on this day</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick another day, or show all days.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8"
                    onClick={() => setDayFilter("")}
                  >
                    Show all days
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {acceptedLogs.length}
                      </span>{" "}
                      log{acceptedLogs.length === 1 ? "" : "s"} ·{" "}
                      <span className="font-medium text-foreground">
                        {dayBranches.length}
                      </span>{" "}
                      day{dayBranches.length === 1 ? "" : "s"}
                      {!bulkMeter ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · Est. pumped = flow × runtime
                        </span>
                      ) : null}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          setExpandedDays(
                            new Set(daysPagination.pageItems.map((b) => b.day)),
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
                        onClick={() => setExpandedDays(new Set())}
                      >
                        Collapse
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto overscroll-x-contain">
                    <table className="w-full min-w-[720px] caption-bottom text-sm">
                      <thead className="bg-muted/70">
                        <tr className="border-b">
                          <th className="h-9 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Day / log
                          </th>
                          <th className="h-9 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Submitted
                          </th>
                          <th className="h-9 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Operator
                          </th>
                          {bulkMeter ? (
                            <>
                              <th className="h-9 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Pumped (m³)
                              </th>
                              <th className="h-9 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Runtime (h)
                              </th>
                            </>
                          ) : (
                            <>
                              <th className="h-9 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Runtime (h)
                              </th>
                              <th className="h-9 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Est. pumped (m³)
                              </th>
                            </>
                          )}
                          <th className="h-9 w-24 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {" "}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {daysPagination.pageItems.map((branch) => {
                          const open = expandedDays.has(branch.day);
                          const latestId = branch.logs[0]?.id ?? "";
                          return (
                            <DayTreeBranch
                              key={branch.day}
                              branch={branch}
                              open={open}
                              bulkMeter={bulkMeter}
                              flowRateM3h={flowRateM3h}
                              latestId={latestId}
                              systemId={systemId}
                              fromPath={location.pathname + location.search}
                              onToggle={() => toggleDay(branch.day)}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <PaginatedListFooter
                    pageIndex={daysPagination.pageIndex}
                    pageSize={daysPagination.pageSize}
                    pageCount={daysPagination.pageCount}
                    total={daysPagination.total}
                    onPageChange={daysPagination.goToPage}
                    onPageSizeChange={daysPagination.setPageSize}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            System not found.
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

function DayTreeBranch({
  branch,
  open,
  bulkMeter,
  flowRateM3h,
  latestId,
  systemId,
  fromPath,
  onToggle,
}: {
  branch: DayBranch;
  open: boolean;
  bulkMeter: boolean;
  flowRateM3h: number | null;
  latestId: string;
  systemId: string;
  fromPath: string;
  onToggle: () => void;
}) {
  const volumeLabel = bulkMeter
    ? `${fmtMetric(branch.pumped)} m³`
    : branch.estimated != null
      ? `${fmtMetric(branch.estimated)} m³`
      : "—";

  return (
    <>
      <tr className="border-b border-border/80 bg-muted/30 hover:bg-muted/45">
        <td className="px-2 py-2.5" colSpan={6}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-2 text-left"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded border border-border/80 bg-background text-muted-foreground transition-colors duration-200",
                open && "border-primary/40 text-primary",
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform duration-300 ease-out",
                  open && "rotate-90",
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-foreground">
                  {fullDayLabel(branch.day)}
                </span>
                <span className="rounded bg-background px-1.5 py-px text-[11px] font-medium tabular-nums text-muted-foreground ring-1 ring-border/70">
                  {branch.count} log{branch.count === 1 ? "" : "s"}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Day total · {bulkMeter ? "Pumped" : "Est. pumped"}{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {volumeLabel}
                </span>
                {" · "}
                Runtime{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {fmtMetric(branch.runtime)} h
                </span>
                {flowRateM3h != null && !bulkMeter ? (
                  <>
                    {" · "}
                    Flow{" "}
                    <span className="tabular-nums">
                      {formatWithUnit(flowRateM3h, FLOW_RATE_UNIT)}
                    </span>
                  </>
                ) : null}
              </span>
            </span>
          </button>
        </td>
      </tr>

      <tr className="border-0">
        <td colSpan={6} className="p-0">
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={cn(
                  "origin-top border-b border-border/80 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                  open
                    ? "translate-y-0 opacity-100"
                    : "-translate-y-1 opacity-0",
                )}
              >
                <table className="w-full caption-bottom text-sm">
                  <tbody>
                    {branch.logs.map((row, idx) => {
                      const runtimeH = numOrNull(
                        row.system_info?.pump_operating_hours,
                      );
                      const pumpedMeter = numOrNull(
                        row.system_info?.total_water_pumped,
                      );
                      const estPumped = estimatedPumpedM3(
                        runtimeH,
                        flowRateM3h,
                      );
                      const isLatest = row.id === latestId;
                      const isLast = idx === branch.logs.length - 1;

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b border-border/50 bg-background",
                            isLatest && "bg-sky-50/50 dark:bg-sky-950/20",
                            isLast && "border-b-0",
                          )}
                          style={{
                            transitionDelay: open
                              ? `${Math.min(idx, 8) * 28}ms`
                              : "0ms",
                          }}
                        >
                          <td className="relative w-[40%] px-3 py-2 pl-10">
                            <span
                              aria-hidden
                              className="absolute bottom-0 left-[1.35rem] top-0 w-px bg-border"
                            />
                            <span
                              aria-hidden
                              className="absolute left-[1.35rem] top-1/2 h-px w-3 bg-border"
                            />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
                                  <Clock className="size-3 text-muted-foreground" />
                                  {formatPumpWindow(row)}
                                </span>
                                {isLatest ? (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 gap-0.5 px-1.5 text-[10px]"
                                  >
                                    <Star className="size-2.5" />
                                    Latest
                                  </Badge>
                                ) : null}
                              </div>
                              <GridId value={row.id} label="Submission ID" />
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
                            {formatPakistanDateTime(row.submitted_at)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-sm">
                            {row.operator_name ?? "—"}
                          </td>
                          {bulkMeter ? (
                            <>
                              <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium tabular-nums">
                                {fmt2(pumpedMeter)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                                {fmt2(runtimeH)}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">
                                {fmt2(runtimeH)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium tabular-nums">
                                {fmt2(estPumped)}
                              </td>
                            </>
                          )}
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <Link
                              to={withHqReturnPath(
                                hqRoutes.waterSubmissionDetails(row.id),
                                fromPath,
                              )}
                              state={{ from: fromPath, systemId }}
                              {...HQ_NEW_TAB_LINK_PROPS}
                              className={cn(
                                buttonVariants({
                                  size: "sm",
                                  variant: "secondary",
                                }),
                                "h-7 px-2 text-xs",
                              )}
                            >
                              Open
                              <ChevronRight className="size-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
