import { useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Droplets } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataGrid from "@/components/DataGrid";
import { PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DataGridSkeleton from "@/components/DataGridSkeleton";
import { hqRoutes } from "@/constants/routes";
import { getApiErrorMessage } from "@/lib/api-error";
import ExecutiveScopeFiltersCard from "./ExecutiveScopeFiltersCard";
import { useWaterAnalysisColumns } from "./executiveAnalysisColumns";
import type { WaterSystemDetailRow } from "./executiveAnalysisTypes";
import { useExecutiveScopeFilters } from "./useExecutiveScopeFilters";
import { useExecutiveWaterSystemsDetail } from "./useExecutiveAnalysisQueries";

const ExecutiveWaterAnalysis = () => {
  const scope = useExecutiveScopeFilters();
  const baseColumns = useWaterAnalysisColumns();
  const location = useLocation();

  const { data: rows = [], isLoading, error } = useExecutiveWaterSystemsDetail(
    scope.apiFilters,
    scope.allowedTehsils,
  );

  const columns = useMemo<Array<ColumnDef<WaterSystemDetailRow>>>(
    () => [
      ...baseColumns,
      {
        id: "actions",
        header: "Actions",
        meta: { filterVariant: "none" },
        cell: ({ row }) => {
          const systemId = row.original.water_system_id;
          const navState = {
            from: location.pathname + location.search,
            metrics: row.original,
            year: scope.apiFilters.year,
            ...(scope.apiFilters.month != null
              ? { month: scope.apiFilters.month }
              : {}),
          };

          return (
            <Link
              to={hqRoutes.waterSystem(systemId)}
              state={navState}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              Explore
              <ChevronRight className="size-3.5" />
            </Link>
          );
        },
      },
    ],
    [baseColumns, scope.apiFilters.year, scope.apiFilters.month, location.pathname, location.search],
  );

  const getRowId = useCallback(
    (row: WaterSystemDetailRow) => row.water_system_id,
    [],
  );

  const errorMessage = error
    ? getApiErrorMessage(error, "Failed to load water system analysis")
    : "";

  return (
    <PageShell>
      <PageHeader
        icon={<Droplets className="text-blue-600" />}
        title="Water analysis"
        description="Area & period filters, then search the list."
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

      {isLoading ? (
        <DataGridSkeleton rows={10} columns={9} />
      ) : errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : (
        <DataGrid
          title="Sites"
          rows={rows}
          columns={columns}
          exportFileName={`water-systems-${scope.activeFilters.year}-${scope.activeFilters.tehsil}`}
          getRowId={getRowId}
          initialPageSize={25}
        />
      )}
    </PageShell>
  );
};

export default ExecutiveWaterAnalysis;
