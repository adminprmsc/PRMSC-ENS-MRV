import { useCallback, useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
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
import {
  estimatedTotalM3,
  hasHourlyData,
  hasMeterData,
  meterTotalM3,
  type WaterSourceFilter,
} from "./waterAnalysisVolume";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS: Array<{
  value: WaterSourceFilter;
  label: string;
  hint: string;
}> = [
  { value: "all", label: "All sources", hint: "Bulk meter + pump-hours estimate" },
  { value: "bulk", label: "Bulk meter only", hint: "Meter readings from each site's bulk cutover" },
  { value: "hourly", label: "Estimate only", hint: "η × flow × pump hours before the cutover / without a meter" },
];

const ExecutiveWaterAnalysis = () => {
  const scope = useExecutiveScopeFilters();
  const location = useLocation();

  const {
    data: allRows = [],
    isLoading,
    error,
  } = useExecutiveWaterSystemsDetail(scope.apiFilters, scope.allowedTehsils);

  // Data source view — kept in the URL so links/exports are reproducible.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSource = searchParams.get("source");
  const source: WaterSourceFilter =
    rawSource === "bulk" || rawSource === "hourly" ? rawSource : "all";
  const setSource = (next: WaterSourceFilter) =>
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "all") p.delete("source");
        else p.set("source", next);
        return p;
      },
      { replace: true },
    );

  // Bulk-only / estimate-only views list just the sites with that data.
  const rows = useMemo(
    () =>
      source === "bulk"
        ? allRows.filter(hasMeterData)
        : source === "hourly"
          ? allRows.filter(hasHourlyData)
          : allRows,
    [allRows, source],
  );

  const baseColumns = useWaterAnalysisColumns(rows, source);

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
    const bulkTotal: AggregatedTotal = {
      label: "Total water supply (bulk meter)",
      value: bulk,
      unit: "m³",
      hint: "Metered intervals from each site's bulk cutover onward.",
    };
    const calcTotal: AggregatedTotal = {
      label: "Total calculated water supply (pump hours)",
      value: calculated,
      unit: "m³",
      hint: "η × pump flow rate × pump hours — sites without a bulk meter, and days before a site's bulk cutover.",
    };
    if (source === "bulk") return [{ ...bulkTotal, emphasis: true }];
    if (source === "hourly") return [{ ...calcTotal, emphasis: true }];
    return [
      bulkTotal,
      calcTotal,
      {
        label: "Total aggregated water supply",
        value: bulk + calculated,
        unit: "m³",
        hint: "Bulk meter + calculated. Each log uses one source, so no date is counted twice.",
        emphasis: true,
      },
    ];
  }, [rows, source]);

  const sourceSlug = source === "all" ? "" : `-${source === "bulk" ? "bulk-meter" : "estimate"}-only`;

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

      <div
        role="radiogroup"
        aria-label="Data source"
        className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-sm font-semibold">Data source</p>
          <p className="text-xs text-muted-foreground">
            {SOURCE_OPTIONS.find((o) => o.value === source)?.hint}. The table,
            totals and Excel export follow this choice.
          </p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border">
          {SOURCE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={source === o.value}
              onClick={() => setSource(o.value)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors sm:text-sm [&:not(:first-child)]:border-l",
                source === o.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

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
            exportFileName={`water-aggregated${sourceSlug}-${executivePeriodExportSlug(scope.activeFilters)}-${scope.activeFilters.tehsil}`}
            scopeLabel={scope.activeScopeLabel}
            periodLabel={executivePeriodLabel(scope.activeFilters)}
            siteCount={rows.length}
            totals={aggregatedTotals}
          />
          <DataGrid
            key={source}
            title="Sites"
            rows={rows}
            columns={columns}
            exportFileName={`water-systems${sourceSlug}-${executivePeriodExportSlug(scope.activeFilters)}-${scope.activeFilters.tehsil}`}
            getRowId={getRowId}
            initialPageSize={25}
          />
        </>
      )}
    </PageShell>
  );
};

export default ExecutiveWaterAnalysis;
