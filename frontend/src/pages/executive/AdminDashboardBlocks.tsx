import { Link } from "react-router-dom";
import { memo, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  ListChecks,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hqRoutes } from "@/constants/routes";
import DataGrid, { type DataGridColumnMeta } from "@/components/DataGrid";
import DataGridSkeleton from "@/components/DataGridSkeleton";
import { DetailTile } from "@/components/common/DetailTile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type {
  ProgramSolarSystemCoverage,
  ProgramWaterSystemCoverage,
} from "./fetchScopedProgramDashboard";

export type InfoSectionKind =
  | "status"
  | "issues"
  | "insights"
  | "map"
  | "performance"
  | "demographics"
  | "trends";

const SECTION_META: Record<
  InfoSectionKind,
  { label: string; icon: LucideIcon; tone: string; iconTone: string }
> = {
  status: {
    label: "Status",
    icon: CheckCircle2,
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    iconTone: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  },
  issues: {
    label: "Issues",
    icon: ShieldAlert,
    tone: "bg-rose-50 text-rose-800 border-rose-200",
    iconTone: "border-rose-200/80 bg-rose-50 text-rose-700",
  },
  insights: {
    label: "Insights",
    icon: Lightbulb,
    tone: "bg-sky-50 text-sky-800 border-sky-200",
    iconTone: "border-sky-200/80 bg-sky-50 text-sky-700",
  },
  map: {
    label: "Map",
    icon: MapPin,
    tone: "bg-slate-50 text-slate-700 border-slate-200",
    iconTone: "border-slate-200/80 bg-slate-50 text-slate-700",
  },
  performance: {
    label: "Performance",
    icon: ClipboardList,
    tone: "bg-teal-50 text-teal-800 border-teal-200",
    iconTone: "border-teal-200/80 bg-teal-50 text-teal-700",
  },
  demographics: {
    label: "Coverage",
    icon: ListChecks,
    tone: "bg-violet-50 text-violet-800 border-violet-200",
    iconTone: "border-violet-200/80 bg-violet-50 text-violet-700",
  },
  trends: {
    label: "Trends",
    icon: ClipboardList,
    tone: "bg-amber-50 text-amber-900 border-amber-200",
    iconTone: "border-amber-200/80 bg-amber-50 text-amber-800",
  },
};

export function InfoSectionHeader({
  kind,
  title,
  description,
  actions,
}: {
  kind: InfoSectionKind;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const meta = SECTION_META[kind];
  const Icon = meta.icon;
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
              meta.iconTone,
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <Badge
              variant="outline"
              className={cn(
                "gap-1 text-[10px] font-semibold uppercase tracking-wider",
                meta.tone,
              )}
            >
              {meta.label}
            </Badge>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <Separator className="bg-border/60" />
    </div>
  );
}

export type IssuePriority = "high" | "medium" | "low";

