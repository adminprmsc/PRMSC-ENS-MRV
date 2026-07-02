import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  PageShell,
  StatCard,
} from "../../../components/layout";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import { useAuth } from "../../../contexts/AuthContext";
import { TEHSIL_OPTIONS, LOCATION_DATA } from "../../../utils/locationData";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getWaterAnomalies } from "../../../services/tehsilManagerOperatorService";

function formatTooltipNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function formatKpiValue(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

type AnomalyItem = {
  water_system: {
    id: string;
    unique_identifier?: string;
    tehsil: string;
    village: string;
    settlement?: string | null;
    bulk_meter_installed: boolean;
  };
  anomalies: Array<{ date: string; code: string; severity: string; message: string }>;
  series: Array<{
    date: string;
    total_water_pumped?: number | null;
    status?: string | null;
    operator?: { id: string; name: string; email: string; phone?: string | null } | null;
  }>;
};

export default function WaterAlertsPage() {
  const { user } = useAuth();

  const scopedTehsils = useMemo((): string[] => {
    const t = (user?.tehsils ?? []).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    return t.length > 0 ? t : [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);

  const restrictTehsils = scopedTehsils.length > 0 && !(scopedTehsils.length > 1 && scopedTehsils.includes("All Tehsils"));

  const [filters, setFilters] = useState({
    tehsil: scopedTehsils.length === 1 ? (scopedTehsils[0] ?? "All Tehsils") : "All Tehsils",
    village: "All Villages",
    end_date: "",
  });

  const villageOptions = useMemo(() => {
    if (filters.tehsil === "All Tehsils") return ["All Villages"];
    return [
      "All Villages",
      ...((LOCATION_DATA[String(filters.tehsil).toUpperCase()] || []) as string[]),
    ];
  }, [filters.tehsil]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnomalyItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = (await getWaterAnomalies({
        tehsil: filters.tehsil,
        village: filters.village,
        ...(filters.end_date ? { end_date: filters.end_date } : {}),
        days: 4,
      })) as { items?: AnomalyItem[] };
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load anomalies"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flagged = useMemo(
    () => items.filter((x) => (x.anomalies?.length ?? 0) > 0),
    [items],
  );

  return (
    <PageShell>
      <PageHeader
        icon={<AlertTriangle />}
        title="Water anomalies"
        description="4-day scan · ±10% high or ±50% low vs 3-day average"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Flagged systems"
          value={flagged.length}
          accent={flagged.length ? "amber" : "green"}
        />
        <StatCard label="Scanned" value={items.length} accent="slate" />
      </div>

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tehsil</Label>
            <Select
              value={filters.tehsil}
              onValueChange={(v) =>
                setFilters((p) => ({
                  ...p,
                  tehsil: v ?? "All Tehsils",
                  village: "All Villages",
                }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(scopedTehsils.length === 1 || restrictTehsils
                  ? scopedTehsils
                  : ["All Tehsils", ...scopedTehsils]
                ).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Village</Label>
            <Select
              value={filters.village}
              onValueChange={(v) =>
                setFilters((p) => ({ ...p, village: v ?? "All Villages" }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {villageOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">End date</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.end_date}
              onChange={(e) =>
                setFilters((p) => ({ ...p, end_date: e.target.value }))
              }
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => void load()}
              disabled={loading}
              className="w-full"
              size="sm"
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Flagged systems</CardTitle>
            <Badge variant={flagged.length ? "destructive" : "outline"}>
              {flagged.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : flagged.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No anomalies detected.
              </p>
            ) : (
              <div className="max-h-[560px] overflow-y-auto">
                <Accordion className="w-full space-y-2">
                    {flagged.slice(0, 50).map((it) => {
                      const title = [
                        it.water_system.unique_identifier || it.water_system.id,
                        it.water_system.village,
                        it.water_system.tehsil,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const lastOp =
                        [...(it.series ?? [])]
                          .reverse()
                          .find((p) => p.operator)?.operator ?? null;
                      const series = Array.isArray(it.series) ? it.series : [];
                      const anomalyDates = new Set(
                        (it.anomalies ?? []).map((a) => String(a.date)),
                      );
                      const avg3ByDate = new Map<string, number>();
                      for (let i = 3; i < series.length; i += 1) {
                        const cur = series[i];
                        const p1 = series[i - 1];
                        const p2 = series[i - 2];
                        const p3 = series[i - 3];
                        const v1 = Number(p1?.total_water_pumped ?? NaN);
                        const v2 = Number(p2?.total_water_pumped ?? NaN);
                        const v3 = Number(p3?.total_water_pumped ?? NaN);
                        if (
                          cur?.date &&
                          Number.isFinite(v1) &&
                          Number.isFinite(v2) &&
                          Number.isFinite(v3)
                        ) {
                          avg3ByDate.set(String(cur.date), (v1 + v2 + v3) / 3);
                        }
                      }
                      const chartData = series.map((p) => ({
                        date: p.date,
                        waterM3: Number(p.total_water_pumped ?? 0),
                        avg3: avg3ByDate.get(String(p.date)) ?? null,
                        anomaly: anomalyDates.has(String(p.date)),
                      }));

                      return (
                        <AccordionItem
                          key={it.water_system.id}
                          value={it.water_system.id}
                          className="rounded-lg border border-border/70 bg-card px-3"
                        >
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex w-full items-start justify-between gap-3 pr-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{title}</p>
                                {lastOp ? (
                                  <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {lastOp.name} · {lastOp.email}
                                  </p>
                                ) : null}
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {it.anomalies?.length ?? 0}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            <div className="grid gap-3 md:grid-cols-[1fr_380px] md:items-start">
                              <div>
                                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                                  {(it.anomalies ?? []).slice(0, 6).map((a, idx) => (
                                    <li key={`${a.code}-${a.date}-${idx}`}>
                                      <span className="font-medium text-foreground">
                                        {a.date}
                                      </span>
                                      : {a.message}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="w-full">
                                <div className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
                                  <AlertTriangle className="size-3.5 text-destructive" />
                                  Pumped vs 3-day avg
                                </div>
                                <div className="h-[180px] w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart
                                      data={chartData}
                                      margin={{ top: 10, right: 12, bottom: 6, left: 0 }}
                                    >
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(d) => String(d).slice(5)}
                                        interval={0}
                                      />
                                      <YAxis
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => formatKpiValue(Number(v))}
                                        width={34}
                                      />
                                      <Tooltip
                                        labelFormatter={(label) => `Date: ${String(label)}`}
                                        formatter={(value, name) => {
                                          const n = Number(value ?? 0);
                                          if (name === "Water pumped") {
                                            return [`${formatTooltipNumber(n)} m³`, name];
                                          }
                                          if (name === "3‑day avg") {
                                            if (!Number.isFinite(n)) return ["—", name];
                                            return [`${formatTooltipNumber(n)} m³`, name];
                                          }
                                          return [formatTooltipNumber(n), String(name)];
                                        }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="waterM3"
                                        name="Water pumped"
                                        stroke="#2563eb"
                                        strokeWidth={2.25}
                                        dot={({ cx, cy, payload }) => {
                                          if (cx == null || cy == null) return null;
                                          const isAnom = Boolean((payload as any)?.anomaly);
                                          return (
                                            <circle
                                              cx={cx}
                                              cy={cy}
                                              r={4}
                                              fill={isAnom ? "#ef4444" : "#2563eb"}
                                              stroke="#ffffff"
                                              strokeWidth={1.5}
                                            />
                                          );
                                        }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="avg3"
                                        name="3‑day avg"
                                        stroke="#64748b"
                                        strokeWidth={2}
                                        strokeDasharray="5 4"
                                        dot={false}
                                        connectNulls={false}
                                      />
                                    </ComposedChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
              </div>
            )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

