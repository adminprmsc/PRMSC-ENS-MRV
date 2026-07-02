import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Sun } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataGrid from "@/components/DataGrid";
import { PageHeader, PageShell, StatCard } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DataGridSkeleton, {
  ExecutiveKpiCardsSkeleton,
} from "@/components/DataGridSkeleton";
import { hqRoutes } from "@/constants/routes";
import { useProgramDashboardApi } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import ExecutiveScopeFiltersCard from "./ExecutiveScopeFiltersCard";
import { fetchScopedSolarSystems } from "./fetchExecutiveScopedDashboard";
import { useSolarAnalysisColumns } from "./executiveAnalysisColumns";
import type { SolarSystemDetailRow } from "./executiveAnalysisTypes";
import { useExecutiveScopeFilters } from "./useExecutiveScopeFilters";

const ExecutiveSolarAnalysis = () => {
  const { getDashboardSolarSystemsDetail } = useProgramDashboardApi();
  const scope = useExecutiveScopeFilters();
  const baseColumns = useSolarAnalysisColumns();

  const [rows, setRows] = useState<SolarSystemDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const columns = useMemo<Array<ColumnDef<SolarSystemDetailRow>>>(
    () => [
      ...baseColumns,
      {
        id: "actions",
        header: "Actions",
        meta: { filterVariant: "none" },
        cell: ({ row }) => (
          <Link
            to={hqRoutes.solarSite(row.original.solar_system_id)}
            state={{
              from: "/hq/solar",
              metrics: row.original,
              year: scope.apiFilters.year,
            }}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            Explore
            <ChevronRight className="size-3.5" />
          </Link>
        ),
      },
    ],
    [baseColumns, scope.apiFilters.year],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const list = await fetchScopedSolarSystems(
          getDashboardSolarSystemsDetail,
          scope.apiFilters,
          scope.allowedTehsils,
        );
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Failed to load solar system analysis"));
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [scope.apiFilters, scope.allowedTehsils, getDashboardSolarSystemsDetail]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        export: acc.export + (r.total_export_kwh ?? 0),
        import: acc.import + (r.total_import_kwh ?? 0),
        net: acc.net + (r.total_net_kwh ?? 0),
      }),
      { export: 0, import: 0, net: 0 },
    );
  }, [rows]);

  const getRowId = useCallback((row: SolarSystemDetailRow) => row.solar_system_id, []);

  return (
    <PageShell>
      <PageHeader
        icon={<Sun className="text-amber-600" />}
        title="Solar system analysis"
        description="Paginated registry for your assigned tehsils. Explore any site to view profile and monthly energy records."
      />

      <ExecutiveScopeFiltersCard
        filters={scope.filters}
        activeScopeLabel={scope.activeScopeLabel}
        tehsilOptions={scope.tehsilOptions}
        villageOptions={scope.villageOptions}
        onUpdate={scope.updateFilter}
        onApply={scope.applyFilters}
      />

      {loading ? (
        <div className="space-y-4">
          <ExecutiveKpiCardsSkeleton count={4} />
          <DataGridSkeleton rows={10} columns={9} />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Sites in scope" value={rows.length} accent="amber" />
            <StatCard
              label="Total export"
              value={`${totals.export.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`}
              accent="amber"
            />
            <StatCard
              label="Total import"
              value={`${totals.import.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`}
              accent="slate"
            />
            <StatCard
              label="Total net"
              value={`${totals.net.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`}
              accent="green"
            />
          </div>

          <DataGrid
            title="Solar sites registry"
            description="Use pagination below the table. Explore opens the site profile and paginated monthly records."
            rows={rows}
            columns={columns}
            exportFileName={`solar-systems-${scope.activeFilters.year}-${scope.activeFilters.tehsil}`}
            getRowId={getRowId}
            initialPageSize={25}
          />
        </>
      )}
    </PageShell>
  );
};

export default ExecutiveSolarAnalysis;
