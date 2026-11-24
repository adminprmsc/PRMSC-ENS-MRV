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
import { HQ_NEW_TAB_LINK_PROPS, withHqReturnPath } from "@/lib/hqDetailLink";
import { useExecutiveWaterSystemsDetail } from "./useExecutiveAnalysisQueries";
import {
  executivePeriodExportSlug,
  executivePeriodLabel,
  withPeriodQuery,
} from "./executivePeriodFilters";
import AggregatedTotalsCard, {
  type AggregatedTotal,
} from "./AggregatedTotalsCard";
import { estimatedTotalM3, meterTotalM3 } from "./waterAnalysisVolume";

const ExecutiveWaterAnalysis = () => {
  const scope = useExecutiveScopeFilters();
  const location = useLocation();

  const {
    data: rows = [],
    isLoading,
    error,
  } = useExecutiveWaterSystemsDetail(scope.apiFilters, scope.allowedTehsils);

  const baseColumns = useWaterAnalysisColumns(rows);

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
          };

          return (
            <Link
              to={withHqReturnPath(
                withPeriodQuery(
                  hqRoutes.waterSystem(systemId),
                  scope.activeFilters,
                ),
                location.pathname + location.search,
              )}
              state={navState}
              {...HQ_NEW_TAB_LINK_PROPS}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              Explore
              <ChevronRight className="size-3.5" />
            </Link>
          );
        },
      },
    ],
    [baseColumns, scope.activeFilters, location.pathname, location.search],
  );

  const aggregatedTotals = useMemo<AggregatedTotal[]>(() => {
    let bulk = 0;
    let calculated = 0;
    for (const row of rows) {
      bulk += meterTotalM3(row) ?? 0;
      calculated += estimatedTotalM3(row) ?? 0;
    }
    return [
      {
        label: "Total water supply (bulk meter)",
        value: bulk,
        unit: "m³",
        hint: "Sum of logged bulk meter intervals at sites with a bulk meter.",
      },
      {
        label: "Total calculated water supply (pump hours)",
        value: calculated,
        unit: "m³",
        hint: "η × pump flow rate × hours tubewell operated, at sites without a bulk meter.",
      },
      {
        label: "Total aggregated water supply",
        value: bulk + calculated,
        unit: "m³",
        hint: "Bulk meter supply + calculated supply.",
        emphasis: true,
      },
    ];
  }, [rows]);

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
        description="Without bulk meter: calculated m³ (η × flow × runtime). With bulk meter: pumped m³ from logged meter intervals."
      />

      <ExecutiveScopeFiltersCard
        dataKind="water"
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
        onUpdateMany={scope.updateFilters}
        onApply={scope.applyFilters}
      />

      {isLoading ? (
        <DataGridSkeleton rows={10} columns={12} />
      ) : errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : (
        <>
          <AggregatedTotalsCard
            title="Aggregated water supply"
            exportTitle="Water analysis — aggregated totals"
            exportFileName={`water-aggregated-${executivePeriodExportSlug(scope.activeFilters)}-${scope.activeFilters.tehsil}`}
            scopeLabel={scope.activeScopeLabel}
            periodLabel={executivePeriodLabel(scope.activeFilters)}
            siteCount={rows.length}
            totals={aggregatedTotals}
          />
          <DataGrid
            title="Sites"
            rows={rows}
            columns={columns}
            exportFileName={`water-systems-${executivePeriodExportSlug(scope.activeFilters)}-${scope.activeFilters.tehsil}`}
            getRowId={getRowId}
            initialPageSize={25}
          />
        </>
      )}
    </PageShell>
  );
};

export default ExecutiveWaterAnalysis;
