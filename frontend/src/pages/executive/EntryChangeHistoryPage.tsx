import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";
import {
  DataListCard,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
  kv,
  PageHeader,
  PageShell,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/layout";
import { ChangeActionBadge } from "@/components/manager-ops/ChangeActionBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE } from "@/constants/roles";
import { hqRoutes, tehsilRoutes } from "@/constants/routes";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  listEntryChangeLogs,
  type EntryChangeLogFilters,
  type EntryChangeLogRow,
} from "@/services/tehsilManagerOperatorService";
import {
  markAllNotificationsReadOfType,
  NOTIFICATION_TYPE_ENTRY_CHANGE,
  NOTIFICATIONS_QUERY_KEY,
} from "@/services/notificationsService";
import { cn } from "@/lib/utils";
import { formatPakistanDateTime } from "@/utils/pakistanTime";

const SNAPSHOT_LABELS: Record<string, string> = {
  log_date: "Log date",
  pump_start_time: "Pump start",
  pump_end_time: "Pump end",
  pump_operating_hours: "Operating hours",
  total_water_pumped: "Water pumped (m³)",
  meter_reading_start: "Meter start",
  meter_reading_end: "Meter end",
  status: "Status at change",
  year: "Year",
  month: "Month",
  meter_phase: "Log type",
  export_off_peak: "Export off-peak",
  export_peak: "Export peak",
  import_off_peak: "Import off-peak",
  import_peak: "Import peak",
  net_off_peak: "Net off-peak",
  net_peak: "Net peak",
  remarks: "Remarks",
};

