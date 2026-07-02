import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Droplets,
  Gauge,
  Loader2,
  RotateCcw,
} from "lucide-react";

import { kv, PageHeader, PageShell, StatCard } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hqRoutes } from "@/constants/routes";
import { useClientPagination } from "@/hooks/useClientPagination";
import { getApiErrorMessage } from "@/lib/api-error";
import { getWaterSystem } from "@/services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "@/types/api";
import { formatPakistanDateTime } from "@/utils/pakistanTime";
import type { WaterSystemDetailRow } from "./executiveAnalysisTypes";
import type { HqSubmissionScope } from "./hqSubmissionTypes";
import {
  filterApprovedSubmissions,
  useHqSubmissions,
} from "./useHqSubmissions";
import PaginatedListFooter from "./PaginatedListFooter";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function fmt2(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
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
  const state = (location.state as LocationState | null) ?? {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [system, setSystem] = useState<WaterSystemRow | null>(null);
  const { submissions, loading: logsLoading, error: logsError, reload } =
    useHqSubmissions();

  const backTo = state.from?.trim() || hqRoutes.waterAnalysis;
  const metrics = state.metrics;
  const acceptedLogs = useMemo(() => {
    const filterOpts: { waterSystemId: string; scope?: HqSubmissionScope } = {
      waterSystemId: systemId,
    };
    if (state.year != null || state.month != null) {
      filterOpts.scope = {
        ...(state.year != null ? { year: state.year } : {}),
        ...(state.month != null ? { month: state.month } : {}),
      };
    }
    return filterApprovedSubmissions(submissions, filterOpts);
  }, [submissions, systemId, state.year, state.month]);

  const logsPagination = useClientPagination(acceptedLogs, 10);

  useEffect(() => {
    logsPagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedLogs.length, state.year, state.month]);

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
              Back to analysis
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

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4 text-muted-foreground" />
                  Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                <DetailRow label="System ID" value={system.id} />
                <DetailRow label="UID" value={kv(system.unique_identifier)} />
                <DetailRow
                  label="Created"
                  value={formatPakistanDateTime(system.created_at)}
                />
                <DetailRow
                  label="Updated"
                  value={formatPakistanDateTime(system.updated_at)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="size-4 text-muted-foreground" />
                  Technical
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                <DetailRow
                  label="Bulk meter"
                  value={system.bulk_meter_installed ? "Yes" : "No"}
                />
                <DetailRow label="Pump model" value={kv(system.pump_model)} />
                <DetailRow label="Pump serial" value={kv(system.pump_serial_number)} />
                <DetailRow label="Flow rate" value={kv(system.pump_flow_rate)} />
                {system.bulk_meter_installed ? (
                  <>
                    <DetailRow label="Meter model" value={kv(system.meter_model)} />
                    <DetailRow label="Meter serial" value={kv(system.meter_serial_number)} />
                    <DetailRow label="Accuracy class" value={kv(system.meter_accuracy_class)} />
                    <DetailRow label="Installation" value={kv(system.installation_date)} />
                  </>
                ) : (
                  <>
                    <DetailRow label="Tank capacity" value={kv(system.ohr_tank_capacity)} />
                    <DetailRow label="Fill required" value={kv(system.ohr_fill_required)} />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
              <CardTitle className="text-base">Operator daily logs</CardTitle>
              <p className="text-xs text-muted-foreground">
                Accepted operator entries for this system. Open any row for full log detail
                {system.bulk_meter_installed
                  ? " (meter readings, pump hours, bulk meter image, and audit trail)."
                  : " (pump runtime, OHR system details, and audit trail)."}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {logsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading logs…
                </div>
              ) : logsError ? (
                <p className="text-sm text-destructive">{logsError}</p>
              ) : acceptedLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No accepted operator logs for this system in the selected period.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Operator</TableHead>
                          <TableHead>
                            {system.bulk_meter_installed ? "Pumped (m³)" : "Runtime (h)"}
                          </TableHead>
                          <TableHead>
                            {system.bulk_meter_installed ? "Runtime (h)" : "Flow rate"}
                          </TableHead>
                          <TableHead>Accepted</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logsPagination.pageItems.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-sm">
                              {row.system_info?.year && row.system_info?.month
                                ? `${row.system_info.month}/${row.system_info.year}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm">{row.operator_name ?? "—"}</TableCell>
                            <TableCell className="tabular-nums text-sm">
                              {system.bulk_meter_installed
                                ? fmt2(row.system_info?.total_water_pumped)
                                : fmt2(row.system_info?.pump_operating_hours)}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">
                              {system.bulk_meter_installed
                                ? fmt2(row.system_info?.pump_operating_hours)
                                : kv(system.pump_flow_rate)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatPakistanDateTime(row.reviewed_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                to={hqRoutes.waterSubmissionDetails(row.id)}
                                state={{ from: location.pathname, systemId }}
                                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
                              >
                                Log detail
                                <ChevronRight className="size-3.5" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <PaginatedListFooter
                    pageIndex={logsPagination.pageIndex}
                    pageSize={logsPagination.pageSize}
                    pageCount={logsPagination.pageCount}
                    total={logsPagination.total}
                    onPageChange={logsPagination.goToPage}
                    onPageSizeChange={logsPagination.setPageSize}
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
