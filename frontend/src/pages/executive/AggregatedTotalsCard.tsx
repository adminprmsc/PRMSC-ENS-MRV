import { useCallback } from "react";
import { Download, Sigma } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNowPakistanDateTime } from "@/utils/pakistanTime";

export type AggregatedTotal = {
  label: string;
  value: number;
  unit: string;
  /** Short explanation shown under the value and in the export. */
  hint?: string;
  /** Visually emphasise (e.g. a grand total). */
  emphasis?: boolean;
};

type AggregatedTotalsCardProps = {
  title: string;
  /** Sheet title row, e.g. "Water analysis — aggregated totals". */
  exportTitle: string;
  exportFileName: string;
  scopeLabel: string;
  periodLabel: string;
  siteCount: number;
  totals: AggregatedTotal[];
};

function fmt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    n,
  );
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120);
}

export default function AggregatedTotalsCard({
  title,
  exportTitle,
  exportFileName,
  scopeLabel,
  periodLabel,
  siteCount,
  totals,
}: AggregatedTotalsCardProps) {
  const exportXlsx = useCallback(() => {
    const aoa: (string | number)[][] = [
      [exportTitle],
      [],
      ["Exported", formatNowPakistanDateTime()],
      ["Scope", scopeLabel],
      ["Period", periodLabel],
      ["Sites included", siteCount],
      [],
      ["Metric", "Value", "Unit", "Basis"],
      ...totals.map((t) => [
        `${t.label} (${t.unit})`,
        Math.round(t.value * 100) / 100,
        t.unit,
        t.hint ?? "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 48 }, { wch: 16 }, { wch: 8 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aggregated totals");
    XLSX.writeFile(wb, `${safeFileName(exportFileName)}.xlsx`);
  }, [exportFileName, exportTitle, periodLabel, scopeLabel, siteCount, totals]);

  return (
    <Card className="gap-0 py-0 shadow-sm ring-1 ring-foreground/10">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/50 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
            <Sigma className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs">
              {periodLabel} · {scopeLabel} · {fmt(siteCount)} sites
            </CardDescription>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={exportXlsx}
          disabled={siteCount === 0}
        >
          <Download className="size-4" />
          Export
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((t) => (
          <div
            key={t.label}
            className={
              t.emphasis
                ? "rounded-lg border border-primary/30 bg-primary/5 p-3"
                : "rounded-lg border border-border/60 p-3"
            }
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.label}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {fmt(t.value)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {t.unit}
              </span>
            </p>
            {t.hint ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t.hint}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
