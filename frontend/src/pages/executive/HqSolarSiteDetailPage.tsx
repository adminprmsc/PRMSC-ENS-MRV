import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Gauge,
  Loader2,
  RotateCcw,
  Sun,
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
import {
  getSolarSupplyData,
  getSolarSystem,
} from "@/services/tehsilManagerOperatorService";
import type { SolarMonthlySupplyListItem, SolarSystemRow } from "@/types/api";
import { formatPakistanDateTime } from "@/utils/pakistanTime";
import type { SolarSystemDetailRow } from "./executiveAnalysisTypes";
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

function fmtNum(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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
  const state = (location.state as LocationState | null) ?? {};
  const displayYear = state.year ?? new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [site, setSite] = useState<SolarSystemRow | null>(null);
  const [records, setRecords] = useState<SolarMonthlySupplyListItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");

  const backTo = state.from?.trim() || hqRoutes.solarAnalysis;
  const metrics = state.metrics;

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
          tehsil: res.tehsil,
          village: res.village,
          settlement: res.settlement ?? "",
          year: String(displayYear),
        });
        setRecords(Array.isArray(data) ? (data as SolarMonthlySupplyListItem[]) : []);
      } catch (err) {
        setRecordsError(getApiErrorMessage(err, "Could not load monthly records"));
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
  }, [systemId, displayYear]);

  const title = site?.unique_identifier
    ? kv(site.unique_identifier)
    : metrics?.unique_identifier
      ? kv(metrics.unique_identifier)
      : "Solar site";

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => a.month - b.month),
    [records],
  );

  const recordsPagination = useClientPagination(sortedRecords, 10);

  useEffect(() => {
    recordsPagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRecords.length, displayYear]);

  return (
    <PageShell>
      <PageHeader
        icon={<Sun className="text-amber-600" />}
        title={loading ? "Solar site" : title}
        description={
          site
            ? [site.tehsil, site.village, site.settlement].filter(Boolean).join(" · ")
            : "Site profile and monthly energy records"
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
              <StatCard label="Months logged" value={metrics.months_logged} accent="amber" />
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
                <DetailRow label="System ID" value={site.id} />
                <DetailRow label="UID" value={kv(site.unique_identifier)} />
                <DetailRow label="Created" value={formatPakistanDateTime(site.created_at)} />
                <DetailRow label="Updated" value={formatPakistanDateTime(site.updated_at)} />
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
                <DetailRow label="Location" value={kv(site.installation_location)} />
                <DetailRow label="DISCO" value={kv(site.disco_info)} />
                <DetailRow label="Bill ref" value={kv(site.bill_reference_number)} />
                <DetailRow label="Panel (kW)" value={kv(site.solar_panel_capacity)} />
                <DetailRow label="Inverter" value={kv(site.inverter_capacity)} />
                <DetailRow label="Meter serial" value={kv(site.meter_serial_number)} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
              <CardTitle className="text-base">Monthly energy records ({displayYear})</CardTitle>
              <p className="text-xs text-muted-foreground">
                Logged export, import, and net values. Open any month for full readings and bill attachment.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {recordsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading records…
                </div>
              ) : recordsError ? (
                <p className="text-sm text-destructive">{recordsError}</p>
              ) : sortedRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No monthly records for {displayYear} at this site.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>Export (kWh)</TableHead>
                          <TableHead>Import (kWh)</TableHead>
                          <TableHead>Net (kWh)</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recordsPagination.pageItems.map((row) => {
                          const exportKwh =
                            row.export_total ??
                            Number(row.export_off_peak ?? 0) + Number(row.export_peak ?? 0);
                          const importKwh =
                            row.import_total ??
                            Number(row.import_off_peak ?? 0) + Number(row.import_peak ?? 0);
                          const netKwh =
                            row.net_total ??
                            Number(row.net_off_peak ?? 0) + Number(row.net_peak ?? 0);
                          const monthName =
                            row.month >= 1 && row.month <= 12
                              ? MONTH_NAMES[row.month]
                              : `Month ${row.month}`;

                          return (
                            <TableRow key={row.id}>
                              <TableCell className="text-sm font-medium">{monthName}</TableCell>
                              <TableCell className="tabular-nums text-sm text-amber-700">
                                {fmtNum(exportKwh)}
                              </TableCell>
                              <TableCell className="tabular-nums text-sm text-red-700">
                                {fmtNum(importKwh)}
                              </TableCell>
                              <TableCell className="tabular-nums text-sm font-medium">
                                {fmtNum(netKwh)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatPakistanDateTime(row.updated_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Link
                                  to={hqRoutes.solarRecordDetails(row.id)}
                                  state={{ from: location.pathname }}
                                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
                                >
                                  Record detail
                                  <ChevronRight className="size-3.5" />
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <PaginatedListFooter
                    pageIndex={recordsPagination.pageIndex}
                    pageSize={recordsPagination.pageSize}
                    pageCount={recordsPagination.pageCount}
                    total={recordsPagination.total}
                    onPageChange={recordsPagination.goToPage}
                    onPageSizeChange={recordsPagination.setPageSize}
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
