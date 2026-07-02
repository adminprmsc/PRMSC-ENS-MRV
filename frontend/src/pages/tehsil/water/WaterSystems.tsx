import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Droplets, Eye, Pencil, Plus, RefreshCcw } from "lucide-react";

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
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import type { WaterSystemRow } from "../../../types/api";
import { formatPakistanDateTime } from "../../../utils/pakistanTime";

export default function WaterSystems() {
  const navigate = useNavigate();
  const { getWaterSystems } = useTehsilManagerOperatorApi();

  const [systems, setSystems] = useState<WaterSystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = await getWaterSystems({ page: 1, limit: 100 });
      setSystems(Array.isArray(data) ? (data as WaterSystemRow[]) : []);
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
                      {kv(s.unique_identifier)}
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
