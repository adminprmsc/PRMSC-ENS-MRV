import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, Droplets, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
} from "@/components/layout/tehsil-ui";
import { Button } from "@/components/ui/button";
import {
  formatPopulation,
  type CoverageResponse,
  type SiteCoverage,
} from "@/services/geographyService";

const chartConfig = {
  served: { label: "Served by water sites", color: "var(--chart-1)" },
  unserved: {
    label: "Not served",
    color: "color-mix(in oklch, var(--muted-foreground) 32%, transparent)",
  },
} satisfies ChartConfig;

const MAX_ROWS = 12;
const isAll = (v?: string) => !v || /^all\b/i.test(v.trim());
const up = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

type Row = { label: string; served: number; unserved: number; total: number };

type Props = {
  coverage: CoverageResponse | null;
  loading: boolean;
  tehsil: string;
  village: string;
  manageHref: string;
  /** Detail link for a water site, when the viewer has one. */
  siteHref?: (id: string) => string;
};

function describeAreas(s: SiteCoverage): string {
  if (s.unmatched) return "Village not in location catalog";
  const main = s.areas.find((a) => a.kind === "village");
  const sets = s.areas.filter((a) => a.kind === "settlement");
  const parts: string[] = [];
  if (main) parts.push("Main abadi");
  if (sets.length === 1 && sets[0]) parts.push(sets[0].name);
  else if (sets.length > 1) parts.push(`${sets.length} settlements`);
  const shared = s.areas.some((a) => a.shared_with > 1);
  return (parts.join(" + ") || "No population entered") + (shared ? " · shared" : "");
}

/**
 * Population demographics for the current dashboard scope. Drills down with
 * the filters: all tehsils → by tehsil; one tehsil → by village; one village
 * → main abadi + settlements. Plus the per-water-site served table.
 */
