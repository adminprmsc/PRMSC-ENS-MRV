import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { DataGridColumnMeta } from "@/components/DataGrid";
import { CopyableId } from "@/components/common/CopyableId";
import { SolarSiteTypeBadge } from "@/components/SolarSiteTypeBadge";
import { SOLAR_SITE_TYPES } from "@/constants/solarSiteTypes";
import type {
  SolarSystemDetailRow,
  WaterSystemDetailRow,
} from "./executiveAnalysisTypes";
import {
  calculatedTotalM3,
  estimatedAvgDailyM3,
  estimatedAvgHourlyM3,
  estimatedTotalM3,
  hasHourlyData,
  hasMeterData,
  meterAvgDailyM3,
  meterAvgHourlyM3,
  meterTotalM3,
  waterVolumeBasisLabel,
  type WaterSourceFilter,
} from "./waterAnalysisVolume";

export {
  calculatedAvgDailyM3,
  calculatedAvgHourlyM3,
  calculatedTotalM3,
} from "./waterAnalysisVolume";

function fmtNum(v: unknown, maxFrac = 2): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? new Intl.NumberFormat(undefined, {
        maximumFractionDigits: maxFrac,
      }).format(n)
    : "—";
}

function fmtInt(v: unknown): string {
  return fmtNum(v, 0);
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

const NA = <span className="text-muted-foreground text-xs">N/A</span>;

function waterNumCell(v: unknown, fmt: (v: unknown) => string) {
  return isBlank(v) ? NA : <span className="tabular-nums">{fmt(v)}</span>;
}

function waterMeterField(
  row: WaterSystemDetailRow,
  v: unknown,
  fmt: (v: unknown) => string,
  unit = ""
) {
  void row;
  if (isBlank(v)) return "N/A";
  return unit ? `${fmt(v)} ${unit}` : fmt(v);
}

/** Value cell: N/A when this source has no data for the row. */
function volCell(value: number | null, fmt: (v: unknown) => string, title: string) {
  if (value == null || !Number.isFinite(value)) return NA;
  return (
    <span className="tabular-nums" title={title}>
      {fmt(value)}
    </span>
  );
}

const SOURCE_BADGE: Record<string, string> = {
  "Bulk meter":
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  "Estimated (pump hours)":
    "border-border bg-muted/60 text-muted-foreground",
  Mixed:
    "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300",
};

type WaterCol = ColumnDef<WaterSystemDetailRow>;
const none = { filterVariant: "none" } satisfies DataGridColumnMeta;

/**
 * Water analysis columns for a data-source view:
 *  all    — both sources + combined total
 *  bulk   — bulk-meter columns only (meter era hours/days) → bulk-only export
 *  hourly — estimate columns only (estimate era hours/days)
 */
export function useWaterAnalysisColumns(
  rows: WaterSystemDetailRow[] = [],
  source: WaterSourceFilter = "all",
): Array<ColumnDef<WaterSystemDetailRow>> {
  const anyHourly = rows.length === 0 || rows.some(hasHourlyData);
  const anyMeter = rows.length === 0 || rows.some(hasMeterData);
  const showHourly = source === "hourly" || (source === "all" && anyHourly);
  const showMeter = source === "bulk" || (source === "all" && anyMeter);

  return useMemo(() => {
    const identity: WaterCol[] = [
      {
        accessorKey: "unique_identifier",
        header: "System ID",
        // Area/period come from top filters; table search covers ID + place names.
        meta: none,
        cell: ({ getValue }) => (
          <CopyableId value={String(getValue() ?? "")} label="System ID" />
        ),
      },
      { accessorKey: "tehsil", header: "Tehsil", meta: none },
      { accessorKey: "village", header: "Village", meta: none },
      {
        accessorKey: "settlement",
        header: "Settlement",
        meta: none,
        cell: ({ getValue }) => (isBlank(getValue()) ? NA : String(getValue())),
      },
      {
        accessorKey: "start_of_operation",
        header: "Start date",
        meta: none,
        cell: ({ getValue }) =>
          isBlank(getValue()) ? (
            NA
          ) : (
            <span className="tabular-nums whitespace-nowrap">
              {String(getValue())}
            </span>
          ),
      },
      {
        accessorKey: "bulk_meter_installed",
        header: "Bulk meter",
        meta: {
          filterVariant: "select",
          filterOptions: ["Yes", "No"],
        } satisfies DataGridColumnMeta,
        accessorFn: (row) => (row.bulk_meter_installed ? "Yes" : "No"),
        filterFn: (row, _id, value) => {
          if (!value || value === "all") return true;
          const yes = row.original.bulk_meter_installed;
          return value === "Yes" ? yes : !yes;
        },
      },
      {
        accessorKey: "bulk_meter_since",
        header: "Bulk meter since",
        meta: {
          filterVariant: "none",
          headerInfo: (
            <>
              <p className="text-[13px] font-semibold">Bulk meter cutover</p>
              <p className="opacity-90">
                From this date and time only bulk-meter readings count. Logs
                before it use the pump-hours estimate. Each log is counted once.
              </p>
              <p className="opacity-80">
                Set on the water system; if not set, the first meter reading is
                used.
              </p>
            </>
          ),
        } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          row.original.bulk_meter_since ? (
            <span
              className="whitespace-nowrap tabular-nums"
              title={
                row.original.bulk_meter_since_source === "configured"
                  ? "Configured on the water system"
                  : "From the first meter reading (no start configured)"
              }
            >
              {row.original.bulk_meter_since}
              {row.original.bulk_meter_since_source === "first_meter_reading" ? (
                <span className="ml-1 text-[10px] text-muted-foreground">auto</span>
              ) : null}
            </span>
          ) : (
            NA
          ),
      },
    ];

    if (source === "all") {
      identity.push({
        id: "volume_source",
        header: "Volume source",
        accessorFn: (row) => waterVolumeBasisLabel(row),
        meta: {
          filterVariant: "select",
          filterOptions: ["Bulk meter", "Estimated (pump hours)", "Mixed"],
        } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => {
          const v = String(getValue());
          return (
            <span
              className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${SOURCE_BADGE[v] ?? ""}`}
            >
              {v}
            </span>
          );
        },
      });
      identity.push({
        id: "total_water_m3",
        header: "Total water (m³)",
        accessorFn: (row) => calculatedTotalM3(row),
        meta: {
          filterVariant: "none",
          headerInfo: (
            <>
              <p className="text-[13px] font-semibold">All sources combined</p>
              <p className="opacity-90">
                Bulk meter volume (from the cutover) + pump-hours estimate
                (before it). No date is counted twice.
              </p>
            </>
          ),
        } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          volCell(calculatedTotalM3(row.original), fmtInt, "Meter + estimate"),
      });
    }

    const hourly: WaterCol[] = showHourly
      ? [
          {
            id: "ohr_total_m3",
            header: "Total calculated (m³)",
            meta: none,
            accessorFn: (row) => estimatedTotalM3(row),
            cell: ({ row }) =>
              row.original.estimate_inputs_missing ? (
                <span
                  className="whitespace-nowrap text-xs font-medium text-amber-700 dark:text-amber-400"
                  title="Pump hours were logged before the bulk meter, but the site has no design/actual fill time or flow rate, so they can't be estimated. Add them on the water system."
                >
                  Needs fill times
                </span>
              ) : (
                volCell(estimatedTotalM3(row.original), fmtInt, "η × flow × pump hours (before bulk cutover)")
              ),
          },
          {
            id: "ohr_avg_daily_m3",
            header: "Avg daily calculated (m³)",
            meta: none,
            accessorFn: (row) => estimatedAvgDailyM3(row),
            cell: ({ row }) =>
              volCell(estimatedAvgDailyM3(row.original), fmtNum, "Per estimate-era day"),
          },
          {
            id: "ohr_avg_hourly_m3",
            header: "Avg hourly calculated (m³)",
            meta: none,
            accessorFn: (row) => estimatedAvgHourlyM3(row),
            cell: ({ row }) =>
              volCell(estimatedAvgHourlyM3(row.original), fmtNum, "Per estimate-era pump hour"),
          },
        ]
      : [];

    const meter: WaterCol[] = showMeter
      ? [
          {
            id: "meter_total_m3",
            header: "Total pumped (meter, m³)",
            meta: none,
            accessorFn: (row) => meterTotalM3(row),
            cell: ({ row }) =>
              volCell(meterTotalM3(row.original), fmtInt, "Bulk meter intervals from the cutover"),
          },
          {
            id: "meter_avg_daily_m3",
            header: "Avg daily (meter, m³)",
            meta: none,
            accessorFn: (row) => meterAvgDailyM3(row),
            cell: ({ row }) =>
              volCell(meterAvgDailyM3(row.original), fmtNum, "Per metered day"),
          },
          {
            id: "meter_avg_hourly_m3",
            header: "Avg hourly (meter, m³)",
            meta: none,
            accessorFn: (row) => meterAvgHourlyM3(row),
            cell: ({ row }) =>
              volCell(meterAvgHourlyM3(row.original), fmtNum, "Per metered pump hour"),
          },
          {
            accessorKey: "latest_meter_reading_end_m3",
            header: "Latest meter reading (m³)",
            meta: none,
            cell: ({ getValue }) =>
              volCell(getValue() as number | null, fmtInt, "Cumulative reading at the last metered log"),
          },
          {
            accessorKey: "unmetered_bulk_logs",
            header: "Logs missing reading",
            meta: {
              filterVariant: "none",
              headerInfo: (
                <>
                  <p className="text-[13px] font-semibold">Data quality</p>
                  <p className="opacity-90">
                    Logs on/after the bulk cutover without a meter reading.
                    Their pump hours count, but no volume is added — they are
                    not estimated, so the meter is never mixed with estimates.
                  </p>
                </>
              ),
            } satisfies DataGridColumnMeta,
            cell: ({ getValue }) => {
              const n = Number(getValue() ?? 0);
              return n > 0 ? (
                <span className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
                  {fmtInt(n)}
                </span>
              ) : (
                <span className="tabular-nums text-muted-foreground">0</span>
              );
            },
          },
        ]
      : [];

    // Runtime columns follow the selected source's era.
    const hoursKey =
      source === "bulk" ? "bulk_pump_hours_h" : source === "hourly" ? "hourly_pump_hours_h" : "total_pump_hours_h";
    const daysKey =
      source === "bulk" ? "bulk_days_logged" : source === "hourly" ? "hourly_days_logged" : "days_logged";
    const logsKey =
      source === "bulk" ? "bulk_logs_count" : source === "hourly" ? "hourly_logs_count" : "logs_count";
    const runtime: WaterCol[] = [
      {
        accessorKey: hoursKey,
        header: source === "all" ? "Runtime (h)" : source === "bulk" ? "Runtime, meter era (h)" : "Runtime, estimate era (h)",
        meta: none,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtNum),
      },
      {
        accessorKey: daysKey,
        header: source === "all" ? "Days logged" : source === "bulk" ? "Days metered" : "Days estimated",
        meta: none,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtInt),
      },
      {
        accessorKey: logsKey,
        header: "Log entries",
        meta: none,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtInt),
      },
    ];
    if (source === "all") {
      runtime.push({
        accessorKey: "avg_hours_per_day_logged",
        header: "Avg runtime / day (h)",
        meta: none,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtNum),
      });
    }

    return [...identity, ...hourly, ...meter, ...runtime];
  }, [source, showHourly, showMeter]);
}

export function useSolarAnalysisColumns(): Array<
  ColumnDef<SolarSystemDetailRow>
> {
  return useMemo(
    () => [
      {
        accessorKey: "unique_identifier",
        header: "System ID",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <CopyableId value={String(getValue() ?? "")} label="System ID" />
        ),
      },
      {
        id: "site_type",
        accessorFn: (row) => row.site_type?.trim() || "Not set",
        header: "Site type",
        meta: {
          filterVariant: "select",
          filterOptions: [...SOLAR_SITE_TYPES, "Not set"],
        } satisfies DataGridColumnMeta,
        cell: ({ row }) => (
          <SolarSiteTypeBadge value={row.original.site_type} />
        ),
      },
      {
        accessorKey: "tehsil",
        header: "Tehsil",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "settlement",
        header: "Settlement",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "disco_info",
        header: "DISCO",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "bill_reference_number",
        header: "Bill ref",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "solar_connection_date",
        header: "Solar connection date",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) =>
          isBlank(getValue()) ? (
            NA
          ) : (
            <span className="tabular-nums whitespace-nowrap">
              {String(getValue())}
            </span>
          ),
      },
      {
        accessorKey: "total_export_kwh",
        header: "Export (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-amber-700">
            {fmtInt(getValue())}
          </span>
        ),
      },
      {
        accessorKey: "total_export_off_peak_kwh",
        header: "Export off-peak (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          row.original.any_tou_required ? (
            <span className="tabular-nums text-amber-600">
              {fmtInt(row.original.total_export_off_peak_kwh)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">N/A</span>
          ),
      },
      {
        accessorKey: "total_export_peak_kwh",
        header: "Export peak (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          row.original.any_tou_required ? (
            <span className="tabular-nums text-amber-800 font-medium">
              {fmtInt(row.original.total_export_peak_kwh)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">N/A</span>
          ),
      },
      {
        accessorKey: "total_import_kwh",
        header: "Import (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-red-700">
            {fmtInt(getValue())}
          </span>
        ),
      },
      {
        accessorKey: "total_import_off_peak_kwh",
        header: "Import off-peak (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          row.original.any_tou_required ? (
            <span className="tabular-nums text-red-600">
              {fmtInt(row.original.total_import_off_peak_kwh)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">N/A</span>
          ),
      },
      {
        accessorKey: "total_import_peak_kwh",
        header: "Import peak (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          row.original.any_tou_required ? (
            <span className="tabular-nums text-red-800 font-medium">
              {fmtInt(row.original.total_import_peak_kwh)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">N/A</span>
          ),
      },
      {
        accessorKey: "total_net_kwh",
        header: "Net (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "total_net_off_peak_kwh",
        header: "Net off-peak (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          row.original.any_tou_required ? (
            <span className="tabular-nums">
              {fmtInt(row.original.total_net_off_peak_kwh)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">N/A</span>
          ),
      },
      {
        accessorKey: "total_net_peak_kwh",
        header: "Net peak (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ row }) =>
          row.original.any_tou_required ? (
            <span className="tabular-nums font-medium">
              {fmtInt(row.original.total_net_peak_kwh)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">N/A</span>
          ),
      },
      {
        accessorKey: "months_logged",
        header: "Months",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "records_count",
        header: "Records",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_export_kwh_per_month",
        header: "Export / mo (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_import_kwh_per_month",
        header: "Import / mo (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_net_kwh_per_month",
        header: "Net / mo (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_pre_green_consumed_kwh_per_month",
        header: "Before green meter / mo (kWh)",
        meta: {
          filterVariant: "none",
          headerInfo: (
            <>
              <p className="text-[13px] font-semibold">Baseline consumption</p>
              <p className="opacity-90">
                Average units consumed per month in the months logged{" "}
                <span className="font-semibold">before the green meter</span>{" "}
                was installed.
              </p>
              <ul className="space-y-1 border-t border-background/15 pt-2 opacity-90">
                <li>• Peak + off-peak units, from the electricity bill</li>
                <li>• Nothing was exported in these months</li>
                <li>• Small text: months logged in the selected period</li>
              </ul>
            </>
          ),
        } satisfies DataGridColumnMeta,
        cell: ({ row }) => {
          const months = Number(row.original.pre_green_months_logged ?? 0);
          if (!months) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          return (
            <span className="tabular-nums" title="Units consumed per month before the green meter">
              {fmtNum(row.original.avg_pre_green_consumed_kwh_per_month)}
              <span className="block text-[11px] text-muted-foreground">
                {months} month{months === 1 ? "" : "s"} consumed
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "grid_draw_change_pct",
        header: "Grid draw vs baseline",
        meta: {
          filterVariant: "none",
          headerInfo: (
            <>
              <p className="text-[13px] font-semibold">
                Grid draw: after vs before the green meter
              </p>
              <p className="opacity-90">
                How much the site's monthly grid electricity changed once the
                green meter was installed.
              </p>
              <div className="rounded-md bg-background/10 px-2 py-1.5 font-mono text-[11px] leading-snug">
                (avg import after − avg consumed before)
                <br />÷ avg consumed before
              </div>
              <ul className="space-y-1 border-t border-background/15 pt-2">
                <li className="flex gap-2">
                  <span className="w-12 shrink-0 font-semibold text-emerald-300 dark:text-emerald-700">▼ −%</span>
                  <span className="opacity-90">Less from the grid — saving</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-12 shrink-0 font-semibold text-rose-300 dark:text-rose-700">▲ +%</span>
                  <span className="opacity-90">More from the grid than before</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-12 shrink-0 font-semibold">—</span>
                  <span className="opacity-90">
                    Needs logged months on both sides of the green meter date
                  </span>
                </li>
              </ul>
            </>
          ),
        } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => {
          const v = getValue() as number | null | undefined;
          if (v === null || v === undefined || !Number.isFinite(Number(v))) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          const n = Number(v);
          const down = n < -0.5;
          const up = n > 0.5;
          return (
            <span
              className={
                down
                  ? "tabular-nums font-medium text-emerald-700 dark:text-emerald-400"
                  : up
                    ? "tabular-nums font-medium text-rose-700 dark:text-rose-400"
                    : "tabular-nums"
              }
              title="Avg monthly grid import with the green meter vs avg units consumed before it"
            >
              {down ? "▼ " : up ? "▲ " : ""}
              {n > 0 ? "+" : ""}
              {n.toFixed(0)}%
            </span>
          );
        },
      },
    ],
    []
  );
}

export function waterSystemDetailFields(row: WaterSystemDetailRow) {
  const text = (v: unknown) => (isBlank(v) ? "N/A" : String(v));
  const num = (v: unknown, fmt: (v: unknown) => string, unit = "") =>
    isBlank(v) ? "N/A" : unit ? `${fmt(v)} ${unit}` : fmt(v);
  const ohrFields = !hasHourlyData(row)
    ? []
    : [
        {
          label: "Total (calc η×Q×t)",
          value: num(estimatedTotalM3(row), fmtInt, "m³"),
        },
        {
          label: "Avg daily (calc)",
          value: num(estimatedAvgDailyM3(row), fmtNum, "m³"),
        },
        {
          label: "Avg hourly (calc)",
          value: num(estimatedAvgHourlyM3(row), fmtNum, "m³"),
        },
      ];
  const meterFields = !hasMeterData(row)
    ? []
    : [
        {
          label: "Bulk meter since",
          value: row.bulk_meter_since
            ? `${row.bulk_meter_since}${row.bulk_meter_since_source === "first_meter_reading" ? " (first reading)" : ""}`
            : "N/A",
        },
        {
          label: "Total pumped (meter)",
          value: num(meterTotalM3(row), fmtInt, "m³"),
        },
        {
          label: "Avg daily (meter)",
          value: num(meterAvgDailyM3(row), fmtNum, "m³"),
        },
        {
          label: "Avg hourly (meter)",
          value: num(meterAvgHourlyM3(row), fmtNum, "m³"),
        },
        {
          label: "Latest meter reading",
          value: waterMeterField(
            row,
            row.latest_meter_reading_end_m3,
            fmtInt,
            "m³",
          ),
        },
      ];
  return [
    { label: "Water system ID", value: row.water_system_id },
    { label: "Unique identifier", value: text(row.unique_identifier) },
    { label: "Tehsil", value: text(row.tehsil) },
    { label: "Village", value: text(row.village) },
    { label: "Settlement", value: text(row.settlement) },
    { label: "Start date", value: text(row.start_of_operation) },
    {
      label: "Bulk meter installed",
      value: row.bulk_meter_installed ? "Yes" : "No",
    },
    {
      label: "Volume basis",
      value: waterVolumeBasisLabel(row),
    },
    ...ohrFields,
    ...meterFields,
    {
      label: "Total pump runtime",
      value: num(row.total_pump_hours_h, fmtNum, "h"),
    },
    { label: "Days with logs", value: num(row.days_logged, fmtInt) },
    { label: "Log entries", value: num(row.logs_count, fmtInt) },
    {
      label: "Average hours per logged day",
      value: num(row.avg_hours_per_day_logged, fmtNum),
    },
  ];
}

export function solarSystemDetailFields(row: SolarSystemDetailRow) {
  return [
    { label: "Solar system ID", value: row.solar_system_id },
    { label: "Unique identifier", value: row.unique_identifier ?? "—" },
    { label: "Site type", value: row.site_type?.trim() || "Not set" },
    { label: "Tehsil", value: row.tehsil },
    { label: "Village", value: row.village },
    { label: "Settlement", value: row.settlement ?? "—" },
    { label: "DISCO", value: row.disco_info ?? "—" },
    { label: "Bill reference", value: row.bill_reference_number ?? "—" },
    {
      label: "Solar connection date",
      value: row.solar_connection_date || "—",
    },
    { label: "Total export", value: `${fmtInt(row.total_export_kwh)} kWh` },
    ...(row.any_tou_required
      ? [
          {
            label: "Export off-peak",
            value: `${fmtInt(row.total_export_off_peak_kwh)} kWh`,
          },
          {
            label: "Export peak",
            value: `${fmtInt(row.total_export_peak_kwh)} kWh`,
          },
        ]
      : []),
    { label: "Total import", value: `${fmtInt(row.total_import_kwh)} kWh` },
    ...(row.any_tou_required
      ? [
          {
            label: "Import off-peak",
            value: `${fmtInt(row.total_import_off_peak_kwh)} kWh`,
          },
          {
            label: "Import peak",
            value: `${fmtInt(row.total_import_peak_kwh)} kWh`,
          },
        ]
      : []),
    { label: "Total net", value: `${fmtInt(row.total_net_kwh)} kWh` },
    ...(row.any_tou_required
      ? [
          {
            label: "Net off-peak",
            value: `${fmtInt(row.total_net_off_peak_kwh)} kWh`,
          },
          { label: "Net peak", value: `${fmtInt(row.total_net_peak_kwh)} kWh` },
        ]
      : []),
    { label: "Months logged", value: fmtInt(row.months_logged) },
    { label: "Monthly records", value: fmtInt(row.records_count) },
    {
      label: "Avg export / month",
      value: `${fmtNum(row.avg_export_kwh_per_month)} kWh`,
    },
    {
      label: "Avg import / month",
      value: `${fmtNum(row.avg_import_kwh_per_month)} kWh`,
    },
    {
      label: "Avg net / month",
      value: `${fmtNum(row.avg_net_kwh_per_month)} kWh`,
    },
    {
      label: "Green meter connected",
      value: row.green_meter_connection_date ?? "N/A",
    },
    ...(Number(row.pre_green_months_logged ?? 0) > 0
      ? [
          {
            label: "Before green meter — months",
            value: fmtInt(row.pre_green_months_logged),
          },
          {
            label: "Before green meter — consumed",
            value: `${fmtInt(row.pre_green_consumed_kwh)} kWh (peak ${fmtInt(row.pre_green_consumed_peak_kwh)} · off-peak ${fmtInt(row.pre_green_consumed_off_peak_kwh)})`,
          },
          {
            label: "Before green meter — avg / month",
            value: `${fmtNum(row.avg_pre_green_consumed_kwh_per_month)} kWh`,
          },
          {
            label: "Grid draw vs baseline",
            value:
              row.grid_draw_change_pct === null ||
              row.grid_draw_change_pct === undefined
                ? "N/A"
                : `${row.grid_draw_change_pct > 0 ? "+" : ""}${row.grid_draw_change_pct.toFixed(1)}%`,
          },
        ]
      : []),
  ];
}
