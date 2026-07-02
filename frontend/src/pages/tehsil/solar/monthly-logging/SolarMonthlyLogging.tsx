import { useMemo, useState } from "react";
import {
  DataListCard,
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
  PageHeader,
  PageShell,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "../../../../components/layout";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarRange,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";

import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
} from "../../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Label } from "../../../../components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../components/ui/native-select";
import { tehsilRoutes } from "../../../../constants/routes";
import { useSolarMonthlyLogs, useTehsilManagerOperatorApi } from "../../../../hooks";
import { getApiErrorMessage } from "../../../../lib/api-error";
import type { SolarMonthlyLogTableRow } from "../../../../types/api";
import { formatPakistanDateTime, getPakistanYear } from "../../../../utils/pakistanTime";

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
];

function formatNum(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

const currentYear = getPakistanYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);

export default function SolarMonthlyLogging() {
  const navigate = useNavigate();
  const location = useLocation();
  const [year, setYear] = useState(currentYear);
  const { rows, loading, error, refetch } = useSolarMonthlyLogs(year);
  const { deleteSolarSupplyRecord } = useTehsilManagerOperatorApi();

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SolarMonthlyLogTableRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const monthLabel = MONTH_NAMES[r.month] ?? String(r.month);
      const blob = [
        r.tehsil,
        r.village,
        r.settlement,
        String(r.year),
        monthLabel,
        String(r.month),
        r.remarks ?? "",
        r.id,
        r.solar_system_id,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success("Logs refreshed");
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Refresh failed"));
    } finally {
      setRefreshing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSolarSupplyRecord(deleteTarget.id);
      toast.success("Monthly record deleted");
      setDeleteTarget(null);
      await refetch();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Delete failed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={<CalendarRange />}
        title="Solar monthly logging"
        description={`${filtered.length} records · ${year}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              id="sml-year"
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 w-[100px]"
            >
              {YEAR_OPTIONS.map((y) => (
                <NativeSelectOption key={y} value={String(y)}>
                  {y}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onRefresh()}
              disabled={refreshing || loading}
            >
              <RefreshCcw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() =>
                navigate(tehsilRoutes.solarEnergyAdd, {
                  state: { from: `${location.pathname}${location.search}` },
                })
              }
            >
              <Plus className="size-4" />
              Add log
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-4 text-sm text-amber-900">{error}</CardContent>
        </Card>
      ) : null}

      <DataListCard
        title="Monthly records"
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Location, month, remarks…"
        loading={loading}
      >
        <DataTableWrap>
          <Table>
            <DataTableHeader>
              <DataTableHead>Location</DataTableHead>
              <DataTableHead>Period</DataTableHead>
              <DataTableHead>Mode</DataTableHead>
              <DataTableHead align="right">Import (kWh)</DataTableHead>
              <DataTableHead align="right">Export (kWh)</DataTableHead>
              <DataTableHead align="right">Net (kWh)</DataTableHead>
              <DataTableHead>Bill</DataTableHead>
              <DataTableHead>Updated</DataTableHead>
              <DataTableHead align="right">Actions</DataTableHead>
            </DataTableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-20 text-center text-sm text-muted-foreground"
                  >
                    No logs for {year}.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.village}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.tehsil}
                        {r.settlement ? ` · ${r.settlement}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {MONTH_NAMES[r.month] ?? r.month} {r.year}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.tou_required === false ? "Total" : "TOU"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {r.tou_required === false
                        ? formatNum(r.import_total ?? r.import_off_peak)
                        : `${formatNum(r.import_off_peak)} / ${formatNum(r.import_peak)}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {r.tou_required === false
                        ? formatNum(r.export_total ?? r.export_off_peak)
                        : `${formatNum(r.export_off_peak)} / ${formatNum(r.export_peak)}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {r.tou_required === false
                        ? formatNum(r.net_total ?? r.net_off_peak)
                        : `${formatNum(r.net_off_peak)} / ${formatNum(r.net_peak)}`}
                    </TableCell>
                    <TableCell>
                      {r.electricity_bill_image_url?.trim() ? (
                        <a
                          href={r.electricity_bill_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          View
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatPakistanDateTime(r.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() =>
                            navigate(tehsilRoutes.solarMonthlyLogEdit(r.id), {
                              state: {
                                from: `${location.pathname}${location.search}`,
                              },
                            })
                          }
                          title="Edit"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(r)}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
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

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete monthly log?</DialogTitle>
            <DialogDescription>
              This removes the record for{" "}
              <span className="font-medium text-foreground">
                {deleteTarget
                  ? `${MONTH_NAMES[deleteTarget.month] ?? deleteTarget.month} ${deleteTarget.year}`
                  : ""}
              </span>{" "}
              at {deleteTarget?.village}
              {deleteTarget?.settlement
                ? ` · ${deleteTarget.settlement}`
                : ""}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
