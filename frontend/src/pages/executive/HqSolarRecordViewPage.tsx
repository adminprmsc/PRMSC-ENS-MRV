import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, RotateCcw, Sun } from "lucide-react";

import { PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hqRoutes } from "@/constants/routes";
import { getApiErrorMessage } from "@/lib/api-error";
import { getSolarSupplyRecord } from "@/services/tehsilManagerOperatorService";
import type { SolarMonthlySupplyRecordDetail } from "@/types/api";
import { getApiOrigin } from "@/utils/apiOrigin";
import { formatPakistanDateTime } from "@/utils/pakistanTime";

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

function fmtNum(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export default function HqSolarRecordViewPage() {
  const { id } = useParams<{ id: string }>();
  const recordId = String(id ?? "").trim();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [record, setRecord] = useState<SolarMonthlySupplyRecordDetail | null>(null);

  const backTo = useMemo(() => {
    const from = (location.state as { from?: string } | null)?.from;
    return typeof from === "string" && from.trim() ? from : hqRoutes.solarAnalysis;
  }, [location.state]);

  const load = async () => {
    if (!recordId) {
      setError("Missing record id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = (await getSolarSupplyRecord(recordId)) as SolarMonthlySupplyRecordDetail;
      setRecord(data ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load solar record"));
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const monthLabel =
    record && record.month >= 1 && record.month <= 12
      ? MONTH_NAMES[record.month]
      : record
        ? `Month ${record.month}`
        : "—";

  const billUrl = record?.electricity_bill_image_url?.trim()
    ? record.electricity_bill_image_url.startsWith("http")
      ? record.electricity_bill_image_url
      : `${getApiOrigin()}${record.electricity_bill_image_url}`
    : null;

  const tou = record?.tou_required === true;

  return (
    <PageShell>
      <PageHeader
        icon={<Sun className="text-amber-600" />}
        title="Solar monthly record"
        description={
          record
            ? `${record.tehsil} · ${record.village}${record.settlement ? ` · ${record.settlement}` : ""} · ${monthLabel} ${record.year}`
            : "Read-only monthly energy log"
        }
        badge={
          <Badge variant="outline" className="font-normal">
            Read-only review
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? (
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
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load record</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !record ? (
        <p className="text-sm text-muted-foreground">No record found.</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
              <CardTitle className="text-sm font-semibold">Site & period</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Tehsil" value={record.tehsil} />
                <DetailItem label="Village" value={record.village} />
                <DetailItem label="Settlement" value={record.settlement?.trim() || "—"} />
                <DetailItem label="Period" value={`${monthLabel} ${record.year}`} />
                <DetailItem label="TOU billing" value={tou ? "Yes" : "No"} />
                <DetailItem
                  label="Last updated"
                  value={formatPakistanDateTime(record.updated_at) || "—"}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
              <CardTitle className="text-sm font-semibold">Energy (kWh)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {tou ? (
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Export off-peak" value={fmtNum(record.export_off_peak)} />
                  <DetailItem label="Export peak" value={fmtNum(record.export_peak)} />
                  <DetailItem label="Import off-peak" value={fmtNum(record.import_off_peak)} />
                  <DetailItem label="Import peak" value={fmtNum(record.import_peak)} />
                  <DetailItem label="Net off-peak" value={fmtNum(record.net_off_peak)} />
                  <DetailItem label="Net peak" value={fmtNum(record.net_peak)} />
                </dl>
              ) : (
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <DetailItem label="Export total" value={fmtNum(record.export_total)} />
                  <DetailItem label="Import total" value={fmtNum(record.import_total)} />
                  <DetailItem label="Net total" value={fmtNum(record.net_total)} />
                </dl>
              )}
            </CardContent>
          </Card>

          {record.remarks?.trim() ? (
            <Card>
              <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
                <CardTitle className="text-sm font-semibold">Remarks</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-sm text-muted-foreground">
                {record.remarks}
              </CardContent>
            </Card>
          ) : null}

          {billUrl ? (
            <Card>
              <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
                <CardTitle className="text-sm font-semibold">Electricity bill</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Button variant="outline" size="sm" asChild>
                  <a href={billUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                    Open bill image
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
