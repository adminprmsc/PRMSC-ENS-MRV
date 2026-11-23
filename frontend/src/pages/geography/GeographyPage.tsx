import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Droplets,
  History,
  Home,
  Info,
  Loader2,
  MapPinned,
  RefreshCcw,
  Save,
  Search,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout";
import { StatCard } from "@/components/layout/StatCard";
import { PopulationCounter } from "@/components/geography/PopulationCounter";
import {
  CoverageBar,
  STATUS_FILTERS,
  StatusChip,
  ToolbarField,
  downloadCsv,
  villageStatus,
  type VillageStatus,
} from "@/components/geography/geography-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  formatPopulation,
  getGeography,
  getPopulationCoverage,
  getPopulationHistory,
  savePopulation,
  villageKey,
  type GeoTehsil,
  type GeoVillage,
  type GeographyResponse,
  type PopulationHistoryItem,
  type PopulationUpdate,
  type VillageCoverage,
} from "@/services/geographyService";
import { formatPakistanDateTime } from "@/utils/pakistanTime";

const STEPS = [1, 10, 100, 1000] as const;
const PAGE_SIZE = 50;

const SORTS = [
  { value: "population", label: "Population (high → low)" },
  { value: "name", label: "Name (A → Z)" },
  { value: "coverage", label: "Served % (low → high)" },
  { value: "updated", label: "Recently updated" },
] as const;
type SortKey = (typeof SORTS)[number]["value"];

type Key = `${"village" | "settlement"}:${string}`;
const vKey = (id: string): Key => `village:${id}`;
const sKey = (id: string): Key => `settlement:${id}`;

type Coverage = {
  siteCount: number;
  mainCovered: boolean;
  settlementCovered: (name: string) => boolean;
};

type VillageView = {
  v: GeoVillage;
  cov: Coverage;
  total: number;
  served: number;
  status: VillageStatus;
  dirty: boolean;
  open: boolean;
};

/**
 * Geography & population — shared by Tehsil Managers, Manager Operations
 * and the platform admin. The API limits every call to the caller's tehsils.
 */