export function PopulationDemographics({
  coverage,
  loading,
  tehsil,
  village,
  manageHref,
  siteHref,
}: Props) {
  const [showAllSites, setShowAllSites] = useState(false);

  const view = useMemo(() => {
    if (!coverage) return null;
    const wantT = isAll(tehsil) ? null : up(tehsil);
    const wantV = isAll(village) ? null : up(village);

    const villages = coverage.villages.filter(
      (v) => (!wantT || up(v.tehsil) === wantT) && (!wantV || up(v.village) === wantV),
    );
    const sites = coverage.sites.filter(
      (s) => (!wantT || up(s.tehsil) === wantT) && (!wantV || up(s.village) === wantV),
    );
    const total = villages.reduce((a, v) => a + v.total_population, 0);
    const served = villages.reduce((a, v) => a + v.served_population, 0);

    let level: string;
    let rows: Row[];
    if (wantV) {
      level = `Inside ${villages[0]?.village ?? village}`;
      rows = villages.flatMap((v) => [
        {
          label: "Main abadi",
          served: v.main_served,
          unserved: v.main_population - v.main_served,
          total: v.main_population,
        },
        ...v.settlements.map((s) => ({
          label: s.name,
          served: s.served,
          unserved: s.population - s.served,
          total: s.population,
        })),
      ]);
    } else if (wantT || coverage.tehsils.length === 1) {
      level = "By village";
      rows = villages.map((v) => ({
        label: v.village,
        served: v.served_population,
        unserved: v.unserved_population,
        total: v.total_population,
      }));
    } else {
      level = "By tehsil";
      rows = coverage.tehsils.map((t) => ({
        label: t.tehsil,
        served: t.served_population,
        unserved: t.unserved_population,
        total: t.total_population,
      }));
    }
    rows = rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
    if (rows.length > MAX_ROWS) {
      const rest = rows.slice(MAX_ROWS - 1);
      rows = [
        ...rows.slice(0, MAX_ROWS - 1),
        {
          label: `Other ${rest.length}`,
          served: rest.reduce((a, r) => a + r.served, 0),
          unserved: rest.reduce((a, r) => a + r.unserved, 0),
          total: rest.reduce((a, r) => a + r.total, 0),
        },
      ];
    }
    return {
      level,
      rows,
      sites,
      total,
      served,
      unserved: total - served,
      pct: total > 0 ? (100 * served) / total : null,
      villagesWithSites: villages.filter((v) => v.site_count > 0).length,
      villageCount: villages.length,
    };
  }, [coverage, tehsil, village]);

  const sitesShown = view
    ? showAllSites
      ? view.sites
      : view.sites.slice(0, 8)
    : [];

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/30 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-muted-foreground" />
              Population demographics
            </CardTitle>
            <CardDescription className="text-xs">
              Who lives where, and how many people each water site serves
            </CardDescription>
          </div>
          <Link
            to={manageHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Edit population <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {loading || !view ? (
          <Skeleton className="h-64 w-full" />
        ) : view.total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No population entered for this scope yet.{" "}
            <Link to={manageHref} className="font-medium text-primary hover:underline">
              Add village and settlement counts
            </Link>{" "}
            to see demographics.
          </p>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              {/* Hero number */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Served by water sites
                  </p>
                  <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
                    {view.pct === null ? "—" : `${view.pct.toFixed(view.pct < 10 ? 1 : 0)}%`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPopulation(view.served)} of{" "}
                    {formatPopulation(view.total)} people
                  </p>
                </div>
                {/* Single part-to-whole bar */}
                <div
                  className="flex h-2.5 gap-[2px] overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${formatPopulation(view.served)} served, ${formatPopulation(view.unserved)} not served`}
                >
                  {view.served > 0 ? (
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(100 * view.served) / view.total}%`,
                        background: chartConfig.served.color,
                      }}
                    />
                  ) : null}
                  {view.unserved > 0 ? (
                    <div
                      className="h-full flex-1 rounded-full"
                      style={{ background: chartConfig.unserved.color }}
                    />
                  ) : null}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-[11px] uppercase text-muted-foreground">
                      Not served
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {formatPopulation(view.unserved)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-[11px] uppercase text-muted-foreground">
                      Villages with a site
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {view.villagesWithSites} / {view.villageCount}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Drill-down stacked bars */}
              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {view.level}
                </p>
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto w-full"
                  style={{ height: Math.max(140, view.rows.length * 34 + 56) }}
                >
                  <BarChart
                    data={view.rows}
                    layout="vertical"
                    margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
                    barCategoryGap={8}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(n) =>
                        Intl.NumberFormat("en-US", { notation: "compact" }).format(
                          Number(n),
                        )
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) =>
                        v.length > 18 ? `${v.slice(0, 17)}…` : v
                      }
                    />
                    <ChartTooltip
                      cursor={{ fillOpacity: 0.06 }}
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex w-full items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {chartConfig[name as keyof typeof chartConfig]
                                  ?.label ?? String(name)}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {formatPopulation(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="served"
                      stackId="p"
                      fill="var(--color-served)"
                      stroke="var(--card)"
                      strokeWidth={2}
                      radius={[4, 0, 0, 4]}
                    />
                    <Bar
                      dataKey="unserved"
                      stackId="p"
                      fill="var(--color-unserved)"
                      stroke="var(--card)"
                      strokeWidth={2}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            {/* Per-site attribution */}
            <div>
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Droplets className="size-3.5" />
                  Population served by water site
                </p>
                <p className="text-[11px] text-muted-foreground sm:max-w-md sm:text-right">
                  Site in a settlement serves it; village-level site serves the
                  main abadi + settlements without their own site; shared areas
                  are split evenly.
                </p>
              </div>
              <DataTableWrap>
                <Table>
                  <DataTableHeader>
                    <DataTableHead>Water site</DataTableHead>
                    <DataTableHead className="hidden sm:table-cell">Location</DataTableHead>
                    <DataTableHead className="hidden md:table-cell">Covers</DataTableHead>
                    <DataTableHead align="right">People served</DataTableHead>
                  </DataTableHeader>
                  <TableBody>
                    {sitesShown.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          No water sites in this scope.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sitesShown.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">
                            {siteHref ? (
                              <Link
                                to={siteHref(s.id)}
                                className="text-primary hover:underline"
                              >
                                {s.unique_identifier}
                              </Link>
                            ) : (
                              s.unique_identifier
                            )}
                            <p className="text-[11px] font-normal text-muted-foreground sm:hidden">
                              {[s.village, s.settlement].filter(Boolean).join(" · ")}
                            </p>
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                            {[s.village, s.settlement, s.tehsil]
                              .filter(Boolean)
                              .join(" · ")}
                          </TableCell>
                          <TableCell className="hidden text-sm md:table-cell">
                            {s.unmatched ? (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="size-3.5" />
                                {describeAreas(s)}
                              </span>
                            ) : (
                              describeAreas(s)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatPopulation(s.served_population)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </DataTableWrap>
              {view.sites.length > 8 ? (
                <div className="mt-2 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllSites((v) => !v)}
                  >
                    {showAllSites
                      ? "Show top 8"
                      : `Show all ${view.sites.length} sites`}
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
