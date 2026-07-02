import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Droplets,
  ExternalLink,
  FileCheck,
  Gauge,
  History,
  ImageIcon,
  PenLine,
  RotateCcw,
  SendToBack,
  ZoomIn,
  XCircle,
} from "lucide-react";

import PaginatedListFooter from "@/components/PaginatedListFooter";
import { useClientPagination } from "@/hooks/useClientPagination";
import {
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
  PageHeader,
  PageShell,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableRow,
  kv,
} from "../../../components/layout";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "../../../components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";
import { Textarea } from "../../../components/ui/textarea";
import { tehsilRoutes, hqRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { getApiErrorMessage } from "../../../lib/api-error";
import { cn } from "../../../lib/utils";
import { formatPakistanDateTime } from "../../../utils/pakistanTime";

type WaterSystemSummary = {
  id?: string | null;
  unique_identifier?: string | null;
  village?: string | null;
  tehsil?: string | null;
  settlement?: string | null;
  pump_model?: string | null;
  pump_serial_number?: string | null;
  start_of_operation?: string | null;
  depth_of_water_intake?: number | null;
  height_to_ohr?: number | null;
  pump_flow_rate?: number | null;
  bulk_meter_installed?: boolean | null;
  ohr_tank_capacity?: number | null;
  ohr_fill_required?: number | null;
  time_to_fill?: number | null;
  meter_model?: string | null;
  meter_serial_number?: string | null;
  meter_accuracy_class?: string | null;
  installation_date?: string | null;
};

type DetailResponse = {
  submission?: {
    id: string;
    submission_type: string;
    status: "submitted" | "accepted" | "rejected" | "reverted_back" | string;
    operator_name?: string;
    operator_email?: string;
    submitted_at?: string | null;
    reviewed_at?: string | null;
    approved_at?: string | null;
    reviewed_by_name?: string | null;
    approved_by_name?: string | null;
    remarks?: string | null;
  };
  record_data?: {
    year?: number | null;
    month?: number | null;
    last_edited_at?: string | null;
    pump_start_time?: string | null;
    pump_end_time?: string | null;
    pump_operating_hours?: number | null;
    meter_reading_start?: number | null;
    meter_reading_end?: number | null;
    previous_meter_reading_end?: number | null;
    total_water_pumped?: number | null;
    bulk_meter_image_url?: string | null;
    signed?: boolean | null;
    signature_svg_snapshot?: string | null;
    system?: WaterSystemSummary;
  };
  audit_trail?: Array<{
    action_type: string;
    performed_by: string;
    role: string;
    comment: string;
    created_at?: string | null;
  }>;
};

function fmtNum(v: unknown, decimals = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Alias for meter volumes and pumped water. */
const fmt2 = (v: unknown) => fmtNum(v, 2);

function fmtHours(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function meterDelta(
  end: number | null | undefined,
  start: number | null | undefined,
): string {
  if (end == null || start == null) return "—";
  const e = Number(end);
  const s = Number(start);
  if (!Number.isFinite(e) || !Number.isFinite(s)) return "—";
  return fmtNum(e - s, 2);
}

function systemUsesBulkMeter(
  system: WaterSystemSummary | null | undefined,
): boolean {
  return system?.bulk_meter_installed !== false;
}

function estimatedVolumeFromRuntime(
  hours: number | null | undefined,
  flowRateM3PerHour: number | null | undefined,
): number | null {
  if (hours == null || flowRateM3PerHour == null) return null;
  const h = Number(hours);
  const f = Number(flowRateM3PerHour);
  if (!Number.isFinite(h) || !Number.isFinite(f) || h <= 0 || f <= 0) return null;
  return h * f;
}

const MONTH_LABELS = [
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

function periodLabel(month?: number | null, year?: number | null) {
  if (!month || !year) return "—";
  const name = MONTH_LABELS[month - 1];
  return name ? `${name} ${year}` : `${month}/${year}`;
}

function auditActionLabel(action: string) {
  const normalized = action.trim().toLowerCase();
  if (normalized === "accept" || normalized === "accepted") return "Accepted";
  if (normalized === "reject" || normalized === "rejected") return "Rejected";
  if (normalized === "revert" || normalized === "reverted") return "Reverted";
  if (normalized === "submit" || normalized === "submitted") return "Submitted";
  return action;
}

function openSvgInNewTab(svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function statusBadge(status: string) {
  switch (status) {
    case "submitted":
      return (
        <Badge className="gap-1 border-amber-200 bg-amber-50 font-normal text-amber-900 hover:bg-amber-50">
          <FileCheck className="size-3" />
          Pending review
        </Badge>
      );
    case "accepted":
      return (
        <Badge className="gap-1 border-emerald-200 bg-emerald-50 font-normal text-emerald-800 hover:bg-emerald-50">
          <CheckCircle2 className="size-3" />
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1 font-normal">
          <XCircle className="size-3" />
          Rejected
        </Badge>
      );
    case "reverted_back":
      return (
        <Badge className="gap-1 border-slate-200 bg-slate-100 font-normal text-slate-700 hover:bg-slate-100">
          <SendToBack className="size-3" />
          Reverted
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function DetailItem({
  label,
  value,
  mono,
  numeric,
  highlight,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  /** Apply tabular mono styling for numbers and times. */
  numeric?: boolean;
  /** Emphasise key review fields. */
  highlight?: boolean;
  /** Short clarifier under the label. */
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-0.5 rounded-md px-2 py-1.5",
        highlight && "border border-primary/15 bg-primary/5",
        className,
      )}
    >
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      {hint ? (
        <p className="text-[10px] leading-snug text-muted-foreground/90">
          {hint}
        </p>
      ) : null}
      <dd
        className={cn(
          "text-sm font-medium text-foreground",
          (mono || numeric) && "font-mono tabular-nums tracking-tight",
          numeric && "text-base",
          highlight && "font-semibold text-primary",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function NumericValue({
  value,
  decimals = 2,
  unit,
  className,
}: {
  value: unknown;
  decimals?: number;
  unit?: string;
  className?: string;
}) {
  const text = fmtNum(value, decimals);
  if (text === "—") return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-mono tabular-nums tracking-tight", className)}>
      {text}
      {unit ? (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </span>
  );
}

function EvidencePanel({
  imageUrl,
  signatureSvg,
  signed,
  meterReadingEnd,
  bulkMeterInstalled = true,
}: {
  imageUrl?: string | null | undefined;
  signatureSvg: string | null;
  signed?: boolean | null | undefined;
  meterReadingEnd?: number | null | undefined;
  bulkMeterInstalled?: boolean;
}) {
  const hasImage = Boolean(imageUrl?.trim());

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            {bulkMeterInstalled ? (
              <ImageIcon className="size-4" />
            ) : (
              <PenLine className="size-4" />
            )}
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">
              {bulkMeterInstalled ? "Meter evidence" : "Operator attestation"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {bulkMeterInstalled
                ? "Bulk meter photo & operator signature"
                : "Signature only — this system logs pump runtime, not bulk-meter volume"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {bulkMeterInstalled &&
          meterReadingEnd != null &&
          Number.isFinite(Number(meterReadingEnd)) ? (
            <Badge variant="outline" className="gap-1 font-mono text-[11px] font-normal tabular-nums">
              Pump stop {fmt2(meterReadingEnd)} m³
            </Badge>
          ) : null}
          {signed ? (
            <Badge className="gap-1 border-emerald-200 bg-emerald-50 font-normal text-emerald-800 hover:bg-emerald-50">
              <PenLine className="size-3" />
              Signed
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal text-amber-700">
              Unsigned
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className={cn(
            "grid",
            bulkMeterInstalled
              ? "lg:grid-cols-[minmax(0,1fr)_132px]"
              : "lg:grid-cols-1",
          )}
        >
          {bulkMeterInstalled ? (
          <div className="border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
            {hasImage ? (
              <a
                href={imageUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-lg bg-slate-950/[0.03] ring-1 ring-border/80 transition hover:ring-primary/30"
              >
                <img
                  src={imageUrl!}
                  alt="Bulk meter reading"
                  className="mx-auto max-h-52 w-full object-contain p-2 transition duration-200 group-hover:scale-[1.01]"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 py-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-xs font-medium text-white">
                    View full resolution
                  </span>
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
                    <ZoomIn className="size-3.5" />
                  </span>
                </div>
              </a>
            ) : (
              <Empty className="min-h-[120px] border border-dashed bg-muted/15 py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageIcon />
                  </EmptyMedia>
                  <EmptyDescription className="text-xs">
                    No meter photograph attached
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {hasImage ? (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                  render={
                    <a
                      href={imageUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Open image
                  <ExternalLink className="size-3" />
                </Button>
              </div>
            ) : null}
          </div>
          ) : null}

          <div
            className={cn(
              "flex flex-col justify-between gap-2 bg-muted/25 p-3",
              !bulkMeterInstalled && "min-h-[120px]",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Signature
              </span>
              {signatureSvg ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 text-muted-foreground"
                  onClick={() => openSvgInNewTab(signatureSvg)}
                  title="Open signature"
                >
                  <ExternalLink className="size-3" />
                </Button>
              ) : null}
            </div>
            {signatureSvg ? (
              <div
                className="flex h-11 items-center justify-center rounded-md border border-border/80 bg-background px-1.5 shadow-sm [&_svg]:max-h-9 [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: signatureSvg }}
              />
            ) : (
              <div className="flex h-11 items-center justify-center rounded-md border border-dashed border-border/80 bg-background/60 text-[11px] text-muted-foreground">
                {signed ? "On file" : "—"}
              </div>
            )}
            <p className="text-[10px] leading-snug text-muted-foreground">
              Operator attestation snapshot
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailGrid({
  children,
  cols = 4,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4 | 6;
}) {
  const colClass =
    cols === 6
      ? "sm:grid-cols-3 lg:grid-cols-6"
      : cols === 3
        ? "sm:grid-cols-3"
        : cols === 2
          ? "sm:grid-cols-2"
          : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", colClass)}>
      {children}
    </dl>
  );
}

type WaterSubmissionDetailsPageProps = {
  readOnly?: boolean;
};

export default function WaterSubmissionDetailsPage({
  readOnly = false,
}: WaterSubmissionDetailsPageProps = {}) {
  const { id } = useParams<{ id: string }>();
  const submissionId = String(id ?? "").trim();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    getWaterSubmissionDetailForTehsilManager,
    acceptWaterSubmission,
    rejectWaterSubmission,
    revertWaterSubmission,
  } = useTehsilManagerOperatorApi();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);

  const [actionOpen, setActionOpen] = useState<
    null | "accept" | "reject" | "revert"
  >(null);
  const [remarks, setRemarks] = useState("");
  const [acting, setActing] = useState(false);

  const backTo = useMemo(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (typeof from === "string" && from.trim()) return from;
    return readOnly ? hqRoutes.waterAnalysis : tehsilRoutes.waterSubmissions;
  }, [location.state, readOnly]);

  const load = async () => {
    if (!submissionId) {
      setError("Missing submission id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = (await getWaterSubmissionDetailForTehsilManager(
        submissionId,
      )) as DetailResponse;
      setData(res ?? null);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Could not load submission details"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const submission = data?.submission;
  const record = data?.record_data;
  const system = record?.system;
  const audit = Array.isArray(data?.audit_trail)
    ? (data?.audit_trail ?? [])
    : [];
  const {
    pageItems: auditPageItems,
    pageIndex: auditPageIndex,
    pageSize: auditPageSize,
    pageCount: auditPageCount,
    total: auditTotal,
    setPageSize: setAuditPageSize,
    goToPage: goToAuditPage,
    resetPage: resetAuditPage,
  } = useClientPagination(audit, 5);

  useEffect(() => {
    resetAuditPage();
  }, [submissionId, resetAuditPage]);
  const signatureSvg = record?.signature_svg_snapshot?.trim()
    ? record.signature_svg_snapshot
    : null;

  const canAct = !readOnly && submission?.status === "submitted";

  const meterInterval = meterDelta(
    record?.meter_reading_end,
    record?.meter_reading_start,
  );

  const hasBulkMeter = systemUsesBulkMeter(system);
  const estimatedVolume = estimatedVolumeFromRuntime(
    record?.pump_operating_hours,
    system?.pump_flow_rate,
  );

  const runAction = async () => {
    if (!submission) return;
    if (!actionOpen) return;

    if (actionOpen === "reject" && !remarks.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }

    setActing(true);
    try {
      if (actionOpen === "accept") {
        await acceptWaterSubmission(submission.id, { remarks: remarks.trim() });
        toast.success("Submission accepted");
      } else if (actionOpen === "reject") {
        await rejectWaterSubmission(submission.id, { remarks: remarks.trim() });
        toast.success("Submission rejected");
      } else if (actionOpen === "revert") {
        await revertWaterSubmission(submission.id, { remarks: remarks.trim() });
        toast.success("Submission reverted to operator");
      }
      setActionOpen(null);
      setRemarks("");
      navigate(backTo, { replace: true });
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Action failed"));
    } finally {
      setActing(false);
    }
  };

  const headerDescription = submission
    ? [
        kv(system?.unique_identifier),
        kv(system?.village),
        periodLabel(record?.month, record?.year),
      ]
        .filter((x) => x !== "—")
        .join(" · ")
    : readOnly
      ? "Read-only review of accepted operator daily log."
      : "Review operator daily log before accepting or returning.";

  return (
    <PageShell>
      <PageHeader
        icon={<FileCheck />}
        title={readOnly ? "Submission details" : "Submission review"}
        description={headerDescription}
        badge={submission?.status ? statusBadge(submission.status) : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(backTo)}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Spinner className="size-4" />
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
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertTitle>Could not load submission</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !submission ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileCheck />
            </EmptyMedia>
            <EmptyDescription>No submission data found.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {hasBulkMeter ? (
              <>
                <StatCard
                  label="Water pumped"
                  value={
                    <NumericValue
                      value={record?.total_water_pumped}
                      decimals={2}
                      unit="m³"
                      className="text-2xl font-semibold text-primary"
                    />
                  }
                  accent="blue"
                  icon={<Droplets className="size-5" />}
                />
                <StatCard
                  label="Operating hours"
                  value={
                    <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                      {fmtHours(record?.pump_operating_hours)}
                    </span>
                  }
                  description={`${kv(record?.pump_start_time)} → ${kv(record?.pump_end_time)}`}
                  accent="slate"
                  icon={<Gauge className="size-5" />}
                />
                <StatCard
                  label="Meter at pump stop"
                  value={
                    <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                      {fmt2(record?.meter_reading_end)}
                    </span>
                  }
                  {...(meterInterval !== "—"
                    ? { description: `This interval ${meterInterval} m³` }
                    : {})}
                  accent="violet"
                />
                <StatCard
                  label="Reporting period"
                  value={
                    <span className="text-lg font-semibold tracking-tight">
                      {periodLabel(record?.month, record?.year)}
                    </span>
                  }
                  description={kv(system?.unique_identifier)}
                  accent="amber"
                  icon={<CalendarDays className="size-5" />}
                />
              </>
            ) : (
              <>
                <StatCard
                  label="Operating hours"
                  value={
                    <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                      {fmtHours(record?.pump_operating_hours)}
                    </span>
                  }
                  description={`${kv(record?.pump_start_time)} → ${kv(record?.pump_end_time)}`}
                  accent="blue"
                  icon={<Gauge className="size-5" />}
                />
                <StatCard
                  label="Pump flow rate"
                  value={
                    <NumericValue
                      value={system?.pump_flow_rate}
                      decimals={2}
                      unit="m³/h"
                      className="text-2xl font-semibold text-primary"
                    />
                  }
                  description="Design flow rate for this system"
                  accent="slate"
                  icon={<Droplets className="size-5" />}
                />
                <StatCard
                  label="Estimated volume"
                  value={
                    <NumericValue
                      value={estimatedVolume}
                      decimals={2}
                      unit="m³"
                      className="text-2xl font-semibold tabular-nums tracking-tight"
                    />
                  }
                  description={
                    estimatedVolume != null
                      ? "Flow rate × operating hours (indicative)"
                      : "Requires flow rate and runtime"
                  }
                  accent="violet"
                />
                <StatCard
                  label="Reporting period"
                  value={
                    <span className="text-lg font-semibold tracking-tight">
                      {periodLabel(record?.month, record?.year)}
                    </span>
                  }
                  description={kv(system?.unique_identifier)}
                  accent="amber"
                  icon={<CalendarDays className="size-5" />}
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 py-3">
              <CardTitle className="text-sm font-semibold">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                  label="System UID"
                  value={kv(system?.unique_identifier)}
                  mono
                  highlight
                />
                <DetailItem
                  label="Location"
                  value={
                    system?.settlement
                      ? `${kv(system.village)}, ${system.settlement}`
                      : kv(system?.village)
                  }
                  highlight
                />
                <DetailItem
                  label="Operator"
                  value={kv(submission.operator_name)}
                />
                <DetailItem
                  label="Signed"
                  value={
                    record?.signed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <PenLine className="size-3" />
                        Yes
                      </span>
                    ) : (
                      <span className="text-amber-700">No</span>
                    )
                  }
                  highlight
                />
                <DetailItem
                  label="Logging mode"
                  value={
                    hasBulkMeter ? (
                      <Badge variant="outline" className="font-normal">
                        Bulk meter
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        OHR / runtime only
                      </Badge>
                    )
                  }
                />
              </div>

              <DetailGrid cols={6}>
                <DetailItem
                  label="Email"
                  value={kv(submission.operator_email)}
                  className="sm:col-span-2"
                />
                <DetailItem label="Tehsil" value={kv(system?.tehsil)} />
                <DetailItem
                  label="Submitted"
                  value={formatPakistanDateTime(submission.submitted_at)}
                  mono
                />
                <DetailItem
                  label="Last edited"
                  value={formatPakistanDateTime(record?.last_edited_at)}
                  mono
                />
                <DetailItem
                  label="Reviewed"
                  value={formatPakistanDateTime(submission.reviewed_at)}
                  mono
                />
                {submission.id ? (
                  <DetailItem
                    label="Submission ID"
                    value={submission.id.slice(0, 8).toUpperCase()}
                    mono
                  />
                ) : null}
              </DetailGrid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 py-3">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Daily log</CardTitle>
                <Badge variant="outline" className="gap-1 font-normal">
                  <CalendarDays className="size-3" />
                  {periodLabel(record?.month, record?.year)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground">
                {hasBulkMeter
                  ? "Bulk-meter readings and runtime for this submission. Historical meter chain data is tracked at the water-system level."
                  : "This system has no bulk meter — operators log pump start/end times and operating hours only. Volume is not stored on each submission."}
              </p>
              {hasBulkMeter ? (
                <>
                  <DetailGrid cols={6}>
                    <DetailItem
                      label="Previous meter reading"
                      hint="Last accepted cumulative reading before this log"
                      value={fmt2(record?.previous_meter_reading_end)}
                      numeric
                    />
                    <DetailItem
                      label="Baseline reading"
                      hint="Meter at the start of this interval"
                      value={fmt2(record?.meter_reading_start)}
                      numeric
                    />
                    <DetailItem
                      label="Reading at pump stop"
                      hint="Cumulative meter when the pump stopped"
                      value={fmt2(record?.meter_reading_end)}
                      numeric
                      highlight
                    />
                    <DetailItem
                      label="Pump start"
                      value={kv(record?.pump_start_time)}
                      numeric
                    />
                    <DetailItem
                      label="Pump end"
                      value={kv(record?.pump_end_time)}
                      numeric
                    />
                    <DetailItem
                      label="Operating hours"
                      value={fmtHours(record?.pump_operating_hours)}
                      numeric
                      highlight
                    />
                    <DetailItem
                      label="Interval volume"
                      hint="Pump stop − baseline (this log)"
                      value={
                        <>
                          {meterInterval}
                          {meterInterval !== "—" ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              m³
                            </span>
                          ) : null}
                        </>
                      }
                      numeric
                      highlight
                    />
                    <DetailItem
                      label="Water pumped (reported)"
                      hint="Operator-reported total for this interval"
                      value={fmt2(record?.total_water_pumped)}
                      numeric
                      highlight
                      className="sm:col-span-2 lg:col-span-3"
                    />
                  </DetailGrid>

                  <div className="flex items-center justify-between rounded-lg border-2 border-primary/25 bg-primary/10 px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Total water pumped
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Primary figure for acceptance review
                      </p>
                    </div>
                    <NumericValue
                      value={record?.total_water_pumped}
                      decimals={2}
                      unit="m³"
                      className="text-3xl font-bold text-primary"
                    />
                  </div>
                </>
              ) : (
                <>
                  <DetailGrid cols={6}>
                    <DetailItem
                      label="Pump start"
                      value={kv(record?.pump_start_time)}
                      numeric
                      highlight
                    />
                    <DetailItem
                      label="Pump end"
                      value={kv(record?.pump_end_time)}
                      numeric
                      highlight
                    />
                    <DetailItem
                      label="Operating hours"
                      value={fmtHours(record?.pump_operating_hours)}
                      numeric
                      highlight
                    />
                    <DetailItem
                      label="Pump flow rate"
                      hint="Design flow rate on the water system"
                      value={
                        <>
                          {fmt2(system?.pump_flow_rate)}
                          {system?.pump_flow_rate != null ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              m³/h
                            </span>
                          ) : null}
                        </>
                      }
                      numeric
                    />
                    <DetailItem
                      label="OHR tank capacity"
                      value={
                        <>
                          {fmt2(system?.ohr_tank_capacity)}
                          {system?.ohr_tank_capacity != null ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              m³
                            </span>
                          ) : null}
                        </>
                      }
                      numeric
                    />
                    <DetailItem
                      label="Fill required"
                      hint="Design time to fill tank"
                      value={
                        system?.ohr_fill_required != null
                          ? `${fmt2(system.ohr_fill_required)} min`
                          : "—"
                      }
                      numeric
                    />
                    <DetailItem
                      label="Height to OHR"
                      value={
                        system?.height_to_ohr != null
                          ? `${fmt2(system.height_to_ohr)} m`
                          : "—"
                      }
                      numeric
                      className="sm:col-span-2"
                    />
                    <DetailItem
                      label="Estimated volume"
                      hint="Indicative: flow rate × operating hours"
                      value={
                        <>
                          {fmt2(estimatedVolume)}
                          {estimatedVolume != null ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              m³
                            </span>
                          ) : null}
                        </>
                      }
                      numeric
                      highlight
                      className="sm:col-span-2 lg:col-span-3"
                    />
                  </DetailGrid>

                  <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Runtime logged
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        No bulk-meter volume is recorded for this system type
                      </p>
                    </div>
                    <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-primary">
                      {fmtHours(record?.pump_operating_hours)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        h
                      </span>
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <EvidencePanel
            imageUrl={record?.bulk_meter_image_url}
            signatureSvg={signatureSvg}
            signed={record?.signed}
            meterReadingEnd={record?.meter_reading_end}
            bulkMeterInstalled={hasBulkMeter}
          />

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 border-b border-border/60 py-3">
              <History className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Audit trail</CardTitle>
              {audit.length > 0 ? (
                <Badge variant="secondary" className="ml-1 font-normal">
                  {audit.length}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="p-0 pt-4">
              {audit.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  No audit events recorded.
                </p>
              ) : (
                <div className="overflow-hidden">
                  <DataTableWrap>
                    <Table>
                      <DataTableHeader>
                        <DataTableHead>When</DataTableHead>
                        <DataTableHead>Action</DataTableHead>
                        <DataTableHead>By</DataTableHead>
                        <DataTableHead>Role</DataTableHead>
                        <DataTableHead>Comment</DataTableHead>
                      </DataTableHeader>
                      <TableBody>
                        {auditPageItems.map((l, idx) => (
                          <TableRow key={`${l.action_type}-${auditPageIndex}-${idx}`}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatPakistanDateTime(l.created_at)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {auditActionLabel(kv(l.action_type))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {kv(l.performed_by)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {kv(l.role)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md text-sm text-muted-foreground">
                              {kv(l.comment)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </DataTableWrap>
                  <PaginatedListFooter
                    pageIndex={auditPageIndex}
                    pageSize={auditPageSize}
                    pageCount={auditPageCount}
                    total={auditTotal}
                    onPageChange={goToAuditPage}
                    onPageSizeChange={setAuditPageSize}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {!readOnly ? (
          <Card>
            <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
              <CardTitle className="text-sm font-semibold">
                Review decision
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {canAct
                  ? "Approve, revert for correction, or reject with a reason."
                  : "This submission is no longer pending review."}
              </p>
            </CardHeader>
            <CardFooter className="flex flex-wrap justify-end gap-2 py-3">
              <Button
                type="button"
                size="sm"
                onClick={() => setActionOpen("accept")}
                disabled={!canAct}
              >
                <CheckCircle2 className="size-4" />
                Accept
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActionOpen("revert")}
                disabled={!canAct}
              >
                <SendToBack className="size-4" />
                Revert
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setActionOpen("reject")}
                disabled={!canAct}
              >
                <XCircle className="size-4" />
                Reject
              </Button>
            </CardFooter>
          </Card>
          ) : null}
        </div>
      )}

      {!readOnly ? (
      <Dialog
        open={actionOpen !== null}
        onOpenChange={(open) => {
          if (!open && !acting) {
            setActionOpen(null);
            setRemarks("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionOpen === "accept"
                ? "Accept submission"
                : actionOpen === "reject"
                  ? "Reject submission"
                  : "Revert to operator"}
            </DialogTitle>
            <DialogDescription>
              {actionOpen === "reject"
                ? "Provide a clear rejection reason. The operator will see this message."
                : "Optional remarks are stored in the audit trail."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="remarks">
                Remarks {actionOpen === "reject" ? "(required)" : "(optional)"}
              </FieldLabel>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={
                  actionOpen === "reject"
                    ? "e.g. Bulk meter image is unclear. Please re-upload."
                    : "Add a short note (optional)…"
                }
                rows={3}
                disabled={acting}
                className="min-h-0 resize-none"
              />
              <FieldDescription>
                {actionOpen === "reject"
                  ? "Visible to the operator in submission history."
                  : "Optional note for the audit trail."}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActionOpen(null)}
              disabled={acting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={actionOpen === "reject" ? "destructive" : "default"}
              onClick={() => void runAction()}
              disabled={acting || (actionOpen === "reject" && !remarks.trim())}
            >
              {acting ? <Spinner className="size-4" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}
    </PageShell>
  );
}
