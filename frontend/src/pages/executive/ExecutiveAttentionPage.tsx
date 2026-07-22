import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout";
import { LivePulseBadge } from "@/components/LivePulseBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useProgramDashboardApi } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import { LOCATION_DATA, TEHSIL_OPTIONS } from "@/utils/locationData";
import {
  AdminIssuesPanel,
  buildAdminIssues,
} from "./AdminDashboardBlocks";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import {
  fetchScopedProgramDashboard,
  type ProgramSummary,
} from "./fetchScopedProgramDashboard";

const YEARS = [2025, 2026, 2027, 2028, 2029];
const MONTHS = [
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

type ScopeFilters = {
  tehsil: string;
  village: string;
  month: string;
  year: string;
};

const ExecutiveAttentionPage = () => {
  const { user } = useAuth();
  const { getDashboardProgramSummary } = useProgramDashboardApi();

  const allowedTehsils = useMemo(() => {
    const t = (user?.tehsils ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    return t.length ? t : [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);
  const restrictTehsils = (user?.tehsils ?? []).length > 0;
  const initialTehsil =
    restrictTehsils && allowedTehsils.length > 1
      ? ALL_ASSIGNED_TEHSILS
      : restrictTehsils
        ? String(allowedTehsils[0] ?? "").trim() || ALL_ASSIGNED_TEHSILS
        : ALL_ASSIGNED_TEHSILS;

  const [searchParams] = useSearchParams();
  const urlTehsil = searchParams.get("tehsil")?.trim() || "";
  const resolvedTehsil =
    urlTehsil &&
    (urlTehsil === ALL_ASSIGNED_TEHSILS ||
      allowedTehsils.includes(urlTehsil) ||
      !restrictTehsils)
      ? urlTehsil
      : initialTehsil;

  const [filters, setFilters] = useState<ScopeFilters>(() => ({
    tehsil: resolvedTehsil,
    village: searchParams.get("village")?.trim() || "All Villages",
    month: searchParams.get("month")?.trim() || "All Months",
    year: searchParams.get("year")?.trim() || "2026",
  }));
  const [summary, setSummary] = useState<ProgramSummary>({
    ohr_count: 0,
    solar_facilities: 0,
    bulk_meters: 0,
    water_systems: [],
    solar_systems: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const villageOptions = useMemo(() => {
    if (filters.tehsil === ALL_ASSIGNED_TEHSILS) {
      if (restrictTehsils && allowedTehsils.length) {
        const villages = new Set<string>();
        for (const tehsil of allowedTehsils) {
          for (const village of (LOCATION_DATA[tehsil.toUpperCase()] ||
            []) as string[]) {
            villages.add(village);
          }
        }
        return ["All Villages", ...[...villages].sort()];
      }
      return ["All Villages"];
    }
    return [
      "All Villages",
      ...((LOCATION_DATA[filters.tehsil.toUpperCase()] || []) as string[]),
    ];
  }, [filters.tehsil, restrictTehsils, allowedTehsils]);

  const updateScope = useCallback((patch: Partial<ScopeFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.tehsil !== undefined) next.village = "All Villages";
      return next;
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const apiFilters = {
          tehsil: filters.tehsil,
          village: filters.village,
          year: Number(filters.year),
          ...(filters.month !== "All Months"
            ? { month: Number(filters.month) }
            : {}),
        };
        const { summary: sum } = await fetchScopedProgramDashboard(
          apiFilters,
          allowedTehsils,
          {
            summary: (f) =>
              getDashboardProgramSummary(f) as Promise<
                ProgramSummary | undefined
              >,
            water: async () => [],
            pump: async () => [],
            solar: async () => [],
            grid: async () => [],
          },
        );
        setSummary(sum);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load attention queue"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filters, allowedTehsils, getDashboardProgramSummary]);

  const periodHint = useMemo(() => {
    if (filters.month !== "All Months") {
      return `${MONTHS[Number(filters.month) - 1] ?? "Month"} ${filters.year}`;
    }
    return filters.year;
  }, [filters.month, filters.year]);

  const issues = useMemo(
    () =>
      buildAdminIssues(
        summary.water_systems ?? [],
        summary.solar_systems ?? [],
        periodHint,
      ),
    [summary.water_systems, summary.solar_systems, periodHint],
  );

  const tehsilOptions = useMemo(() => {
    if (restrictTehsils && allowedTehsils.length > 1) {
      return [ALL_ASSIGNED_TEHSILS, ...allowedTehsils];
    }
    if (restrictTehsils) return allowedTehsils;
    return [ALL_ASSIGNED_TEHSILS, ...TEHSIL_OPTIONS];
  }, [restrictTehsils, allowedTehsils]);

  return (
    <PageShell className="animate-fade-in-up">
      <PageHeader
        title="Attention needed"
        description={`${periodHint} · sites missing logs`}
        icon={<ShieldAlert className="size-5" />}
        badge={<LivePulseBadge syncing={loading} />}
      />

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base font-semibold tracking-tight">
            Scope
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field>
              <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tehsil
              </FieldLabel>
              <Select
                value={filters.tehsil}
                onValueChange={(v) =>
                  updateScope({ tehsil: v ?? filters.tehsil })
                }
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Tehsil" />
                </SelectTrigger>
                <SelectContent>
                  {tehsilOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === ALL_ASSIGNED_TEHSILS
                        ? `All assigned (${allowedTehsils.length})`
                        : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Village
              </FieldLabel>
              <Select
                value={filters.village}
                onValueChange={(v) =>
                  updateScope({ village: v ?? filters.village })
                }
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Village" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {villageOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Year
              </FieldLabel>
              <Select
                value={filters.year}
                onValueChange={(v) => updateScope({ year: v ?? filters.year })}
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Month
              </FieldLabel>
              <Select
                value={filters.month}
                onValueChange={(v) =>
                  updateScope({ month: v ?? filters.month })
                }
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm shadow-none">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Months">All months</SelectItem>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <AdminIssuesPanel
        issues={issues}
        loading={loading}
        periodHint={periodHint}
      />
    </PageShell>
  );
};

export default ExecutiveAttentionPage;
