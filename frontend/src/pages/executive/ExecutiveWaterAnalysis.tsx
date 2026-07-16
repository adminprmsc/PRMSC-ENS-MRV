import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Droplets, FileText } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import DataGrid from "@/components/DataGrid";
import { PageHeader, PageShell, StatCard } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DataGridSkeleton, {
  ExecutiveKpiCardsSkeleton,
} from "@/components/DataGridSkeleton";
import { hqRoutes } from "@/constants/routes";
import { useProgramDashboardApi, useTehsilManagerOperatorApi } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import ExecutiveScopeFiltersCard from "./ExecutiveScopeFiltersCard";
import { fetchScopedWaterSystems } from "./fetchExecutiveScopedDashboard";
import { useWaterAnalysisColumns } from "./executiveAnalysisColumns";
import type { WaterSystemDetailRow } from "./executiveAnalysisTypes";
import { useExecutiveScopeFilters } from "./useExecutiveScopeFilters";
import {
  fetchRegisteredLocationSites,
  type RegisteredLocationSite,
} from "./registeredLocationOptions";
import {
  latestAcceptedByWaterSystem,
  useHqSubmissions,
} from "./useHqSubmissions";

const ExecutiveWaterAnalysis = () => {
  const { getDashboardWaterSystemsDetail } = useProgramDashboardApi();
  const { getWaterSystems } = useTehsilManagerOperatorApi();
  const [locationSites, setLocationSites] = useState<RegisteredLocationSite[]>(
    [],
  );
  const [locationsLoading, setLocationsLoading] = useState(true);
  const scope = useExecutiveScopeFilters(locationSites);
  const baseColumns = useWaterAnalysisColumns();
  const { submissions } = useHqSubmissions();

  const latestLogBySystem = useMemo(
    () => latestAcceptedByWaterSystem(submissions),
    [submissions],
  );

  const [rows, setRows] = useState<WaterSystemDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const allowedTehsilsKey = scope.allowedTehsils.join("|");

  useEffect(() => {
    let cancelled = false;
    const loadLocations = async () => {
      setLocationsLoading(true);
      try {
        const sites = await fetchRegisteredLocationSites(
          getWaterSystems,
          scope.allowedTehsils,
        );
        if (!cancelled) setLocationSites(sites);
      } catch {
        if (!cancelled) setLocationSites([]);
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    };
    void loadLocations();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when assigned tehsils change
  }, [getWaterSystems, allowedTehsilsKey]);

  const columns = useMemo<Array<ColumnDef<WaterSystemDetailRow>>>(
    () => [
      ...baseColumns,
      {
        id: "actions",
        header: "Actions",
        meta: { filterVariant: "none" },
        cell: ({ row }) => {
          const systemId = row.original.water_system_id;
          const latest = latestLogBySystem.get(systemId);
          const navState = {
            from: "/hq/water",
            metrics: row.original,
            year: scope.apiFilters.year,
            ...(scope.apiFilters.month != null
              ? { month: scope.apiFilters.month }
              : {}),
          };

          return (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={hqRoutes.waterSystem(systemId)}
                state={navState}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                Explore
                <ChevronRight className="size-3.5" />
              </Link>
              {latest ? (
                <Link
                  to={hqRoutes.waterSubmissionDetails(latest.id)}
                  state={{ from: hqRoutes.waterSystem(systemId), systemId }}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <FileText className="size-3.5" />
                  Latest log
                </Link>
              ) : null}
            </div>
          );
        },
      },
    ],
    [baseColumns, latestLogBySystem, scope.apiFilters.year, scope.apiFilters.month],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const list = await fetchScopedWaterSystems(
          getDashboardWaterSystemsDetail,
          scope.apiFilters,
          scope.allowedTehsils,
        );
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) {
          setError(
            getApiErrorMessage(err, "Failed to load water system analysis"),
          );
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
  }, [scope.apiFilters, scope.allowedTehsils, getDashboardWaterSystemsDetail]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        water: acc.water + (r.total_water_pumped_m3 ?? 0),
        hours: acc.hours + (r.total_pump_hours_h ?? 0),
      }),
      { water: 0, hours: 0 },
    );
  }, [rows]);

  const getRowId = useCallback(
    (row: WaterSystemDetailRow) => row.water_system_id,
    [],
  );

  return (
    <PageShell>
      <PageHeader
        icon={<Droplets className="text-blue-600" />}
        title="Water system analysis"
        description="Paginated registry for your assigned tehsils. Explore a system for full profile and logs, or open the latest accepted log directly."
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
        locationsLoading={locationsLoading}
        onUpdate={scope.updateFilter}
        onApply={scope.applyFilters}
      />

      {loading ? (
        <div className="space-y-4">
          <ExecutiveKpiCardsSkeleton count={3} />
          <DataGridSkeleton rows={10} columns={8} />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Systems in scope"
              value={rows.length}
              accent="blue"
            />
            <StatCard
              label="Total pumped (intervals)"
              value={`${totals.water.toLocaleString(undefined, { maximumFractionDigits: 0 })} m³`}
              accent="blue"
            />
            <StatCard
              label="Total pump runtime"
              value={`${totals.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`}
              accent="slate"
            />
          </div>

          <DataGrid
            title="Water systems registry"
            description="Use pagination below the table. Explore goes deeper; Latest log opens the most recent accepted submission."
            rows={rows}
            columns={columns}
            exportFileName={`water-systems-${scope.activeFilters.year}-${scope.activeFilters.tehsil}`}
            getRowId={getRowId}
            initialPageSize={25}
          />
        </>
      )}
    </PageShell>
  );
};

export default ExecutiveWaterAnalysis;
