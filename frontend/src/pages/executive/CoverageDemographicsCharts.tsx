import { memo, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Droplets,
  FileSearch,
  ListChecks,
  ShieldAlert,
  Sun,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { hqRoutes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { InfoSectionHeader } from "./AdminDashboardBlocks";
import type { TehsilCoverageInput } from "./AdminDashboardBlocks";

const coverageConfig = {
  water: { label: "Water", color: "var(--chart-1)" },
  solar: { label: "Solar", color: "var(--chart-2)" },
} satisfies ChartConfig;

const mixConfig = {
  logged: { label: "Logged", color: "var(--impact-positive)" },
  missing: { label: "Missing", color: "var(--impact-negative)" },
} satisfies ChartConfig;

export type CoverageScopeQuery = {
  tehsil?: string;
  village?: string;
  year?: string;
  month?: string;
};

function withScopeQuery(
  path: string,
  scope?: CoverageScopeQuery,
  extra?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merge = { ...scope, ...extra };
  for (const [key, value] of Object.entries(merge)) {
    if (!value) continue;
    if (value === "All Months" || value === "All Villages") continue;
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

type CoverageDemographicsChartsProps = {
  rows: TehsilCoverageInput[];
  loading?: boolean;
  waterLogged: number;
  waterTotal: number;
  solarLogged: number;
  solarTotal: number;
  periodHint: string;
  /** Current Command Center filters — carried into analysis deep-links. */
  scope?: CoverageScopeQuery;
};

export const CoverageDemographicsCharts = memo(
  function CoverageDemographicsCharts({
    rows,
    loading,
    waterLogged,
    waterTotal,
    solarLogged,
    solarTotal,
    periodHint,
    scope,
  }: CoverageDemographicsChartsProps) {
    const navigate = useNavigate();

    const tehsilBars = useMemo(
      () =>
        [...rows]
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 12)
          .map((r) => ({
            tehsil: r.tehsil.length > 14 ? `${r.tehsil.slice(0, 12)}…` : r.tehsil,
            full: r.tehsil,
            water: r.waterPct ?? 0,
            solar: r.solarPct ?? 0,
          })),
      [rows],
    );

    const waterMix = useMemo(
      () =>
        [
          { key: "logged", name: "Logged", value: waterLogged },
          {
            key: "missing",
            name: "Missing",
            value: Math.max(0, waterTotal - waterLogged),
          },
        ].filter((d) => d.value > 0),
      [waterLogged, waterTotal],
    );

    const solarMix = useMemo(
      () =>
        [
          { key: "logged", name: "Logged", value: solarLogged },
          {
            key: "missing",
            name: "Missing",
            value: Math.max(0, solarTotal - solarLogged),
          },
        ].filter((d) => d.value > 0),
      [solarLogged, solarTotal],
    );

    const sitesHref = withScopeQuery(hqRoutes.sitesProgress, scope, {
      tab: "coverage",
    });
    const waterHref = withScopeQuery(hqRoutes.waterAnalysis, scope);
    const solarHref = withScopeQuery(hqRoutes.solarAnalysis, scope);
    const attentionHref = withScopeQuery(hqRoutes.attention, scope);

    const openTehsilEvidence = (tehsilName: string) => {
      navigate(
        withScopeQuery(hqRoutes.sitesProgress, scope, {
          tehsil: tehsilName,
          tab: "coverage",
        }),
      );
    };

    return (
      <section className="hq-section animate-fade-in-up space-y-3">
        <InfoSectionHeader
          kind="demographics"
          title="Coverage overview"
          description={`${periodHint} · click a tehsil or open analysis to verify`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                to={sitesHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 gap-1.5",
                )}
              >
                <ListChecks className="size-3.5" />
                Sites evidence
                <ArrowRight className="size-3" />
              </Link>
              <Link
                to={attentionHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 gap-1.5",
                )}
              >
                <ShieldAlert className="size-3.5" />
                Gaps
              </Link>
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="shadow-sm lg:col-span-7">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b bg-muted/20">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold tracking-tight">
                  Tehsil logging rate
                </CardTitle>
                <CardDescription>
                  Click a bar to open site-level evidence for that tehsil
                </CardDescription>
              </div>
              <Link
                to={sitesHref}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Full register
                <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : tehsilBars.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No tehsil data in this view
                </p>
              ) : (
                <ChartContainer
                  config={coverageConfig}
                  className="h-[280px] w-full"
                >
                  <BarChart
                    data={tehsilBars}
                    layout="vertical"
                    margin={{ left: 8, right: 12 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="tehsil"
                      width={88}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) =>
                            String(payload?.[0]?.payload?.full ?? "")
                          }
                          formatter={(value, name) => [
                            `${Number(value)}%`,
                            name === "water" ? "Water" : "Solar",
                          ]}
                        />
                      }
                    />
                    <Bar
                      dataKey="water"
                      fill="var(--color-water)"
                      radius={[0, 4, 4, 0]}
                      barSize={10}
                      cursor="pointer"
                      onClick={(data) => {
                        const full = (
                          data as { full?: string; payload?: { full?: string } }
                        )?.full ?? (data as { payload?: { full?: string } })?.payload?.full;
                        if (full) openTehsilEvidence(full);
                      }}
                    />
                    <Bar
                      dataKey="solar"
                      fill="var(--color-solar)"
                      radius={[0, 4, 4, 0]}
                      barSize={10}
                      cursor="pointer"
                      onClick={(data) => {
                        const full = (
                          data as { full?: string; payload?: { full?: string } }
                        )?.full ?? (data as { payload?: { full?: string } })?.payload?.full;
                        if (full) openTehsilEvidence(full);
                      }}
                    />
                  </BarChart>
                </ChartContainer>
              )}
              {!loading && tehsilBars.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                  <span className="mr-1 self-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Open evidence
                  </span>
                  {[...rows]
                    .sort((a, b) => a.avg - b.avg)
                    .slice(0, 6)
                    .map((r) => (
                      <button
                        key={r.tehsil}
                        type="button"
                        onClick={() => openTehsilEvidence(r.tehsil)}
                        className="rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        {r.tehsil}
                        <span className="ml-1 tabular-nums text-muted-foreground">
                          {r.avg}%
                        </span>
                      </button>
                    ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            <MixCard
              title="Water sites"
              icon={<Droplets className="size-3.5 text-blue-600" />}
              loading={!!loading}
              data={waterMix}
              logged={waterLogged}
              total={waterTotal}
              analysisHref={waterHref}
              gapsHref={attentionHref}
              analysisLabel="Water analysis"
            />
            <MixCard
              title="Solar sites"
              icon={<Sun className="size-3.5 text-amber-600" />}
              loading={!!loading}
              data={solarMix}
              logged={solarLogged}
              total={solarTotal}
              analysisHref={solarHref}
              gapsHref={attentionHref}
              analysisLabel="Solar analysis"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <DepthLink
            to={sitesHref}
            icon={<FileSearch className="size-4" />}
            title="Sites Progress"
            hint="Per-site logs & coverage proof"
          />
          <DepthLink
            to={waterHref}
            icon={<Droplets className="size-4" />}
            title="Water analysis"
            hint="Volumes, meters, submissions"
          />
          <DepthLink
            to={solarHref}
            icon={<Sun className="size-4" />}
            title="Solar analysis"
            hint="Export / import & monthly records"
          />
        </div>
      </section>
    );
  },
);

function MixCard({
  title,
  icon,
  loading,
  data,
  logged,
  total,
  analysisHref,
  gapsHref,
  analysisLabel,
}: {
  title: string;
  icon: ReactNode;
  loading: boolean;
  data: Array<{ key: string; name: string; value: number }>;
  logged: number;
  total: number;
  analysisHref: string;
  gapsHref: string;
  analysisLabel: string;
}) {
  const pct = total > 0 ? Math.round((100 * logged) / total) : 0;
  const missing = Math.max(0, total - logged);
  return (
    <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="border-b bg-muted/20 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            {icon}
            {title}
          </CardTitle>
          <Link
            to={analysisHref}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {analysisLabel}
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <CardDescription>
          {loading ? "…" : `${logged}/${total} logged (${pct}%)`}
          {!loading && missing > 0 ? (
            <>
              {" · "}
              <Link
                to={gapsHref}
                className="font-medium text-rose-700 hover:underline"
              >
                {missing} gaps
              </Link>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-4">
        {loading ? (
          <Skeleton className="size-28 rounded-full" />
        ) : total === 0 ? (
          <p className="text-xs text-muted-foreground">No sites</p>
        ) : (
          <ChartContainer config={mixConfig} className="aspect-square h-[120px]">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => [
                      String(value),
                      String(name),
                    ]}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={34}
                outerRadius={48}
                paddingAngle={data.length > 1 ? 3 : 0}
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={
                      mixConfig[entry.key as keyof typeof mixConfig].color
                    }
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function DepthLink({
  to,
  icon,
  title,
  hint,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card/90 px-3.5 py-3 shadow-sm ring-1 ring-foreground/[0.03] transition-all duration-200 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary">
          {title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
