import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplets, Home, UserX, Users } from "lucide-react";

import { StatCard } from "@/components/layout/StatCard";
import type { VillagePopulation } from "@/hooks/usePopulationIndex";
import { formatPopulation, periodDays } from "@/services/geographyService";

type Props = {
  byKey: Map<string, VillagePopulation>;
  loading: boolean;
  /** Dashboard filters ("All …" sentinels = whole scope). */
  tehsil: string;
  village: string;
  period: { year: string; month: string; dateFrom: string; dateTo: string };
  /** Water delivered in the period (m³), same scope. */
  waterM3: number;
  manageHref: string;
};

const isAll = (v: string) => !v || /^all\b/i.test(v.trim());

/**
 * Population KPIs for the Command Center: total population, people served by
 * water sites (backend attribution), litres per person per day, and the gap.
 */
export function CommandCenterPopulationStrip({
  byKey,
  loading,
  tehsil,
  village,
  period,
  waterM3,
  manageHref,
}: Props) {
  const stats = useMemo(() => {
    const wantVillage = isAll(village) ? null : village.trim().toUpperCase();
    const wantTehsil = isAll(tehsil) ? null : tehsil.trim().toUpperCase();
    const inScope = [...byKey.entries()].filter(([, v]) => {
      if (wantTehsil && v.tehsil.toUpperCase() !== wantTehsil) return false;
      if (wantVillage && v.village.toUpperCase() !== wantVillage) return false;
      return true;
    });
    let total = 0;
    let served = 0;
    let servedVillages = 0;
    let populated = 0;
    for (const [, v] of inScope) {
      total += v.total;
      served += v.served;
      if (v.total > 0) populated += 1;
      if (v.siteCount > 0) servedVillages += 1;
    }
    const days = periodDays(period);
    const lpcd =
      days && served > 0 && waterM3 > 0
        ? (waterM3 * 1000) / served / days
        : null;
    return {
      total,
      served,
      servedVillages,
      villages: inScope.length,
      populated,
      uncovered: Math.max(0, total - served),
      servedPct: total > 0 ? Math.round((100 * served) / total) : null,
      lpcd,
      days,
      label: wantVillage
        ? (inScope[0]?.[1].village ?? village)
        : wantTehsil
          ? (inScope[0]?.[1].tehsil ?? tehsil)
          : "All tehsils in scope",
    };
  }, [byKey, tehsil, village, period, waterM3]);

  const empty = !loading && stats.total === 0;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Population · <span className="text-muted-foreground">{stats.label}</span>
        </h2>
        <Link
          to={manageHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {empty ? "Enter population in Geography" : "Geography"}
          <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent="violet"
          label={isAll(village) ? "Population" : "Village population"}
          loading={loading}
          icon={<Users className="size-5" />}
          value={
            <span className="font-mono tabular-nums tracking-tight">
              {formatPopulation(stats.total)}
            </span>
          }
          description={
            isAll(village)
              ? `${formatPopulation(stats.populated)} of ${formatPopulation(stats.villages)} villages have counts`
              : "Main village + settlements"
          }
        />
        <StatCard
          accent="blue"
          label="Served by water sites"
          loading={loading}
          icon={<Home className="size-5" />}
          value={
            <>
              <span className="font-mono tabular-nums tracking-tight">
                {formatPopulation(stats.served)}
              </span>
              {stats.servedPct !== null ? (
                <span className="ml-1.5 text-lg font-medium text-muted-foreground">
                  {stats.servedPct}%
                </span>
              ) : null}
            </>
          }
          description={`Across ${formatPopulation(stats.servedVillages)} village${stats.servedVillages === 1 ? "" : "s"} with a water site`}
        />
        <StatCard
          accent="green"
          label="Water per person"
          loading={loading}
          icon={<Droplets className="size-5" />}
          value={
            stats.lpcd === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <>
                <span className="font-mono tabular-nums tracking-tight">
                  {stats.lpcd.toFixed(stats.lpcd < 10 ? 1 : 0)}
                </span>
                <span className="ml-1.5 text-lg font-medium text-muted-foreground">
                  L/day
                </span>
              </>
            )
          }
          description={
            stats.lpcd === null
              ? stats.days === null
                ? "Pick a year or date range to calculate"
                : "Needs logged water and population"
              : `Delivered water ÷ people served · ${stats.days} days`
          }
        />
        <StatCard
          accent="amber"
          label="Not yet covered"
          loading={loading}
          icon={<UserX className="size-5" />}
          value={
            <span className="font-mono tabular-nums tracking-tight">
              {formatPopulation(stats.uncovered)}
            </span>
          }
          description="People not attributed to any water site"
        />
      </div>
    </section>
  );
}