export type AdminIssue = {
  id: string;
  kind: "water" | "solar" | "meter";
  typeLabel: string;
  title: string;
  summary: string;
  tehsil: string;
  village: string;
  settlement: string;
  affectedArea: string;
  lastLogLabel: string;
  assignedLabel: string;
  priority: IssuePriority;
  priorityLabel: string;
  detailHref: string;
  systemId: string;
  uniqueIdentifier: string;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatSolarPeriod(
  year: number | null | undefined,
  month: number | null | undefined,
): string {
  if (!year || !month || month < 1 || month > 12) return "—";
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(
    0,
    Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function waterPriority(s: ProgramWaterSystemCoverage): IssuePriority {
  const operators = s.assigned_operators?.length ?? 0;
  const age = daysSince(s.lifetime_last_log_date);
  if (operators === 0 || !s.bulk_meter_installed || age == null || age >= 14) {
    return "high";
  }
  if (age >= 7) return "medium";
  return "medium";
}

function solarPriority(s: ProgramSolarSystemCoverage): IssuePriority {
  if (!s.lifetime_last_log_year) return "high";
  return "medium";
}

export function buildAdminIssues(
  water: ProgramWaterSystemCoverage[],
  solar: ProgramSolarSystemCoverage[],
  periodHint: string,
): AdminIssue[] {
  const issues: AdminIssue[] = [];

  for (const s of water.filter((x) => !x.logged)) {
    const age = daysSince(s.lifetime_last_log_date);
    const operators = s.assigned_operators ?? [];
    const assignedLabel =
      operators.length === 0
        ? "Unassigned"
        : operators.map((o) => o.name).join(", ");
    const summary =
      age == null
        ? `No daily log on record · ${periodHint}`
        : age >= 7
          ? `No daily log · ${age}d since last · ${periodHint}`
          : `No daily log · ${periodHint}`;

    const priority = waterPriority(s);
    issues.push({
      id: `water-missing-${s.id}`,
      kind: "water",
      typeLabel: "Water",
      title: s.unique_identifier,
      summary,
      tehsil: s.tehsil || "Unknown",
      village: s.village || "—",
      settlement: s.settlement || "",
      affectedArea: [s.tehsil, s.village, s.settlement]
        .filter(Boolean)
        .join(" · "),
      lastLogLabel: formatAdminDate(s.lifetime_last_log_date),
      assignedLabel,
      priority,
      priorityLabel:
        priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low",
      detailHref: hqRoutes.waterSystem(s.id),
      systemId: s.id,
      uniqueIdentifier: s.unique_identifier,
    });
  }

  for (const s of solar.filter((x) => !x.logged)) {
    const priority = solarPriority(s);
    issues.push({
      id: `solar-missing-${s.id}`,
      kind: "solar",
      typeLabel: "Solar",
      title: s.unique_identifier,
      summary: `No monthly log · ${periodHint}`,
      tehsil: s.tehsil || "Unknown",
      village: s.village || "—",
      settlement: s.settlement || "",
      affectedArea: [s.tehsil, s.village, s.settlement]
        .filter(Boolean)
        .join(" · "),
      lastLogLabel: formatSolarPeriod(
        s.lifetime_last_log_year,
        s.lifetime_last_log_month,
      ),
      assignedLabel: "—",
      priority,
      priorityLabel:
        priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low",
      detailHref: hqRoutes.solarSite(s.id),
      systemId: s.id,
      uniqueIdentifier: s.unique_identifier,
    });
  }

  const priorityRank: Record<IssuePriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return issues.sort(
    (a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority] ||
      a.tehsil.localeCompare(b.tehsil) ||
      a.village.localeCompare(b.village) ||
      a.title.localeCompare(b.title),
  );
}

function priorityBadge(priority: IssuePriority) {
  if (priority === "high") {
    return (
      <Badge
        variant="outline"
        className="border-rose-300 bg-rose-50 font-normal text-rose-800"
      >
        High
      </Badge>
    );
  }
  if (priority === "medium") {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 font-normal text-amber-900"
      >
        Medium
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal">
      Low
    </Badge>
  );
}

function IssueRowDetails({ issue }: { issue: AdminIssue }) {
  return (
    <DetailTile
      title={issue.kind === "water" ? "Water logging gap" : "Solar logging gap"}
      summary={issue.summary}
      actionHref={issue.detailHref}
      actionLabel="Open site"
      fields={[
        { label: "Area", value: issue.affectedArea || "—" },
        { label: "Last log", value: issue.lastLogLabel },
        {
          label: "Operator",
          value: issue.kind === "solar" ? "—" : issue.assignedLabel,
        },
      ]}
    />
  );
}

type IssueGridRow = AdminIssue & Record<string, unknown>;

function useIssueGridColumns(): Array<ColumnDef<IssueGridRow, unknown>> {
  return useMemo(
    () => [
      {
        accessorKey: "priorityLabel",
        header: "Priority",
        cell: ({ row }) => priorityBadge(row.original.priority),
        meta: {
          filterVariant: "select",
          filterOptions: ["High", "Medium", "Low"],
        } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "typeLabel",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal">
            {row.original.typeLabel}
          </Badge>
        ),
        meta: {
          filterVariant: "select",
          filterOptions: ["Water", "Solar"],
        } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "title",
        header: "System ID",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.title}
          </span>
        ),
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "tehsil",
        header: "Tehsil",
        meta: { filterVariant: "select" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "lastLogLabel",
        header: "Last log",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "assignedLabel",
        header: "Operator",
        cell: ({ getValue }) => {
          const v = String(getValue() ?? "");
          return (
            <span
              className={cn(
                v === "Unassigned" && "font-medium text-rose-700",
              )}
            >
              {v}
            </span>
          );
        },
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={row.original.detailHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open
            <ArrowRight className="size-3" />
          </Link>
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
    ],
    [],
  );
}

export const AdminIssuesPanel = memo(function AdminIssuesPanel({
  issues,
  loading,
  periodHint,
}: {
  issues: AdminIssue[];
  loading: boolean;
  periodHint: string;
}) {
  const columns = useIssueGridColumns();

  const summary = useMemo(() => {
    const high = issues.filter((i) => i.priority === "high").length;
    const water = issues.filter((i) => i.kind === "water").length;
    const solar = issues.filter((i) => i.kind === "solar").length;
    const tehsils = new Set(issues.map((i) => i.tehsil)).size;
    const villages = new Set(
      issues.map((i) => `${i.tehsil}|${i.village}`),
    ).size;
    return { high, water, solar, tehsils, villages };
  }, [issues]);

  const gridRows = useMemo(
    () => issues as unknown as IssueGridRow[],
    [issues],
  );

  return (
    <section className="space-y-3">
      <InfoSectionHeader
        kind="issues"
        title="Attention needed"
        description={`${periodHint} · sites missing logs`}
        actions={
          !loading && issues.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.high > 0 ? (
                <Badge
                  variant="outline"
                  className="border-rose-300 bg-rose-50 font-normal text-rose-800"
                >
                  {summary.high} high
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-normal">
                {summary.water} water · {summary.solar} solar
              </Badge>
              <Badge variant="outline" className="font-normal">
                {summary.tehsils} tehsils · {summary.villages} villages
              </Badge>
              <Badge variant="outline" className="font-normal">
                {issues.length} open
              </Badge>
            </div>
          ) : null
        }
      />

      {loading ? (
        <DataGridSkeleton rows={8} columns={7} />
      ) : issues.length === 0 ? (
        <Card className="gap-0 py-0 ring-border/50">
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle2 className="text-emerald-600" />
              </EmptyMedia>
              <EmptyTitle>No open logging issues</EmptyTitle>
              <EmptyDescription>
                All systems logged for {periodHint}.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <DataGrid
          title="Issue register"
          description="One row per site. Filter, sort, export."
          rows={gridRows}
          columns={columns}
          exportFileName={`issues-${periodHint.replace(/\s+/g, "-")}`}
          initialPageSize={25}
          getRowId={(row) => String(row.id)}
          renderRowDetails={(row) => <IssueRowDetails issue={row} />}
        />
      )}
    </section>
  );
});

export type TehsilCoverageTone = "good" | "watch" | "risk" | "neutral";

export type TehsilCoverageInput = {
  tehsil: string;
  water_sites: number;
  water_sites_logged: number;
  water_logs: number;
  solar_sites: number;
  solar_sites_logged: number;
  solar_logs: number;
  waterPct: number | null;
  solarPct: number | null;
  avg: number;
  tone: TehsilCoverageTone;
  waterMissing: ProgramWaterSystemCoverage[];
  waterLogged: ProgramWaterSystemCoverage[];
  solarMissing: ProgramSolarSystemCoverage[];
  solarLogged: ProgramSolarSystemCoverage[];
};

function coverageTone(pct: number | null): TehsilCoverageTone {
  if (pct == null || !Number.isFinite(pct)) return "neutral";
  if (pct >= 70) return "good";
  if (pct >= 40) return "watch";
  return "risk";
}

/** Rank tehsils by logging coverage for Sites Progress / coverage grids. */
export function buildRankedTehsilCoverage(
  tehsilRows: Array<{
    tehsil: string;
    water_sites: number;
    solar_sites: number;
    water_logs: number;
    solar_logs: number;
    water_sites_logged: number;
    solar_sites_logged: number;
  }>,
  waterSystems: ProgramWaterSystemCoverage[],
  solarSystems: ProgramSolarSystemCoverage[],
): TehsilCoverageInput[] {
  const waterByTehsil = new Map<string, ProgramWaterSystemCoverage[]>();
  for (const s of waterSystems) {
    const list = waterByTehsil.get(s.tehsil) ?? [];
    list.push(s);
    waterByTehsil.set(s.tehsil, list);
  }
  const solarByTehsil = new Map<string, ProgramSolarSystemCoverage[]>();
  for (const s of solarSystems) {
    const list = solarByTehsil.get(s.tehsil) ?? [];
    list.push(s);
    solarByTehsil.set(s.tehsil, list);
  }

  return tehsilRows
    .map((row) => {
      const waterPct =
        row.water_sites > 0
          ? Math.round((100 * row.water_sites_logged) / row.water_sites)
          : null;
      const solarPct =
        row.solar_sites > 0
          ? Math.round((100 * row.solar_sites_logged) / row.solar_sites)
          : null;
      const scores = [waterPct, solarPct].filter(
        (v): v is number => v != null,
      );
      const avg =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
      const waterList = waterByTehsil.get(row.tehsil) ?? [];
      const solarList = solarByTehsil.get(row.tehsil) ?? [];
      return {
        ...row,
        waterPct,
        solarPct,
        avg,
        tone: coverageTone(avg),
        waterMissing: waterList.filter((s) => !s.logged),
        waterLogged: waterList.filter((s) => s.logged),
        solarMissing: solarList.filter((s) => !s.logged),
        solarLogged: solarList.filter((s) => s.logged),
      };
    })
    .sort((a, b) => a.avg - b.avg);
}

type TehsilGridRow = {
  id: string;
  tehsil: string;
  statusLabel: string;
  tone: TehsilCoverageTone;
  facilities: number;
  waterCoverage: string;
  solarCoverage: string;
  missingLogs: number;
  avg: number;
  water_sites: number;
  water_sites_logged: number;
  water_logs: number;
  solar_sites: number;
  solar_sites_logged: number;
  solar_logs: number;
  waterPct: number | null;
  solarPct: number | null;
  waterMissing: ProgramWaterSystemCoverage[];
  waterLogged: ProgramWaterSystemCoverage[];
  solarMissing: ProgramSolarSystemCoverage[];
  solarLogged: ProgramSolarSystemCoverage[];
} & Record<string, unknown>;

function toneStatusLabel(tone: TehsilCoverageTone): string {
  if (tone === "good") return "On track";
  if (tone === "watch") return "Needs attention";
  if (tone === "risk") return "Behind";
  return "—";
}

function tehsilStatusBadge(tone: TehsilCoverageTone) {
  if (tone === "good") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 font-normal text-emerald-800"
      >
        On track
      </Badge>
    );
  }
  if (tone === "watch") {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 font-normal text-amber-900"
      >
        Needs attention
      </Badge>
    );
  }
  if (tone === "risk") {
    return (
      <Badge
        variant="outline"
        className="border-rose-200 bg-rose-50 font-normal text-rose-800"
      >
        Behind
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal">
      —
    </Badge>
  );
}

const DETAIL_CAP = 12;

function SystemIdLinks({
  systems,
  kind,
}: {
  systems: Array<{ id: string; unique_identifier: string; village: string }>;
  kind: "water" | "solar";
}) {
  if (systems.length === 0) {
    return <p className="text-xs text-muted-foreground">None</p>;
  }
  const shown = systems.slice(0, DETAIL_CAP);
  const rest = systems.length - shown.length;
  return (
    <ul className="space-y-1">
      {shown.map((s) => (
        <li key={s.id}>
          <Link
            to={
              kind === "water"
                ? hqRoutes.waterSystem(s.id)
                : hqRoutes.solarSite(s.id)
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {s.unique_identifier}
            <ArrowRight className="size-3 opacity-60" />
          </Link>
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            {s.village}
          </span>
        </li>
      ))}
      {rest > 0 ? (
        <li className="text-[11px] text-muted-foreground">
          +{rest} more — use Issue register filters for the full chase list
        </li>
      ) : null}
    </ul>
  );
}

function TehsilRowDetails({ row }: { row: TehsilGridRow }) {
  return (
    <DetailTile
      title={row.tehsil}
      summary={`${row.waterMissing.length + row.solarMissing.length} sites missing · avg ${row.avg}%`}
      fields={[
        {
          label: "Water",
          value: `${row.waterLogged.length} logged · ${row.waterMissing.length} missing`,
        },
        {
          label: "Solar",
          value: `${row.solarLogged.length} logged · ${row.solarMissing.length} missing`,
        },
        {
          label: "Coverage",
          value: `${row.avg}% average`,
        },
      ]}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Water systems
            </p>
            <Badge variant="outline" className="font-normal">
              {row.waterMissing.length} open
            </Badge>
          </div>
          {row.waterMissing.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-rose-800">Missing</p>
              <SystemIdLinks systems={row.waterMissing} kind="water" />
            </div>
          ) : null}
          {row.waterLogged.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-emerald-800">Logged</p>
              <SystemIdLinks systems={row.waterLogged} kind="water" />
            </div>
          ) : null}
          {row.water_sites === 0 ? (
            <p className="text-xs text-muted-foreground">No water systems</p>
          ) : null}
        </div>
        <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Solar systems
            </p>
            <Badge variant="outline" className="font-normal">
              {row.solarMissing.length} open
            </Badge>
          </div>
          {row.solarMissing.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-rose-800">Missing</p>
              <SystemIdLinks systems={row.solarMissing} kind="solar" />
            </div>
          ) : null}
          {row.solarLogged.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-emerald-800">Logged</p>
              <SystemIdLinks systems={row.solarLogged} kind="solar" />
            </div>
          ) : null}
          {row.solar_sites === 0 ? (
            <p className="text-xs text-muted-foreground">No solar systems</p>
          ) : null}
        </div>
      </div>
    </DetailTile>
  );
}

