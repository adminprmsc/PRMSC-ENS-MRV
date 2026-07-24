import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Droplets, Eye, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";

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
} from "../../../components/layout";
import { TypeToConfirmDeleteDialog } from "../../../components/TypeToConfirmDeleteDialog";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  listSiteDeleteRequests,
  type SiteDeleteRequestRow,
} from "../../../services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "../../../types/api";
import { formatPakistanDateTime } from "../../../utils/pakistanTime";

export default function WaterSystems() {
  const navigate = useNavigate();
  const { getWaterSystems, deleteWaterSystem } = useTehsilManagerOperatorApi();

  const [systems, setSystems] = useState<WaterSystemRow[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<
    Record<string, SiteDeleteRequestRow>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<WaterSystemRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const [data, reqs] = await Promise.all([
        getWaterSystems({ page: 1, limit: 100 }),
        listSiteDeleteRequests("pending").catch(() => ({ requests: [] })),
      ]);
      setSystems(Array.isArray(data) ? (data as WaterSystemRow[]) : []);
      const map: Record<string, SiteDeleteRequestRow> = {};
      for (const r of reqs.requests ?? []) {
        if (r.resource_type === "water") map[r.resource_id] = r;
      }
      setPendingDeletes(map);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load water systems"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) =>
      [s.tehsil, s.village, s.settlement, s.unique_identifier, s.pump_model, s.id]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [systems, search]);

  const bulkMeterCount = useMemo(
    () => filtered.filter((s) => s.bulk_meter_installed === true).length,
    [filtered],
  );

  const confirmDelete = async (reason: string) => {
    if (!pendingDelete?.id) return;
    setDeleting(true);
    try {
      await deleteWaterSystem(pendingDelete.id, reason);
      setPendingDelete(null);
      toast.success(
        "Delete request submitted. Waiting for Manager Operations approval.",
      );
      await load(true);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Delete failed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={<Droplets />}
        title="Water systems"
        description={`${filtered.length} registered · ${bulkMeterCount} with bulk meter`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCcw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate(tehsilRoutes.waterForm)}>
              <Plus className="size-4" />
              Register
            </Button>
          </div>
        }
      />

      <TypeToConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
        resourceKind="water system"
        confirmSiteId={String(pendingDelete?.unique_identifier || "")}
        resourceName={String(
          pendingDelete?.unique_identifier ||
            pendingDelete?.village ||
            "this water system",
        )}
        confirming={deleting}
        onConfirm={(reason) => void confirmDelete(reason)}
      />

      <DataListCard
        loading={loading}
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tehsil, village, UID, pump model…"
      >
        <DataTableWrap>
          <Table>
            <DataTableHeader>
              <DataTableHead>Location</DataTableHead>
              <DataTableHead>UID</DataTableHead>
              <DataTableHead>Meter</DataTableHead>
              <DataTableHead>Pump</DataTableHead>
              <DataTableHead>Updated</DataTableHead>
              <DataTableHead align="right">Actions</DataTableHead>
            </DataTableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <DataTableEmpty colSpan={6} />
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{kv(s.village)}</p>
                      <p className="text-xs text-muted-foreground">
                        {kv(s.tehsil)}
                        {s.settlement ? ` · ${s.settlement}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{kv(s.unique_identifier)}</span>
                        {pendingDeletes[String(s.id)] ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-[10px] text-amber-900"
                          >
                            Delete pending
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.bulk_meter_installed ? "default" : "outline"
                        }
                      >
                        {s.bulk_meter_installed ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{kv(s.pump_model)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatPakistanDateTime(s.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigate(tehsilRoutes.waterSystemView(s.id))
                          }
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (!s.unique_identifier) {
                              toast.error("No UID — cannot edit.");
                              return;
                            }
                            navigate(
                              tehsilRoutes.waterFormEdit(s.unique_identifier),
                            );
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          disabled={deleting || Boolean(pendingDeletes[String(s.id)])}
                          title={
                            pendingDeletes[String(s.id)]
                              ? "Delete already pending approval"
                              : "Request site deletion"
                          }
                          onClick={() => {
                            if (!s.unique_identifier) {
                              toast.error("No UID — cannot delete.");
                              return;
                            }
                            setPendingDelete(s);
                          }}
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
    </PageShell>
  );
}
