import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck,
  Gauge,
  History,
  ImageIcon,
  MapPin,
  PenLine,
  RotateCcw,
  SendToBack,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { AspectRatio } from "../../../components/ui/aspect-ratio";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "../../../components/ui/item";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Textarea } from "../../../components/ui/textarea";
import { tehsilRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { getApiErrorMessage } from "../../../lib/api-error";
import { formatPakistanDateTime } from "../../../utils/pakistanTime";

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
    system?: {
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
      meter_model?: string | null;
      meter_serial_number?: string | null;
      meter_accuracy_class?: string | null;
      installation_date?: string | null;
    };
  };
  audit_trail?: Array<{
    action_type: string;
    performed_by: string;
    role: string;
    comment: string;
    created_at?: string | null;
  }>;
};

function kv(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function fmt2(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  // Best-effort cleanup (tab may still be loading).
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function statusBadge(status: string) {
  switch (status) {
    case "submitted":
      return (
        <Badge className="gap-1.5 border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50">
          <FileCheck className="size-3.5" />
          Pending review
        </Badge>
      );
    case "accepted":
      return (
        <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
          <CheckCircle2 className="size-3.5" />
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1.5">
          <XCircle className="size-3.5" />
          Rejected
        </Badge>
      );
    case "reverted_back":
      return (
        <Badge className="gap-1.5 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
          <SendToBack className="size-3.5" />
          Reverted back
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function WaterSubmissionDetailsPage() {
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
    return typeof from === "string" && from.trim()
      ? from
      : tehsilRoutes.waterSubmissions;
  }, [location.state]);

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
  const signatureSvg = record?.signature_svg_snapshot?.trim()
    ? record.signature_svg_snapshot
    : null;

  const canAct = submission?.status === "submitted";

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-muted/20 p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <Item className="border-transparent p-0">
              <ItemContent className="gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(backTo)}
                >
                  <ArrowLeft />
                  Back to submissions
                </Button>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-2xl md:text-3xl">
                      Submission review
                    </CardTitle>
                    {submission?.status ? statusBadge(submission.status) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {submission?.id ? (
                      <Badge className="font-mono text-[11px]">
                        {submission.id.slice(0, 8).toUpperCase()}
                      </Badge>
                    ) : null}
                    {record?.signed ? (
                      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                        <PenLine className="size-3" />
                        Digitally signed
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unsigned</Badge>
                    )}
                    <Badge variant="outline" className="gap-1">
                      <CalendarDays className="size-3" />
                      {periodLabel(record?.month, record?.year)}
                    </Badge>
                  </div>
                  <CardDescription className="max-w-2xl text-sm leading-relaxed">
                    Verify operator daily log readings, bulk meter evidence, and
                    signature before accepting or returning to the operator.
                  </CardDescription>
                </div>
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  {loading ? <Spinner /> : <RotateCcw />}
                  Refresh
                </Button>
              </ItemActions>
            </Item>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Could not load submission</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !submission ? (
          <Card>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileCheck />
                  </EmptyMedia>
                  <EmptyDescription>No submission data found.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="border-b">
                  <Item>
                    <ItemMedia
                      variant="icon"
                      className="size-9 rounded-lg bg-primary text-primary-foreground"
                    >
                      <UserRound />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Operator</ItemTitle>
                      <ItemDescription>Submitted by</ItemDescription>
                    </ItemContent>
                  </Item>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="font-semibold">
                    {kv(submission.operator_name)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {kv(submission.operator_email)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <Item>
                    <ItemMedia
                      variant="icon"
                      className="size-9 rounded-lg bg-primary text-primary-foreground"
                    >
                      <MapPin />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Location</ItemTitle>
                      <ItemDescription>Water system</ItemDescription>
                    </ItemContent>
                  </Item>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-semibold">{kv(system?.village)}</p>
                  <p className="text-sm text-muted-foreground">
                    {kv(system?.tehsil)}
                  </p>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {kv(system?.unique_identifier)}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <Item>
                    <ItemMedia
                      variant="icon"
                      className="size-9 rounded-lg bg-primary text-primary-foreground"
                    >
                      <Clock3 />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>Timeline</ItemTitle>
                      <ItemDescription>Workflow timestamps</ItemDescription>
                    </ItemContent>
                  </Item>
                </CardHeader>
                <CardContent>
                  <ItemGroup className="gap-2">
                    <Item
                      variant="outline"
                      size="sm"
                      className="justify-between"
                    >
                      <ItemTitle className="text-xs uppercase text-muted-foreground">
                        Submitted
                      </ItemTitle>
                      <span className="text-sm font-medium">
                        {formatPakistanDateTime(submission.submitted_at)}
                      </span>
                    </Item>
                    <Item
                      variant="outline"
                      size="sm"
                      className="justify-between"
                    >
                      <ItemTitle className="text-xs uppercase text-muted-foreground">
                        Last edited
                      </ItemTitle>
                      <span className="text-sm font-medium">
                        {formatPakistanDateTime(record?.last_edited_at)}
                      </span>
                    </Item>
                    <Item
                      variant="outline"
                      size="sm"
                      className="justify-between"
                    >
                      <ItemTitle className="text-xs uppercase text-muted-foreground">
                        Reviewed
                      </ItemTitle>
                      <span className="text-sm font-medium">
                        {formatPakistanDateTime(submission.reviewed_at)}
                      </span>
                    </Item>
                  </ItemGroup>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="border-b">
                <Item>
                  <ItemMedia variant="icon">
                    <Gauge />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Daily log</ItemTitle>
                    <ItemDescription>
                      Pump runtime and meter reading at pump stop ·{" "}
                      {periodLabel(record?.month, record?.year)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="outline">Bulk meter interval</Badge>
                  </ItemActions>
                </Item>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card size="sm">
                    <CardContent>
                      <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                        Pump start
                      </CardDescription>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums">
                        {kv(record?.pump_start_time)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card size="sm">
                    <CardContent>
                      <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                        Pump end
                      </CardDescription>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums">
                        {kv(record?.pump_end_time)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card size="sm">
                    <CardContent>
                      <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                        Operating hours
                      </CardDescription>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums">
                        {fmt2(record?.pump_operating_hours)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card size="sm">
                    <CardContent>
                      <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                        Meter at pump stop
                      </CardDescription>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums">
                        {fmt2(record?.meter_reading_end)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-primary text-primary-foreground ring-primary/20 lg:max-w-md">
                  <CardContent>
                    <CardDescription className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/70">
                      Water pumped this interval (m³)
                    </CardDescription>
                    <p className="mt-1.5 text-2xl font-semibold tabular-nums">
                      {fmt2(record?.total_water_pumped)}
                    </p>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card size="sm" className="bg-muted/30">
                    <CardHeader>
                      <Item>
                        <ItemMedia variant="icon">
                          <ImageIcon />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>Meter evidence</ItemTitle>
                        </ItemContent>
                        {record?.bulk_meter_image_url?.trim() ? (
                          <ItemActions>
                            <Button
                              variant="link"
                              size="xs"
                              nativeButton={false}
                              className="h-auto px-0"
                              render={
                                <a
                                  href={record.bulk_meter_image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              }
                            >
                              Open full size
                              <ExternalLink data-icon="inline-end" />
                            </Button>
                          </ItemActions>
                        ) : null}
                      </Item>
                    </CardHeader>
                    <CardContent>
                      {record?.bulk_meter_image_url?.trim() ? (
                        <a
                          href={record.bulk_meter_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border bg-background outline-none ring-offset-background transition hover:opacity-95 focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <AspectRatio
                            ratio={4 / 3}
                            className="overflow-hidden bg-background"
                          >
                            <img
                              src={record.bulk_meter_image_url}
                              alt="Bulk meter reading"
                              className="size-full object-cover transition duration-200 hover:scale-[1.02]"
                            />
                          </AspectRatio>
                        </a>
                      ) : (
                        <Empty className="min-h-[180px] border">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <ImageIcon />
                            </EmptyMedia>
                            <EmptyDescription>
                              No meter image attached
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}
                    </CardContent>
                  </Card>

                  <Card size="sm" className="bg-muted/30">
                    <CardHeader>
                      <Item>
                        <ItemMedia variant="icon">
                          <PenLine />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>Operator signature</ItemTitle>
                        </ItemContent>
                        <ItemActions>
                          {record?.signed ? (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                              Signed
                            </Badge>
                          ) : (
                            <Badge variant="outline">Unsigned</Badge>
                          )}
                          {signatureSvg ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => openSvgInNewTab(signatureSvg)}
                            >
                              <ExternalLink />
                              Open
                            </Button>
                          ) : null}
                        </ItemActions>
                      </Item>
                    </CardHeader>
                    <CardContent>
                      {signatureSvg ? (
                        <Card
                          size="sm"
                          className="min-h-[180px] bg-background shadow-inner"
                        >
                          <CardContent className="flex items-center justify-center">
                            <div
                              className="h-20 w-full max-w-xs [&_svg]:mx-auto [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-none"
                              dangerouslySetInnerHTML={{ __html: signatureSvg }}
                            />
                          </CardContent>
                        </Card>
                      ) : (
                        <Empty className="min-h-[180px] border">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <PenLine />
                            </EmptyMedia>
                            <EmptyDescription>
                              No signature snapshot on file
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <Item>
                  <ItemMedia variant="icon">
                    <History />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Audit trail</ItemTitle>
                    <ItemDescription>
                      Complete workflow history — submit, accept, reject, and
                      revert actions.
                    </ItemDescription>
                  </ItemContent>
                </Item>
              </CardHeader>
              <CardContent>
                {audit.length === 0 ? (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <History />
                      </EmptyMedia>
                      <EmptyDescription>
                        No audit events recorded yet.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="text-xs font-semibold uppercase tracking-wide">
                            When
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wide">
                            Action
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wide">
                            By
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wide">
                            Role
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wide">
                            Comment
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audit.map((l, idx) => (
                          <TableRow key={`${l.action_type}-${idx}`}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatPakistanDateTime(l.created_at)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {auditActionLabel(kv(l.action_type))}
                            </TableCell>
                            <TableCell>{kv(l.performed_by)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px]">
                                {kv(l.role)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[420px] text-sm text-muted-foreground">
                              {kv(l.comment)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b bg-muted/20">
                <Item className="border-transparent p-0">
                  <ItemMedia
                    variant="icon"
                    className="size-10 rounded-full bg-primary/10 text-primary"
                  >
                    <FileCheck />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-base font-semibold tracking-tight">
                      Review decision
                    </ItemTitle>
                    <ItemDescription className="max-w-2xl text-pretty leading-relaxed">
                      {canAct
                        ? "Approve the log, return it for correction, or reject with a documented reason."
                        : "This submission is no longer pending review."}
                    </ItemDescription>
                  </ItemContent>
                  {canAct ? (
                    <ItemActions>
                      <Badge className="border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50">
                        Awaiting action
                      </Badge>
                    </ItemActions>
                  ) : null}
                </Item>
              </CardHeader>
              <CardFooter className="flex flex-col gap-4 border-t bg-muted/10 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    className="w-full sm:w-auto sm:min-w-[6.5rem]"
                    onClick={() => setActionOpen("accept")}
                    disabled={!canAct}
                  >
                    <CheckCircle2 />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto sm:min-w-[6.5rem]"
                    onClick={() => setActionOpen("revert")}
                    disabled={!canAct}
                  >
                    <SendToBack />
                    Revert
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:min-w-[6.5rem]"
                    onClick={() => setActionOpen("reject")}
                    disabled={!canAct}
                  >
                    <XCircle />
                    Reject
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </>
        )}
      </div>

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
                  : "Revert submission back to operator"}
            </DialogTitle>
            <DialogDescription>
              {actionOpen === "reject"
                ? "Provide a clear rejection reason. The operator will see this message."
                : "Optional remarks help audit and operator correction."}
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
                rows={4}
                disabled={acting}
              />
              <FieldDescription>
                {actionOpen === "reject"
                  ? "The operator will see this message in their submission history."
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
              {acting ? <Spinner /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
