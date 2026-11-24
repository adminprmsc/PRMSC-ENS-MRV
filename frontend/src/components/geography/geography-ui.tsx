import type { ReactNode } from "react";
import {
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  PieChart,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPopulation } from "@/services/geographyService";

export type VillageStatus = "missing" | "no-site" | "partial" | "full";

export function villageStatus(
  total: number,
  served: number,
  siteCount: number,
): VillageStatus {
  if (total <= 0) return "missing";
  if (siteCount === 0) return "no-site";
  return served >= total ? "full" : "partial";
}

const STATUS: Record<
  VillageStatus,
  { label: string; icon: ReactNode; className: string }
> = {
  missing: {
    label: "Needs count",
    icon: <CircleDashed className="size-3" />,
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  },
  "no-site": {
    label: "No water site",
    icon: <CircleSlash className="size-3" />,
    className:
      "border-border bg-muted/60 text-muted-foreground",
  },
  partial: {
    label: "Partly served",
    icon: <PieChart className="size-3" />,
    className:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  full: {
    label: "Fully served",
    icon: <CheckCircle2 className="size-3" />,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
};

export const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All villages" },
  { value: "missing", label: STATUS.missing.label },
  { value: "no-site", label: STATUS["no-site"].label },
  { value: "partial", label: STATUS.partial.label },
  { value: "full", label: STATUS.full.label },
  { value: "unsaved", label: "Unsaved changes" },
];

/** Status chip — icon + label, never colour alone. */
export function StatusChip({ status }: { status: VillageStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        s.className,
      )}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

/** Served-of-total part-to-whole bar with a numeric caption. */
export function CoverageBar({
  served,
  total,
  className,
  showCaption = true,
}: {
  served: number;
  total: number;
  className?: string;
  showCaption?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, (100 * served) / total) : 0;
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className="flex h-1.5 gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={`${formatPopulation(served)} of ${formatPopulation(total)} served`}
      >
        {pct > 0 ? (
          <div
            className="h-full rounded-full bg-[var(--chart-1)]"
            style={{ width: `${pct}%` }}
          />
        ) : null}
        <div className="h-full flex-1 rounded-full bg-muted" />
      </div>
      {showCaption ? (
        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
          {formatPopulation(served)} served
          {total > 0 ? ` · ${Math.round(pct)}%` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Small labelled control wrapper for the toolbar. */
export function ToolbarField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Download rows as a UTF-8 CSV (Excel-friendly BOM). */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
