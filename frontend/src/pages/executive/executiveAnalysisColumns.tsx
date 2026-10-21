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
  calculatedAvgDailyM3,
  calculatedAvgHourlyM3,
  calculatedTotalM3,
  estimatedAvgDailyM3,
  estimatedAvgHourlyM3,
  estimatedTotalM3,
  meterAvgDailyM3,
  meterAvgHourlyM3,
  meterTotalM3,
  waterVolumeBasisLabel,
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

/** Meter-derived volumes are meaningless without a bulk meter or when the API has no value. */
function waterMeterCell(
  row: WaterSystemDetailRow,
  v: unknown,
  fmt: (v: unknown) => string
) {
  return !row.bulk_meter_installed || isBlank(v) ? (
    NA
  ) : (
    <span className="tabular-nums">{fmt(v)}</span>
  );
}

function waterNumCell(v: unknown, fmt: (v: unknown) => string) {
  return isBlank(v) ? NA : <span className="tabular-nums">{fmt(v)}</span>;
}

function waterMeterField(
  row: WaterSystemDetailRow,
  v: unknown,
  fmt: (v: unknown) => string,
  unit = ""
) {
  if (!row.bulk_meter_installed || isBlank(v)) return "N/A";
  return unit ? `${fmt(v)} ${unit}` : fmt(v);
}

function ohrVolumeCell(
  row: WaterSystemDetailRow,
  value: number | null,
  fmt: (v: unknown) => string,
) {
  if (row.bulk_meter_installed) return NA;
  if (value == null || !Number.isFinite(value)) return NA;
  return (
    <span
      className="tabular-nums"
      title="η × pump flow rate × total runtime in period"
    >
      {fmt(value)}
    </span>
  );
}

function bulkVolumeCell(
  row: WaterSystemDetailRow,
  value: number | null,
  fmt: (v: unknown) => string,
) {
  if (!row.bulk_meter_installed) return NA;
  if (value == null || !Number.isFinite(value)) return NA;
  return (
    <span className="tabular-nums" title="From bulk meter log intervals">
      {fmt(value)}
    </span>
  );
}

export function useWaterAnalysisColumns(
  rows: WaterSystemDetailRow[] = [],
): Array<ColumnDef<WaterSystemDetailRow>> {
  const showOhrVolumeCols =
    rows.length === 0 || rows.some((r) => !r.bulk_meter_installed);
  const showBulkVolumeCols =
    rows.length === 0 || rows.some((r) => r.bulk_meter_installed);

  return useMemo(
    () => [
      {
        accessorKey: "unique_identifier",
        header: "System ID",
        // Area/period come from top filters; table search covers ID + place names.
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <CopyableId value={String(getValue() ?? "")} label="System ID" />
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
        cell: ({ getValue }) => (isBlank(getValue()) ? NA : String(getValue())),
      },
      {
        accessorKey: "bulk_meter_installed",
        header: "Bulk meter",
        meta: {
          filterVariant: "select",
          filterOptions: ["Yes", "No"],
        } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
        filterFn: (row, _id, value) => {
          if (!value || value === "all") return true;
          const yes = row.original.bulk_meter_installed;
          return value === "Yes" ? yes : !yes;
        },
      },
      ...(showOhrVolumeCols
        ? ([
            {
              id: "ohr_total_m3",
              header: "Total calculated (m³)",
              meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
              accessorFn: (row: WaterSystemDetailRow) => estimatedTotalM3(row),
              cell: ({ row }: { row: { original: WaterSystemDetailRow } }) =>
                ohrVolumeCell(
                  row.original,
                  estimatedTotalM3(row.original),
                  fmtInt,
                ),
            },
            {
              id: "ohr_avg_daily_m3",
              header: "Avg daily calculated (m³)",
              meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
              accessorFn: (row: WaterSystemDetailRow) =>
                estimatedAvgDailyM3(row),
              cell: ({ row }: { row: { original: WaterSystemDetailRow } }) =>
                ohrVolumeCell(
                  row.original,
                  estimatedAvgDailyM3(row.original),
                  fmtNum,
                ),
            },
            {
              id: "ohr_avg_hourly_m3",
              header: "Avg hourly calculated (m³)",
              meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
              accessorFn: (row: WaterSystemDetailRow) =>
                estimatedAvgHourlyM3(row),
              cell: ({ row }: { row: { original: WaterSystemDetailRow } }) =>
                ohrVolumeCell(
                  row.original,
                  estimatedAvgHourlyM3(row.original),
                  fmtNum,
                ),
            },
          ] as Array<ColumnDef<WaterSystemDetailRow>>)
        : []),
      ...(showBulkVolumeCols
        ? ([
            {
              id: "meter_total_m3",
              header: "Total pumped (meter, m³)",
              meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
              accessorFn: (row: WaterSystemDetailRow) => meterTotalM3(row),
              cell: ({ row }: { row: { original: WaterSystemDetailRow } }) =>
                bulkVolumeCell(
                  row.original,
                  meterTotalM3(row.original),
                  fmtInt,
                ),
            },
            {
              id: "meter_avg_daily_m3",
              header: "Avg daily (meter, m³)",
              meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
              accessorFn: (row: WaterSystemDetailRow) => meterAvgDailyM3(row),
              cell: ({ row }: { row: { original: WaterSystemDetailRow } }) =>
                bulkVolumeCell(
                  row.original,
                  meterAvgDailyM3(row.original),
                  fmtNum,
                ),
            },
            {
              id: "meter_avg_hourly_m3",
              header: "Avg hourly (meter, m³)",
              meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
              accessorFn: (row: WaterSystemDetailRow) => meterAvgHourlyM3(row),
              cell: ({ row }: { row: { original: WaterSystemDetailRow } }) =>
                bulkVolumeCell(
                  row.original,
                  meterAvgHourlyM3(row.original),
                  fmtNum,
                ),
            },
            {
              accessorKey: "latest_meter_reading_end_m3",
              header: "Latest meter reading (m³)",
              meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
              cell: ({ row, getValue }) =>
                waterMeterCell(row.original, getValue(), fmtInt),
            },
          ] as Array<ColumnDef<WaterSystemDetailRow>>)
        : []),
      {
        accessorKey: "total_pump_hours_h",
        header: "Runtime (h)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtNum),
      },
      {
        accessorKey: "days_logged",
        header: "Days logged",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtInt),
      },
      {
        accessorKey: "logs_count",
        header: "Log entries",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtInt),
      },
      {
        accessorKey: "avg_hours_per_day_logged",
        header: "h / day",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => waterNumCell(getValue(), fmtNum),
      },
    ],
    [showOhrVolumeCols, showBulkVolumeCols],
  );
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
        header: "Export off-peak",
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
        header: "Export peak",
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
        header: "Import off-peak",
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
        header: "Import peak",
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
        header: "Net off-peak",
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
        header: "Net peak",
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
        header: "Export / mo",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_import_kwh_per_month",
        header: "Import / mo",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_net_kwh_per_month",
        header: "Net / mo",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
    ],
    []
  );
}

export function waterSystemDetailFields(row: WaterSystemDetailRow) {
  const text = (v: unknown) => (isBlank(v) ? "N/A" : String(v));
  const num = (v: unknown, fmt: (v: unknown) => string, unit = "") =>
    isBlank(v) ? "N/A" : unit ? `${fmt(v)} ${unit}` : fmt(v);
  const ohrFields = row.bulk_meter_installed
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
  const meterFields = !row.bulk_meter_installed
    ? []
    : [
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
  ];
}