function SnapshotDetails({ row }: { row: EntryChangeLogRow }) {
  const snap = (row.snapshot ?? {}) as {
    record?: Record<string, unknown>;
    verification_history?: Array<Record<string, unknown>>;
  };
  const record = snap.record ?? {};
  const fields = Object.keys(SNAPSHOT_LABELS).filter(
    (k) => record[k] !== undefined && record[k] !== null && record[k] !== "",
  );
  const history = snap.verification_history ?? [];
  const image =
    (record.bulk_meter_image_url as string | undefined) ??
    (record.electricity_bill_image_url as string | undefined);

  return (
    <div className="grid gap-4 py-2 md:grid-cols-2">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Entry as it was before the change
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {fields.map((k) => (
            <Fragment key={k}>
              <dt className="text-muted-foreground">{SNAPSHOT_LABELS[k]}</dt>
              <dd className="tabular-nums">
                {k === "meter_phase"
                  ? record[k] === "pre_green"
                    ? "Before green meter"
                    : "Green meter"
                  : String(record[k])}
              </dd>
            </Fragment>
          ))}
        </dl>
        {image ? (
          <a
            href={image}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-primary underline"
          >
            Open attached image
          </a>
        ) : null}
      </div>
      {history.length ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Review history at the time
          </p>
          <ol className="space-y-1.5 text-sm">
            {history.map((h, i) => (
              <li key={i}>
                <span className="font-medium">{String(h.action_type)}</span>{" "}
                <span className="text-muted-foreground">
                  by {String(h.performed_by_name ?? "Unknown")} ·{" "}
                  {formatPakistanDateTime(h.created_at as string) || "—"}
                </span>
                {h.comment ? (
                  <p className="text-xs text-muted-foreground">{String(h.comment)}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export default function EntryChangeHistoryPage() {
  const { user } = useAuth();
  const isHq = user?.role === ROLE.SUPER_ADMIN;
  const [rows, setRows] = useState<EntryChangeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState<EntryChangeLogFilters>({});
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get("highlight") ?? "";
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  const qc = useQueryClient();

  // Everything listed here has now been seen → clear change notifications.
  useEffect(() => {
    void markAllNotificationsReadOfType(NOTIFICATION_TYPE_ENTRY_CHANGE)
      .then(() => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }))
      .catch(() => undefined);
  }, [qc, highlight]);

  // Opened from a notification: expand and scroll to that change.
  useEffect(() => {
    if (!highlight || loading) return;
    if (rows.some((r) => r.id === highlight)) {
      setExpanded(highlight);
      requestAnimationFrame(() =>
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    }
  }, [highlight, loading, rows]);

  const load = useCallback(async () => {
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
      toast.error("'From' date must be on or before 'To' date");
      return;
    }
    setLoading(true);
    try {
      const data = await listEntryChangeLogs(filters);
      setRows(Array.isArray(data.change_logs) ? data.change_logs : []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load change history"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof EntryChangeLogFilters>(k: K, v: EntryChangeLogFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v || undefined }));

  const detailLink = (r: EntryChangeLogRow): string | null => {
    if (r.action !== "reject" || !r.submission_id) return null;
    return isHq
      ? hqRoutes.waterSubmissionDetails(r.submission_id)
      : tehsilRoutes.waterSubmissionDetails(r.submission_id);
  };

  return (
    <PageShell>
      <PageHeader
        icon={<History className="text-rose-600" />}
        title="Change history"
        description="Approved water logs and solar entries that Manager Operations rejected or deleted, with the reason given."
        actions={
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="ch-type" className="text-xs">Type</Label>
          <select
            id="ch-type"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filters.entry_type ?? ""}
            onChange={(e) => set("entry_type", e.target.value as EntryChangeLogFilters["entry_type"])}
          >
            <option value="">All</option>
            <option value="water_log">Water logs</option>
            <option value="solar_log">Solar entries</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ch-action" className="text-xs">Action</Label>
          <select
            id="ch-action"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filters.action ?? ""}
            onChange={(e) => set("action", e.target.value as EntryChangeLogFilters["action"])}
          >
            <option value="">All</option>
            <option value="reject">Rejected</option>
            <option value="delete">Deleted</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ch-from" className="text-xs">From</Label>
          <Input
            id="ch-from"
            type="date"
            className="h-9 w-40"
            value={filters.date_from ?? ""}
            onChange={(e) => set("date_from", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ch-to" className="text-xs">To</Label>
          <Input
            id="ch-to"
            type="date"
            className="h-9 w-40"
            value={filters.date_to ?? ""}
            onChange={(e) => set("date_to", e.target.value)}
          />
        </div>
        {Object.values(filters).some(Boolean) ? (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            Clear
          </Button>
        ) : null}
      </div>

      <DataListCard loading={loading} count={rows.length} title="Changes">
        <DataTableWrap>
          <Table>
            <DataTableHeader>
              <DataTableHead> </DataTableHead>
              <DataTableHead>When</DataTableHead>
              <DataTableHead>Action</DataTableHead>
              <DataTableHead>Entry</DataTableHead>
              <DataTableHead>Site</DataTableHead>
              <DataTableHead>Reason</DataTableHead>
              <DataTableHead>By</DataTableHead>
            </DataTableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <DataTableEmpty colSpan={7} />
              ) : (
                rows.map((r) => {
                  const open = expanded === r.id;
                  const link = detailLink(r);
                  return (
                    <Fragment key={r.id}>
                      <TableRow
                        ref={r.id === highlight ? highlightRef : undefined}
                        className={cn(
                          "cursor-pointer",
                          r.id === highlight && "bg-sky-50 ring-2 ring-sky-400 ring-inset dark:bg-sky-950/30",
                        )}
                        onClick={() => setExpanded(open ? null : r.id)}
                      >
                        <TableCell className="w-8">
                          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatPakistanDateTime(r.created_at) || "—"}
                        </TableCell>
                        <TableCell>
                          <ChangeActionBadge action={r.action} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              r.entry_type === "water_log"
                                ? "border-sky-200 bg-sky-50 text-sky-900"
                                : "border-amber-200 bg-amber-50 text-amber-900"
                            }
                          >
                            {r.entry_type === "water_log" ? "Water" : "Solar"}
                          </Badge>
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            {kv(r.entry_period)}
                          </p>
                          {link ? (
                            <Link
                              to={link}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-primary underline"
                            >
                              View log
                            </Link>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{kv(r.system_uid)}</p>
                          <p className="text-xs text-muted-foreground">
                            {kv(r.village)} · {r.tehsil}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <p className="line-clamp-3 whitespace-pre-wrap text-sm">{r.reason}</p>
                        </TableCell>
                        <TableCell className="text-sm">{kv(r.performed_by_name)}</TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={6}>
                            <p className="mb-2 whitespace-pre-wrap text-sm">
                              <span className="font-medium">Reason: </span>
                              {r.reason}
                            </p>
                            <SnapshotDetails row={r} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DataTableWrap>
      </DataListCard>
    </PageShell>
  );
}
