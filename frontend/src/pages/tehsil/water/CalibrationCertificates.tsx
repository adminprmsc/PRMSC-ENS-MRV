import { useEffect, useMemo, useState } from "react";
import {
  DataListCard,
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
} from "../../../components/layout";
import {
  ExternalLink,
  FileText,
  RefreshCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getActiveWaterSystemCalibrationCertificates } from "../../../services/tehsilManagerOperatorService";
import {
  formatPakistanDate,
  getPakistanIsoDateString,
  pakistanCalendarDayDiff,
} from "../../../utils/pakistanTime";

type ActiveCertRow = {
  water_system: {
    id: string;
    unique_identifier?: string;
    tehsil?: string;
    village?: string;
    settlement?: string;
  };
  certificate: {
    id: string;
    file_url: string;
    uploaded_at?: string | null;
    expiry_date?: string | null;
  };
};

const fileNameFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).at(-1) ?? url;
    return decodeURIComponent(last);
  } catch {
    const last = url.split("/").filter(Boolean).at(-1) ?? url;
    return last;
  }
};

const fmtDate = formatPakistanDate;

type ExpiryState = "expired" | "expiring_7d" | "valid" | "unknown";

const getExpiryMeta = (
  value?: string | null,
): {
  state: ExpiryState;
  daysRemaining: number | null;
} => {
  if (!value) return { state: "unknown", daysRemaining: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    return { state: "unknown", daysRemaining: null };

  const expiryIso =
    /^\d{4}-\d{2}-\d{2}/.test(value.trim())
      ? value.trim().slice(0, 10)
      : getPakistanIsoDateString(parsed);
  const daysRemaining = pakistanCalendarDayDiff(expiryIso);

  if (daysRemaining < 0) return { state: "expired", daysRemaining };
  if (daysRemaining <= 7) return { state: "expiring_7d", daysRemaining };
  return { state: "valid", daysRemaining };
};

export default function CalibrationCertificates() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ActiveCertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const res =
        (await getActiveWaterSystemCalibrationCertificates()) as ActiveCertRow[];
      setRows(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Could not load calibration certificates"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load(true);
    }, 60_000);

    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      void load(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const rowsWithExpiry = useMemo(() => {
    const priority = (s: ExpiryState) => {
      if (s === "expired") return 0;
      if (s === "expiring_7d") return 1;
      if (s === "unknown") return 2;
      return 3;
    };

    return rows
      .map((r) => ({
        row: r,
        expiry: getExpiryMeta(r.certificate.expiry_date),
      }))
      .sort((a, b) => {
        const prioDiff = priority(a.expiry.state) - priority(b.expiry.state);
        if (prioDiff !== 0) return prioDiff;

        const aDate = a.row.certificate.expiry_date
          ? new Date(a.row.certificate.expiry_date).getTime()
          : Number.POSITIVE_INFINITY;
        const bDate = b.row.certificate.expiry_date
          ? new Date(b.row.certificate.expiry_date).getTime()
          : Number.POSITIVE_INFINITY;
        return aDate - bDate;
      });
  }, [rows]);

  const expiredCount = useMemo(
    () => rowsWithExpiry.filter((r) => r.expiry.state === "expired").length,
    [rowsWithExpiry],
  );
  const expiringWeekCount = useMemo(
    () => rowsWithExpiry.filter((r) => r.expiry.state === "expiring_7d").length,
    [rowsWithExpiry],
  );
  const validCount = useMemo(
    () => rowsWithExpiry.filter((r) => r.expiry.state === "valid").length,
    [rowsWithExpiry],
  );
  const hasUrgent = expiredCount > 0 || expiringWeekCount > 0;

  return (
    <PageShell>
      <PageHeader
        icon={<FileText />}
        title="Calibration certificates"
        description={`${rows.length} active · bulk-meter systems only`}
        actions={
          <div className="flex items-center gap-2">
            {hasUrgent ? (
              <Badge variant="destructive" className="hidden sm:inline-flex">
                {expiredCount + expiringWeekCount} need attention
              </Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
            >
              <RefreshCcw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        }
      />

      {!loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Expired" value={expiredCount} accent="amber" />
          <StatCard label="Due in 7d" value={expiringWeekCount} accent="amber" />
          <StatCard label="Valid" value={validCount} accent="green" />
        </div>
      ) : null}

      <DataListCard
        title="Certificates"
        count={rows.length}
        loading={loading}
      >
        <DataTableWrap>
          <Table>
            <DataTableHeader>
              <DataTableHead>Tehsil</DataTableHead>
              <DataTableHead>Village</DataTableHead>
              <DataTableHead>UID</DataTableHead>
              <DataTableHead>Uploaded</DataTableHead>
              <DataTableHead>Expiry</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>File</DataTableHead>
              <DataTableHead align="right">Actions</DataTableHead>
            </DataTableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-20 text-center text-sm text-muted-foreground"
                  >
                    No active certificates.
                  </TableCell>
                </TableRow>
              ) : (
                rowsWithExpiry.map(({ row: r, expiry }) => (
                  <TableRow
                    key={r.certificate.id}
                    className={
                      expiry.state === "expired"
                        ? "bg-red-50/40"
                        : expiry.state === "expiring_7d"
                          ? "bg-amber-50/40"
                          : ""
                    }
                  >
                    <TableCell className="font-medium">
                      {r.water_system.tehsil || "—"}
                    </TableCell>
                    <TableCell>{r.water_system.village || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.water_system.unique_identifier || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(r.certificate.uploaded_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(r.certificate.expiry_date)}
                    </TableCell>
                    <TableCell>
                      {expiry.state === "expired" ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : expiry.state === "expiring_7d" ? (
                        <Badge className="border-amber-300 bg-amber-50 text-amber-900">
                          {expiry.daysRemaining === 0
                            ? "Today"
                            : `${expiry.daysRemaining}d`}
                        </Badge>
                      ) : expiry.state === "valid" ? (
                        <Badge variant="secondary">Valid</Badge>
                      ) : (
                        <Badge variant="outline">No date</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {fileNameFromUrl(r.certificate.file_url)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() =>
                            window.open(r.certificate.file_url, "_blank")
                          }
                          title="View file"
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const key =
                              r.water_system.unique_identifier ||
                              r.water_system.id;
                            navigate(
                              `${tehsilRoutes.waterFormEdit(key)}#calibration-certificates-section`,
                            );
                          }}
                        >
                          Update
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableWrap>
      </DataListCard>
    </PageShell>
  );
}
