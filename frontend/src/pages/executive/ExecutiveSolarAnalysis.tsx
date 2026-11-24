import { useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Sun } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataGrid from "@/components/DataGrid";
import { PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DataGridSkeleton from "@/components/DataGridSkeleton";
import { hqRoutes } from "@/constants/routes";
import { getApiErrorMessage } from "@/lib/api-error";
import ExecutiveScopeFiltersCard from "./ExecutiveScopeFiltersCard";
import { useSolarAnalysisColumns } from "./executiveAnalysisColumns";
import type { SolarSystemDetailRow } from "./executiveAnalysisTypes";
import { useExecutiveScopeFilters } from "./useExecutiveScopeFilters";
import { HQ_NEW_TAB_LINK_PROPS, withHqReturnPath } from "@/lib/hqDetailLink";
import { useExecutiveSolarSystemsDetail } from "./useExecutiveAnalysisQueries";
import {
  ALL_MONTHS,
  executivePeriodExportSlug,
  executivePeriodLabel,
  withPeriodQuery,
} from "./executivePeriodFilters";
import AggregatedTotalsCard, {
  type AggregatedTotal,
} from "./AggregatedTotalsCard";

function kwh(v: number | null | undefined): number {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : 0;
}

const ExecutiveSolarAnalysis = () => {
  const scope = useExecutiveScopeFilters({ periodFilterMode: "year-only" });
  const baseColumns = useSolarAnalysisColumns();
  const location = useLocation();
  /** Solar analysis is year-only (or a custom range) — never a single month. */
  const period = useMemo(
    () => ({ ...scope.activeFilters, month: ALL_MONTHS }),
    [scope.activeFilters],
  );

  const {
    data: rows = [],
    isLoading,
    error,
  } = useExecutiveSolarSystemsDetail(scope.apiFilters, scope.allowedTehsils);

  const columns = useMemo<Array<ColumnDef<SolarSystemDetailRow>>>(
    () => [
      ...baseColumns,
      {
        id: "actions",
        header: "Actions",
        meta: { filterVariant: "none" },
        cell: ({ row }) => (
          <Link
            to={withHqReturnPath(
              withPeriodQuery(
                hqRoutes.solarSite(row.original.solar_system_id),
                period,
              ),
              location.pathname + location.search,
            )}
            state={{
              from: location.pathname + location.search,
              metrics: row.original,
            }}
            {...HQ_NEW_TAB_LINK_PROPS}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            Explore
            <ChevronRight className="size-3.5" />
          </Link>
        ),
      },
    ],
    [baseColumns, location.pathname, location.search, period],
  );

  const aggregatedTotals = useMemo<AggregatedTotal[]>(() => {
    let exportPeak = 0;
    let importPeak = 0;
    let exportOffPeak = 0;
    let importOffPeak = 0;
    for (const row of rows) {
      // Peak / off-peak split only exists for time-of-use (TOU) metered sites.
      if (!row.any_tou_required) continue;
      exportPeak += kwh(row.total_export_peak_kwh);
      importPeak += kwh(row.total_import_peak_kwh);
      exportOffPeak += kwh(row.total_export_off_peak_kwh);
      importOffPeak += kwh(row.total_import_off_peak_kwh);
    }
    let preGreenKwh = 0;
    let preGreenMonths = 0;
    for (const row of rows) {
      preGreenKwh += kwh(row.pre_green_consumed_kwh);
      preGreenMonths += Number(row.pre_green_months_logged ?? 0);
    }
    const hint =
      "Sum across sites with time-of-use (peak / off-peak) metering.";
    const preHint =
      "Units consumed in months logged before each site's green meter (nothing exported). Not included in import/export above.";
    return [
      { label: "Total peak export", value: exportPeak, unit: "kWh", hint },
      { label: "Total peak import", value: importPeak, unit: "kWh", hint },
      {
        label: "Total off-peak export",
        value: exportOffPeak,
        unit: "kWh",
        hint,
      },
      {
        label: "Total off-peak import",
        value: importOffPeak,
        unit: "kWh",
        hint,
      },
      {
        label: "Consumed before green meter",
        value: preGreenKwh,
        unit: "kWh",
        hint: preHint,
      },
      {
        label: "Months before green meter",
        value: preGreenMonths,
        unit: "site-months",
        hint: preHint,
      },
    ];
  }, [rows]);

  const getRowId = useCallback(
    (row: SolarSystemDetailRow) => row.solar_system_id,
    [],
  );

  const errorMessage = error
    ? getApiErrorMessage(error, "Failed to load solar system analysis")
    : "";

  return (
    <PageShell>
      <PageHeader
        icon={<Sun className="text-amber-600" />}
        title="Solar analysis"
        description="Area, period, and settlement filters — then open a site to review records."
      />

      <ExecutiveScopeFiltersCard
        filters={scope.filters}
        activeScopeLabel={scope.activeScopeLabel}
        tehsilOptions={scope.tehsilOptions}
        villageOptions={scope.villageOptions}
        settlementOptions={scope.settlementOptions}
        villageEnabled={scope.villageEnabled}
        settlementEnabled={scope.settlementEnabled}
        periodFilterMode="year-only"
        dataKind="solar"
        locationMeta={scope.locationMeta}
        locationsLoading={scope.catalogLoading}
        onUpdate={scope.updateFilter}
        onUpdateMany={scope.updateFilters}
        onApply={scope.applyFilters}
      />

      {isLoading ? (
        <DataGridSkeleton rows={10} columns={9} />
      ) : errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : (
        <>
          <AggregatedTotalsCard
            title="Aggregated solar energy"
            exportTitle="Solar analysis — aggregated totals"
            exportFileName={`solar-aggregated-${executivePeriodExportSlug(period)}-${scope.activeFilters.tehsil}-${scope.activeFilters.village}`}
            scopeLabel={scope.activeScopeLabel}
            periodLabel={executivePeriodLabel(period)}
            siteCount={rows.length}
            totals={aggregatedTotals}
          />
          <DataGrid
            title="Sites"
            rows={rows}
            columns={columns}
            exportFileName={`solar-systems-${executivePeriodExportSlug(period)}-${scope.activeFilters.tehsil}-${scope.activeFilters.village}`}
            getRowId={getRowId}
            initialPageSize={25}
          />
        </>
      )}
    </PageShell>
  );
};

export default ExecutiveSolarAnalysis;
