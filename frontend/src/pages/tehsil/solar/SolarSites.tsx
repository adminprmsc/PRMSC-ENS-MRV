import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Pencil, Plus, RefreshCcw, Sun, Zap } from "lucide-react";

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
import { Button } from "../../../components/ui/button";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import type { SolarSystemRow } from "../../../types/api";
import { formatPakistanDateTime } from "../../../utils/pakistanTime";

export default function SolarSites() {
  const navigate = useNavigate();
  const { getSolarSystems } = useTehsilManagerOperatorApi();

  const [sites, setSites] = useState<SolarSystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = await getSolarSystems({});
      setSites(Array.isArray(data) ? (data as SolarSystemRow[]) : []);
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
                      {kv(s.unique_identifier)}
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