export default function GeographyPage() {
  const [data, setData] = useState<GeographyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PopulationHistoryItem[]>([]);
  const [coverage, setCoverage] = useState<Map<string, VillageCoverage>>(
    new Map(),
  );
  const [tehsil, setTehsil] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("population");
  const [step, setStep] = useState<number>(1);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Map<Key, number>>(new Map());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [geo, hist, cov] = await Promise.all([
        getGeography(),
        getPopulationHistory({ limit: 50 }).catch(() => ({ items: [] })),
        getPopulationCoverage().catch(() => null),
      ]);
      setData(geo);
      setHistory(hist.items ?? []);
      setCoverage(
        new Map(
          (cov?.villages ?? []).map((v) => [villageKey(v.tehsil, v.village), v]),
        ),
      );
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load geography"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tehsil && data?.tehsils[0]) setTehsil(data.tehsils[0].tehsil);
  }, [data, tehsil]);

  // Warn before leaving with unsaved counter changes.
  useEffect(() => {
    if (!pending.size) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [pending.size]);

  useEffect(
    () => setVisible(PAGE_SIZE),
    [tehsil, search, statusFilter, sort],
  );

  const canEdit = data?.scope.can_edit ?? false;

  /** Saved values, for diffing against pending edits. */
  const saved = useMemo(() => {
    const m = new Map<Key, number>();
    for (const t of data?.tehsils ?? []) {
      for (const v of t.villages) {
        m.set(vKey(v.id), v.population);
        for (const s of v.settlements) m.set(sKey(s.id), s.population);
      }
    }
    return m;
  }, [data]);

  const valueOf = useCallback(
    (k: Key) => pending.get(k) ?? saved.get(k) ?? 0,
    [pending, saved],
  );

  const setValue = useCallback(
    (k: Key, n: number) => {
      setPending((prev) => {
        const next = new Map(prev);
        if (saved.get(k) === n) next.delete(k);
        else next.set(k, n);
        return next;
      });
    },
    [saved],
  );

  /**
   * Which areas a water site covers comes from the server (site registrations);
   * the head-counts come from the counters, so served updates as you edit.
   */
  const coverageOf = useCallback(
    (tehsilName: string, v: GeoVillage): Coverage => {
      const cov = coverage.get(villageKey(tehsilName, v.name));
      const coveredSettlements = new Set(
        (cov?.settlements ?? [])
          .filter((s) => s.site_ids.length > 0)
          .map((s) => s.name.trim().toUpperCase()),
      );
      return {
        siteCount: cov?.site_count ?? 0,
        mainCovered: cov?.main_covered ?? false,
        settlementCovered: (name: string) =>
          coveredSettlements.has(name.trim().toUpperCase()),
      };
    },
    [coverage],
  );

  const villageTotals = useCallback(
    (tehsilName: string, v: GeoVillage) => {
      const cov = coverageOf(tehsilName, v);
      let total = valueOf(vKey(v.id));
      let served = cov.mainCovered ? total : 0;
      for (const s of v.settlements) {
        const n = valueOf(sKey(s.id));
        total += n;
        if (cov.settlementCovered(s.name)) served += n;
      }
      return { cov, total, served };
    },
    [coverageOf, valueOf],
  );

  const tehsilTotals = useCallback(
    (t: GeoTehsil) => {
      let total = 0;
      let served = 0;
      let counted = 0;
      for (const v of t.villages) {
        const r = villageTotals(t.tehsil, v);
        total += r.total;
        served += r.served;
        if (r.total > 0) counted += 1;
      }
      return { total, served, counted };
    },
    [villageTotals],
  );

  const tehsilStats = useMemo(
    () =>
      new Map(
        (data?.tehsils ?? []).map((t) => [t.tehsil, tehsilTotals(t)] as const),
      ),
    [data, tehsilTotals],
  );

  const scopeTotals = useMemo(() => {
    let population = 0;
    let served = 0;
    let counted = 0;
    for (const s of tehsilStats.values()) {
      population += s.total;
      served += s.served;
      counted += s.counted;
    }
    return {
      population,
      served,
      counted,
      villages: data?.totals.village_count ?? 0,
      settlements: data?.totals.settlement_count ?? 0,
    };
  }, [tehsilStats, data]);

  const current = data?.tehsils.find((t) => t.tehsil === tehsil) ?? null;
  const currentStats = current ? tehsilStats.get(current.tehsil) : undefined;

  const rows = useMemo((): VillageView[] => {
    if (!current) return [];
    const q = search.trim().toUpperCase();
    const out: VillageView[] = [];
    for (const v of current.villages) {
      const nameHit = !q || v.name.toUpperCase().includes(q);
      const settlementHit =
        !!q && v.settlements.some((s) => s.name.toUpperCase().includes(q));
      if (!nameHit && !settlementHit) continue;
      const { cov, total, served } = villageTotals(current.tehsil, v);
      const status = villageStatus(total, served, cov.siteCount);
      const dirty =
        pending.has(vKey(v.id)) ||
        v.settlements.some((s) => pending.has(sKey(s.id)));
      if (statusFilter === "unsaved" ? !dirty : statusFilter !== "all" && status !== statusFilter) {
        continue;
      }
      out.push({
        v,
        cov,
        total,
        served,
        status,
        dirty,
        open: expanded.has(v.id) || settlementHit,
      });
    }
    const ratio = (r: VillageView) => (r.total > 0 ? r.served / r.total : -1);
    out.sort((a, b) => {
      if (sort === "name") return a.v.name.localeCompare(b.v.name);
      if (sort === "coverage") return ratio(a) - ratio(b) || b.total - a.total;
      if (sort === "updated") {
        return (
          String(b.v.population_updated_at ?? "").localeCompare(
            String(a.v.population_updated_at ?? ""),
          ) || a.v.name.localeCompare(b.v.name)
        );
      }
      return b.total - a.total || a.v.name.localeCompare(b.v.name);
    });
    return out;
  }, [current, search, statusFilter, sort, villageTotals, pending, expanded]);

  const netDelta = useMemo(() => {
    let d = 0;
    for (const [k, n] of pending) d += n - (saved.get(k) ?? 0);
    return d;
  }, [pending, saved]);

  const toggleExpanded = useCallback(
    (id: string) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const withSettlements = rows.filter((r) => r.v.settlement_count > 0);
  const allExpanded =
    withSettlements.length > 0 && withSettlements.every((r) => r.open);

  const save = useCallback(async () => {
    if (!pending.size || saving) return;
    const updates: PopulationUpdate[] = [...pending].map(([k, population]) => {
      const [type, id] = k.split(":") as ["village" | "settlement", string];
      return { type, id, population };
    });
    setSaving(true);
    try {
      const res = await savePopulation(updates);
      toast.success(res.message);
      setPending(new Map());
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not save population"));
    } finally {
      setSaving(false);
    }
  }, [pending, saving, load]);

  // Ctrl/⌘ + S saves.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        if (!pending.size) return;
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pending.size, save]);

  const refresh = () => {
    if (
      pending.size &&
      !window.confirm("Discard unsaved population changes and reload?")
    ) {
      return;
    }
    setPending(new Map());
    void load();
  };

  const exportCsv = () => {
    if (!data) return;
    const out: Array<Array<string | number>> = [
      ["Tehsil", "Village", "Settlement", "Population", "Served by water sites", "Water sites in village"],
    ];
    for (const t of data.tehsils) {
      for (const v of t.villages) {
        const cov = coverageOf(t.tehsil, v);
        const main = valueOf(vKey(v.id));
        out.push([t.tehsil, v.name, "(main abadi)", main, cov.mainCovered ? main : 0, cov.siteCount]);
        for (const s of v.settlements) {
          const n = valueOf(sKey(s.id));
          out.push([t.tehsil, v.name, s.name, n, cov.settlementCovered(s.name) ? n : 0, cov.siteCount]);
        }
      }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`population-${stamp}.csv`, out);
    if (pending.size) toast.info("Export includes your unsaved changes.");
  };

  const scopeLabel = data
    ? data.scope.tehsils.length === 1
      ? data.scope.tehsils[0]
      : `${data.scope.tehsils.length} tehsils`
    : "Loading…";

  const noScope = !loading && data && data.scope.tehsils.length === 0;
  const servedPct =
    scopeTotals.population > 0
      ? Math.round((100 * scopeTotals.served) / scopeTotals.population)
      : null;

  return (
    <PageShell className={cn(pending.size > 0 && "pb-24 md:pb-0")}>
      <PageHeader
        icon={<MapPinned />}
        title="Geography & population"
        description="Villages and settlements in your tehsils, with head-counts that roll up to the Command Center."
        badge={
          <Badge variant="outline" className="text-xs font-medium">
            {scopeLabel}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !data}
              onClick={exportCsv}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button variant="outline" size="sm" disabled={loading} onClick={refresh}>
              <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
      />

      {noScope ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <MapPinned className="size-8 text-muted-foreground" />
            <p className="font-medium">No tehsils assigned</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Ask the platform administrator to assign tehsils to your account
              to see and manage their geography.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── KPIs ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Total population"
              value={formatPopulation(scopeTotals.population)}
              description={
                netDelta
                  ? `${netDelta > 0 ? "+" : ""}${formatPopulation(netDelta)} unsaved`
                  : `Across ${data?.totals.tehsil_count ?? 0} tehsil${data?.totals.tehsil_count === 1 ? "" : "s"}`
              }
              icon={<Users className="size-4" />}
              accent="violet"
              loading={loading}
            />
            <StatCard
              label="Served by water sites"
              value={
                <>
                  {formatPopulation(scopeTotals.served)}
                  {servedPct !== null ? (
                    <span className="ml-1.5 text-base font-medium text-muted-foreground">
                      {servedPct}%
                    </span>
                  ) : null}
                </>
              }
              description={`${formatPopulation(Math.max(0, scopeTotals.population - scopeTotals.served))} not served`}
              icon={<Droplets className="size-4" />}
              accent="blue"
              loading={loading}
            />
            <StatCard
              label="Villages counted"
              value={
                <>
                  {formatPopulation(scopeTotals.counted)}
                  <span className="ml-1 text-base font-medium text-muted-foreground">
                    / {formatPopulation(scopeTotals.villages)}
                  </span>
                </>
              }
              description="Villages with a population entered"
              icon={<Home className="size-4" />}
              accent="green"
              loading={loading}
            />
            <StatCard
              label="Settlements"
              value={formatPopulation(scopeTotals.settlements)}
              description="Inside those villages"
              icon={<MapPinned className="size-4" />}
              accent="slate"
              loading={loading}
            />
          </div>

          {/* ── Tehsil overview (scrolls sideways on phones) ─────── */}
          {data && data.tehsils.length > 1 ? (
            <section aria-label="Tehsils" className="-mx-1">
              <div className="flex snap-x gap-3 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
                {data.tehsils.map((t) => {
                  const st = tehsilStats.get(t.tehsil);
                  const active = t.tehsil === tehsil;
                  return (
                    <button
                      key={t.tehsil}
                      type="button"
                      onClick={() => setTehsil(t.tehsil)}
                      aria-pressed={active}
                      className={cn(
                        "min-w-[220px] snap-start rounded-xl border bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active && "border-primary ring-2 ring-primary/15",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t.tehsil}
                        </p>
                        {active ? (
                          <span className="size-2 shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
                        {formatPopulation(st?.total ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {st?.counted ?? 0}/{t.village_count} villages counted ·{" "}
                        {t.settlement_count} settlements
                      </p>
                      <CoverageBar
                        className="mt-3"
                        served={st?.served ?? 0}
                        total={st?.total ?? 0}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!loading && data && !canEdit ? (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              You can view population for your tehsils but not edit it.
            </div>
          ) : null}

          <Tabs defaultValue="villages">
            <TabsList>
              <TabsTrigger value="villages">
                Villages
                {pending.size ? (
                  <Badge className="ml-1.5 h-5 bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-500">
                    {pending.size}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="log">
                <History className="size-3.5" />
                Change log
              </TabsTrigger>
            </TabsList>

            {/* ── Villages ─────────────────────────────────────── */}
            <TabsContent value="villages" className="mt-4">
              <Card className="overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="space-y-3 border-b border-border/60 bg-muted/20 p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <ToolbarField label="Search">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Village or settlement…"
                          className="h-9 bg-background pl-8 pr-8"
                          aria-label="Search village or settlement"
                        />
                        {search ? (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </ToolbarField>
                    <ToolbarField label="Tehsil">
                      <Select
                        value={tehsil || undefined}
                        onValueChange={(v) => v && setTehsil(v)}
                      >
                        <SelectTrigger className="h-9 w-full bg-background">
                          <SelectValue placeholder="Select tehsil" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {(data?.scope.tehsils ?? []).map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ToolbarField>
                    <ToolbarField label="Status">
                      <Select
                        value={statusFilter}
                        onValueChange={(v) => v && setStatusFilter(v)}
                      >
                        <SelectTrigger className="h-9 w-full bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_FILTERS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ToolbarField>
                    <ToolbarField label="Sort">
                      <Select
                        value={sort}
                        onValueChange={(v) => v && setSort(v as SortKey)}
                      >
                        <SelectTrigger className="h-9 w-full bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SORTS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ToolbarField>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {current ? (
                        <>
                          <span className="font-medium text-foreground">
                            {rows.length}
                          </span>{" "}
                          of {current.village_count} villages ·{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatPopulation(currentStats?.total ?? 0)}
                          </span>{" "}
                          people ·{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatPopulation(currentStats?.served ?? 0)}
                          </span>{" "}
                          served
                        </>
                      ) : (
                        "Select a tehsil"
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit ? (
                        <div
                          className="flex h-8 overflow-hidden rounded-md border border-input bg-background"
                          role="group"
                          aria-label="Counter step"
                        >
                          <span className="hidden items-center border-r border-input px-2 text-[11px] font-medium uppercase text-muted-foreground sm:flex">
                            Step
                          </span>
                          {STEPS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStep(s)}
                              aria-pressed={s === step}
                              className={cn(
                                "px-2.5 text-xs font-medium tabular-nums transition-colors",
                                s === step
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted",
                              )}
                            >
                              ±{s.toLocaleString("en-US")}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {withSettlements.length ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            setExpanded(
                              allExpanded
                                ? new Set()
                                : new Set(withSettlements.map((r) => r.v.id)),
                            )
                          }
                        >
                          {allExpanded ? (
                            <ChevronsDownUp className="size-4" />
                          ) : (
                            <ChevronsUpDown className="size-4" />
                          )}
                          {allExpanded ? "Collapse all" : "Expand all"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                    <Search className="size-6 text-muted-foreground" />
                    <p className="font-medium">No villages match</p>
                    <p className="text-sm text-muted-foreground">
                      Try a different search or status filter.
                    </p>
                    {search || statusFilter !== "all" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden max-h-[70vh] overflow-auto md:block">
                      <table className="w-full caption-bottom text-sm">
                        <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
                          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-2.5 font-semibold">Village / settlement</th>
                            <th className="px-3 py-2.5 font-semibold">
                              Population
                              <span className="block text-[10px] font-normal normal-case tracking-normal">
                                main abadi or settlement
                              </span>
                            </th>
                            <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                            <th className="w-[200px] px-3 py-2.5 font-semibold">Served by water sites</th>
                            <th className="px-3 py-2.5 font-semibold">Status</th>
                            <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, visible).map((r) => (
                            <DesktopVillageRows
                              key={r.v.id}
                              row={r}
                              canEdit={canEdit}
                              step={step}
                              valueOf={valueOf}
                              setValue={setValue}
                              isDirty={(k) => pending.has(k)}
                              onToggle={() => toggleExpanded(r.v.id)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <ul className="divide-y md:hidden">
                      {rows.slice(0, visible).map((r) => (
                        <MobileVillageCard
                          key={r.v.id}
                          row={r}
                          canEdit={canEdit}
                          step={step}
                          valueOf={valueOf}
                          setValue={setValue}
                          isDirty={(k) => pending.has(k)}
                          onToggle={() => toggleExpanded(r.v.id)}
                        />
                      ))}
                    </ul>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                      <span>
                        Showing {Math.min(visible, rows.length)} of {rows.length}
                      </span>
                      {rows.length > visible ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVisible((n) => n + PAGE_SIZE)}
                        >
                          Show {Math.min(PAGE_SIZE, rows.length - visible)} more
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </Card>
            </TabsContent>

            {/* ── Change log ───────────────────────────────────── */}
            <TabsContent value="log" className="mt-4">
              <Card className="overflow-hidden shadow-sm">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                    <History className="size-6 text-muted-foreground" />
                    <p className="font-medium">No changes yet</p>
                    <p className="text-sm text-muted-foreground">
                      Every saved population change is recorded here.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {history.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            <span className="font-medium">
                              {h.settlement ?? h.village}
                            </span>
                            <span className="text-muted-foreground">
                              {h.settlement ? ` · ${h.village}` : " · main abadi"}{" "}
                              · {h.tehsil}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {h.performed_by_name ?? "Unknown user"} ·{" "}
                            {h.created_at
                              ? formatPakistanDateTime(h.created_at)
                              : "—"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm tabular-nums">
                          <span className="text-muted-foreground">
                            {formatPopulation(h.previous_population)} →
                          </span>{" "}
                          <span className="font-semibold">
                            {formatPopulation(h.new_population)}
                          </span>{" "}
                          <span
                            className={cn(
                              "ml-1 rounded px-1.5 py-0.5 text-xs font-medium",
                              h.delta >= 0
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                            )}
                          >
                            {h.delta >= 0 ? "+" : ""}
                            {formatPopulation(h.delta)}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ── Save bar: fixed on phones, floating on desktop ──────── */}
      {pending.size > 0 ? (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:sticky md:inset-x-auto md:bottom-4 md:mx-auto md:w-full md:max-w-2xl md:rounded-xl md:border md:border-amber-300 md:shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p>
                <span className="font-semibold">{pending.size}</span> unsaved
                change{pending.size === 1 ? "" : "s"}
                <span className="text-muted-foreground"> · net </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    netDelta >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {netDelta >= 0 ? "+" : ""}
                  {formatPopulation(netDelta)}
                </span>
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Press Ctrl/⌘ + S to save
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setPending(new Map())}
              >
                <Undo2 className="size-4" />
                <span className="hidden sm:inline">Discard</span>
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void save()}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

type RowProps = {
  row: VillageView;
  canEdit: boolean;
  step: number;
  valueOf: (k: Key) => number;
  setValue: (k: Key, n: number) => void;
  isDirty: (k: Key) => boolean;
  onToggle: () => void;
};

function Expander({
  open,
  count,
  onToggle,
  name,
}: {
  open: boolean;
  count: number;
  onToggle: () => void;
  name: string;
}) {
  if (!count) return <span className="inline-block w-5" />;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} ${count} settlements in ${name}`}
      className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}

function PopulationCell({
  k,
  label,
  canEdit,
  step,
  valueOf,
  setValue,
  isDirty,
}: {
  k: Key;
  label: string;
} & Pick<RowProps, "canEdit" | "step" | "valueOf" | "setValue" | "isDirty">) {
  return canEdit ? (
    <PopulationCounter
      size="sm"
      label={label}
      value={valueOf(k)}
      step={step}
      dirty={isDirty(k)}
      onChange={(n) => setValue(k, n)}
    />
  ) : (
    <span className="tabular-nums">{formatPopulation(valueOf(k))}</span>
  );
}

function DesktopVillageRows({
  row,
  canEdit,
  step,
  valueOf,
  setValue,
  isDirty,
  onToggle,
}: RowProps) {
  const { v, cov, total, served, status, dirty, open } = row;
  return (
    <>
      <tr
        className={cn(
          "border-b transition-colors hover:bg-muted/30",
          dirty && "bg-amber-50/50 dark:bg-amber-950/10",
        )}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <Expander
              open={open}
              count={v.settlement_count}
              onToggle={onToggle}
              name={v.name}
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{v.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {v.settlement_count
                  ? `${v.settlement_count} settlement${v.settlement_count === 1 ? "" : "s"}`
                  : "No settlements"}
                {cov.siteCount
                  ? ` · ${cov.siteCount} water site${cov.siteCount === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <PopulationCell
            k={vKey(v.id)}
            label={`${v.name} main abadi population`}
            {...{ canEdit, step, valueOf, setValue, isDirty }}
          />
        </td>
        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
          {formatPopulation(total)}
        </td>
        <td className="px-3 py-2.5">
          {cov.siteCount ? (
            <CoverageBar served={served} total={total} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {cov.siteCount > 0 && !cov.mainCovered && v.population > 0 ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Main abadi not covered
            </p>
          ) : null}
        </td>
        <td className="px-3 py-2.5">
          <StatusChip status={status} />
        </td>
        <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground lg:table-cell">
          {v.population_updated_at
            ? formatPakistanDateTime(v.population_updated_at)
            : "—"}
        </td>
      </tr>
      {open
        ? v.settlements.map((s) => {
            const covered = cov.settlementCovered(s.name);
            return (
              <tr key={s.id} className="border-b bg-muted/20 text-sm">
                <td className="py-2 pl-12 pr-4">
                  <p className="truncate">
                    <span className="mr-1 text-muted-foreground">↳</span>
                    {s.name}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <PopulationCell
                    k={sKey(s.id)}
                    label={`${s.name} population`}
                    {...{ canEdit, step, valueOf, setValue, isDirty }}
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {formatPopulation(valueOf(sKey(s.id)))}
                </td>
                <td className="px-3 py-2 text-xs">
                  {covered ? (
                    <span className="font-medium tabular-nums text-[var(--chart-1)]">
                      {formatPopulation(valueOf(sKey(s.id)))} served
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not served</span>
                  )}
                </td>
                <td className="px-3 py-2" />
                <td className="hidden whitespace-nowrap px-4 py-2 text-xs text-muted-foreground lg:table-cell">
                  {s.population_updated_at
                    ? formatPakistanDateTime(s.population_updated_at)
                    : "—"}
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}

function MobileVillageCard({
  row,
  canEdit,
  step,
  valueOf,
  setValue,
  isDirty,
  onToggle,
}: RowProps) {
  const { v, cov, total, served, status, dirty, open } = row;
  return (
    <li className={cn("space-y-3 p-4", dirty && "bg-amber-50/50 dark:bg-amber-950/10")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-tight">{v.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {v.settlement_count} settlement{v.settlement_count === 1 ? "" : "s"}
            {cov.siteCount
              ? ` · ${cov.siteCount} water site${cov.siteCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <StatusChip status={status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Total</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatPopulation(total)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Served</p>
          {cov.siteCount ? (
            <CoverageBar served={served} total={total} className="mt-1.5" />
          ) : (
            <p className="text-sm text-muted-foreground">No water site</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Main abadi</span>
        <PopulationCell
          k={vKey(v.id)}
          label={`${v.name} main abadi population`}
          {...{ canEdit, step, valueOf, setValue, isDirty }}
        />
      </div>

      {v.settlement_count ? (
        <div className="rounded-lg border bg-muted/20">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
          >
            Settlements ({v.settlement_count})
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {open ? (
            <ul className="divide-y border-t">
              {v.settlements.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cov.settlementCovered(s.name) ? "Served" : "Not served"}
                    </p>
                  </div>
                  <PopulationCell
                    k={sKey(s.id)}
                    label={`${s.name} population`}
                    {...{ canEdit, step, valueOf, setValue, isDirty }}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
