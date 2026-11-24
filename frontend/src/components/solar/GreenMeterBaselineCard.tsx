import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Gauge, History, Minus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatYearMonth,
  summarizePhases,
  yearMonthOf,
  type PhaseLogLike,
} from "@/lib/solarMeterPhase";

const kwh = (n: number | null) =>
  n === null
    ? "—"
    : `${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 1 : 0 })} kWh`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/**
 * Before-vs-after green meter comparison for one site: the "before green
 * meter" consumption baseline next to monthly grid import once the green
 * meter was installed.
 */
export function GreenMeterBaselineCard({
  logs,
  greenMeterDate,
  loading,
  className,
}: {
  logs: PhaseLogLike[];
  greenMeterDate: string | null | undefined;
  loading?: boolean;
  className?: string;
}) {
  const s = useMemo(() => summarizePhases(logs), [logs]);
  const g = yearMonthOf(greenMeterDate);
  const change = s.gridDrawChangePct;
  const lower = change !== null && change < -0.5;
  const higher = change !== null && change > 0.5;

  return (
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      <CardHeader className="border-b border-border/60 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4 text-muted-foreground" />
          Green meter & baseline
        </CardTitle>
        <CardDescription>
          {g
            ? `Green meter connected ${formatYearMonth(g)}. Months before it are logged as units consumed only.`
            : "No green meter connection date recorded for this site."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/40 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <History className="size-4 text-amber-700 dark:text-amber-400" />
                Before green meter
              </p>
              {s.preGreen.months === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No back-dated months logged yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="Avg / month"
                    value={kwh(s.preGreen.avgPerMonth)}
                    sub={`${s.preGreen.months} month${s.preGreen.months === 1 ? "" : "s"}${
                      s.preGreen.first && s.preGreen.last
                        ? ` · ${formatYearMonth(s.preGreen.first)} – ${formatYearMonth(s.preGreen.last)}`
                        : ""
                    }`}
                  />
                  <Stat
                    label="Total consumed"
                    value={kwh(s.preGreen.total)}
                    sub={`Peak ${kwh(s.preGreen.peak)} · Off-peak ${kwh(s.preGreen.offPeak)}`}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-center">
              <div
                className={cn(
                  "flex min-w-[120px] flex-col items-center rounded-lg border px-3 py-2 text-center",
                  lower && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
                  higher && "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
                )}
              >
                {lower ? (
                  <ArrowDownRight className="size-4" />
                ) : higher ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <Minus className="size-4 text-muted-foreground" />
                )}
                <p className="text-lg font-semibold tabular-nums">
                  {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(0)}%`}
                </p>
                <p className="text-[11px] leading-tight">
                  {change === null
                    ? "Needs months on both sides"
                    : lower
                      ? "less grid draw per month"
                      : higher
                        ? "more grid draw per month"
                        : "no change in grid draw"}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-emerald-200/70 bg-emerald-50/30 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Gauge className="size-4 text-emerald-700 dark:text-emerald-400" />
                With green meter
              </p>
              {s.green.months === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No green meter months logged yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="Avg import / month"
                    value={kwh(s.green.avgImportPerMonth)}
                    sub={`${s.green.months} month${s.green.months === 1 ? "" : "s"}`}
                  />
                  <Stat
                    label="Avg export / month"
                    value={kwh(s.green.avgExportPerMonth)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
