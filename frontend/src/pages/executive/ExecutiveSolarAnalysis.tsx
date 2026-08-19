import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Sun } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataGrid from "@/components/DataGrid";
import { PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DataGridSkeleton from "@/components/DataGridSkeleton";
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
  const location = useLocation();

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
              from: location.pathname + location.search,
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
    [baseColumns, scope.apiFilters.year, location.pathname, location.search],
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

  const getRowId = useCallback((row: SolarSystemDetailRow) => row.solar_system_id, []);

  return (
    <PageShell>
      <PageHeader
        icon={<Sun className="text-amber-600" />}
        title="Solar analysis"
        description="Filter by area and year, then open a site to review monthly records."
      />

      <ExecutiveScopeFiltersCard
        filters={scope.filters}
        activeScopeLabel={scope.activeScopeLabel}
        tehsilOptions={scope.tehsilOptions}
        villageOptions={scope.villageOptions}
        settlementOptions={scope.settlementOptions}
        villageEnabled={scope.villageEnabled}
        settlementEnabled={scope.settlementEnabled}
        locationMeta={scope.locationMeta}
        locationsLoading={scope.catalogLoading}
        onUpdate={scope.updateFilter}
        onApply={scope.applyFilters}
      />

      {loading ? (
        <DataGridSkeleton rows={10} columns={9} />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <DataGrid
          title="Sites"
          rows={rows}
          columns={columns}
          exportFileName={`solar-systems-${scope.activeFilters.year}-${scope.activeFilters.tehsil}`}
          getRowId={getRowId}
          initialPageSize={25}
        />
      )}
    </PageShell>
  );
};

export default ExecutiveSolarAnalysis;
