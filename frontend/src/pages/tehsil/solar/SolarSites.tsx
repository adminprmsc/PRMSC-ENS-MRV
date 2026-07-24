import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Pencil, Plus, RefreshCcw, Sun, Trash2, Zap } from "lucide-react";

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
import { Button } from "../../../components/ui/button";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  listSiteDeleteRequests,
  type SiteDeleteRequestRow,
} from "../../../services/tehsilManagerOperatorService";
import type { SolarSystemRow } from "../../../types/api";
import { formatPakistanDateTime } from "../../../utils/pakistanTime";
import { Badge } from "../../../components/ui/badge";

export default function SolarSites() {
  const navigate = useNavigate();
  const { getSolarSystems, deleteSolarSystem } = useTehsilManagerOperatorApi();

  const [sites, setSites] = useState<SolarSystemRow[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<
    Record<string, SiteDeleteRequestRow>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SolarSystemRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const [data, reqs] = await Promise.all([
        getSolarSystems({}),
        listSiteDeleteRequests("pending").catch(() => ({ requests: [] })),
      ]);
      setSites(Array.isArray(data) ? (data as SolarSystemRow[]) : []);
      const map: Record<string, SiteDeleteRequestRow> = {};
      for (const r of reqs.requests ?? []) {
        if (r.resource_type === "solar") map[r.resource_id] = r;
      }
      setPendingDeletes(map);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load solar sites"));
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
    if (!q) return sites;
    return sites.filter((s) =>
      [
        s.tehsil,
        s.village,
        s.settlement,
        s.unique_identifier,
        s.disco_info,
        s.bill_reference_number,
        s.id,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [sites, search]);

  const confirmDelete = async (reason: string) => {
    if (!pendingDelete?.id) return;
    setDeleting(true);
    try {
      await deleteSolarSystem(pendingDelete.id, reason);
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
        icon={<Sun className="text-amber-600" />}
        title="Solar systems"
        description={`${filtered.length} registered sites`}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(tehsilRoutes.solarEnergyAdd)}
            >
              <Zap className="size-4" />
              Monthly log
            </Button>
            <Button size="sm" onClick={() => navigate(tehsilRoutes.solarForm)}>
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
        resourceKind="solar site"
        confirmSiteId={String(pendingDelete?.unique_identifier || "")}
        resourceName={String(
          pendingDelete?.unique_identifier ||
            pendingDelete?.village ||
            "this solar site",
        )}
        confirming={deleting}
        onConfirm={(reason) => void confirmDelete(reason)}
      />

      <DataListCard
        loading={loading}
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tehsil, village, DISCO, bill ref, UID…"
      >
        <DataTableWrap>
          <Table>
            <DataTableHeader>
              <DataTableHead>Location</DataTableHead>
              <DataTableHead>UID</DataTableHead>
              <DataTableHead>DISCO</DataTableHead>
              <DataTableHead>Capacity</DataTableHead>
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
                        {pendingDeletes[String(s.id)] ||
                        (s as SolarSystemRow & { delete_request_pending?: boolean })
                          .delete_request_pending ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-[10px] text-amber-900"
                          >
                            Delete pending
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{kv(s.disco_info)}</TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {s.solar_panel_capacity != null
                        ? `${s.solar_panel_capacity} kW`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatPakistanDateTime(s.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigate(tehsilRoutes.solarSiteView(s.id))
                          }
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigate(tehsilRoutes.solarSiteEdit(s.id))
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          disabled={
                            deleting ||
                            Boolean(pendingDeletes[String(s.id)]) ||
                            Boolean(
                              (
                                s as SolarSystemRow & {
                                  delete_request_pending?: boolean;
                                }
                              ).delete_request_pending,
                            )
                          }
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