function useTehsilGridColumns(): Array<ColumnDef<TehsilGridRow, unknown>> {
  return useMemo(
    () => [
      {
        accessorKey: "tehsil",
        header: "Tehsil",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.tehsil}
          </span>
        ),
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "statusLabel",
        header: "Status",
        cell: ({ row }) => tehsilStatusBadge(row.original.tone),
        meta: {
          filterVariant: "select",
          filterOptions: ["Behind", "Needs attention", "On track", "—"],
        } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "facilities",
        header: "Facilities",
        cell: ({ getValue }) => (
          <span className="font-mono tabular-nums">{String(getValue())}</span>
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "waterCoverage",
        header: "Water logged",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "solarCoverage",
        header: "Solar logged",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "missingLogs",
        header: "Missing",
        cell: ({ getValue }) => {
          const n = Number(getValue() ?? 0);
          return (
            <span
              className={cn(
                "font-mono tabular-nums",
                n > 0 && "font-medium text-rose-700",
              )}
            >
              {n}
            </span>
          );
        },
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "avg",
        header: "Avg %",
        cell: ({ getValue }) => (
          <span className="font-mono tabular-nums">{String(getValue())}%</span>
        ),
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
      },
    ],
    [],
  );
}

export const TehsilCoveragePanel = memo(function TehsilCoveragePanel({
  rows,
  loading,
  periodHint,
  behindCount,
  watchCount,
}: {
  rows: TehsilCoverageInput[];
  loading: boolean;
  periodHint: string;
  behindCount: number;
  watchCount: number;
}) {
  const columns = useTehsilGridColumns();

  const gridRows = useMemo<TehsilGridRow[]>(
    () =>
      rows.map((row) => {
        const missingLogs =
          row.waterMissing.length + row.solarMissing.length;
        const waterCoverage =
          row.water_sites > 0
            ? `${row.water_sites_logged}/${row.water_sites}${
                row.waterPct != null ? ` (${row.waterPct}%)` : ""
              }`
            : "—";
        const solarCoverage =
          row.solar_sites > 0
            ? `${row.solar_sites_logged}/${row.solar_sites}${
                row.solarPct != null ? ` (${row.solarPct}%)` : ""
              }`
            : "—";
        return {
          id: row.tehsil,
          tehsil: row.tehsil,
          statusLabel: toneStatusLabel(row.tone),
          tone: row.tone,
          facilities: row.water_sites + row.solar_sites,
          waterCoverage,
          solarCoverage,
          missingLogs,
          avg: row.avg,
          water_sites: row.water_sites,
          water_sites_logged: row.water_sites_logged,
          water_logs: row.water_logs,
          solar_sites: row.solar_sites,
          solar_sites_logged: row.solar_sites_logged,
          solar_logs: row.solar_logs,
          waterPct: row.waterPct,
          solarPct: row.solarPct,
          waterMissing: row.waterMissing,
          waterLogged: row.waterLogged,
          solarMissing: row.solarMissing,
          solarLogged: row.solarLogged,
        };
      }),
    [rows],
  );

  return (
    <section className="space-y-3">
      <InfoSectionHeader
        kind="demographics"
        title="Coverage by tehsil"
        description={`${periodHint} · logging rate by area`}
        actions={
          !loading && rows.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {behindCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-rose-200 bg-rose-50 font-normal text-rose-800"
                >
                  {behindCount} behind
                </Badge>
              ) : null}
              {watchCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 font-normal text-amber-900"
                >
                  {watchCount} need attention
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-normal">
                {rows.length} tehsils
              </Badge>
            </div>
          ) : null
        }
      />

      {loading ? (
        <DataGridSkeleton rows={8} columns={7} />
      ) : rows.length === 0 ? (
        <Card className="gap-0 py-0 ring-border/50">
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecks />
              </EmptyMedia>
              <EmptyTitle>No tehsil coverage data</EmptyTitle>
              <EmptyDescription>
                Adjust the view filters or wait for systems to load in this
                scope.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <DataGrid
          title="Tehsil coverage"
          description="One row per tehsil. Sort by missing or avg %."
          rows={gridRows}
          columns={columns}
          exportFileName={`tehsil-coverage-${periodHint.replace(/\s+/g, "-")}`}
          initialPageSize={25}
          getRowId={(row) => String(row.id)}
          renderRowDetails={(row) => <TehsilRowDetails row={row} />}
        />
      )}
    </section>
  );
});
