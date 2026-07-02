import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Building,
  CalendarClock,
  ChevronRight,
  Droplets,
  FileCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Sun,
} from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { PageHeader, PageShell, StatCard } from "../../../components/layout";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { tehsilRoutes } from "../../../constants/routes";
import { useAuth } from "../../../contexts/AuthContext";
import { TEHSIL_OPTIONS, LOCATION_DATA } from "../../../utils/locationData";
import { useTehsilProgramSummary } from "../../../hooks";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getPakistanYear } from "../../../utils/pakistanTime";

type Filters = {
  tehsil: string;
  village: string;
  month: string | number;
  year: number;
};

const QUICK_LINKS = [
  {
    label: "Water systems",
    description: "Tube wells",
    icon: Droplets,
    route: tehsilRoutes.waterSystems,
    accent: "text-blue-600 bg-blue-50",
  },
  {
    label: "Submissions",
    description: "Daily logs",
    icon: FileCheck,
    route: tehsilRoutes.waterSubmissions,
    accent: "text-violet-600 bg-violet-50",
  },
  {
    label: "Anomalies",
    description: "Volume flags",
    icon: AlertTriangle,
    route: tehsilRoutes.waterAlerts,
    accent: "text-amber-600 bg-amber-50",
  },
  {
    label: "Certificates",
    description: "Calibration",
    icon: FileText,
    route: tehsilRoutes.calibrationCertificates,
    accent: "text-emerald-600 bg-emerald-50",
  },
  {
    label: "Solar systems",
    description: "PV sites",
    icon: Sun,
    route: tehsilRoutes.solarSites,
    accent: "text-amber-600 bg-amber-50",
  },
  {
    label: "Monthly solar logs",
    description: "Grid import/export",
    icon: CalendarClock,
    route: tehsilRoutes.solarMonthlyLogging,
    accent: "text-orange-600 bg-orange-50",
  },
] as const;

const TehsilManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const scopedTehsils = useMemo((): string[] => {
    const t = (user?.tehsils ?? []).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    return t.length > 0 ? t : [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);

  const currentYear = getPakistanYear();
  const defaultTehsil = useMemo((): string => {
    if (scopedTehsils.length === 1) {
      const only = scopedTehsils[0];
      if (only !== undefined) return only;
    }
    return "All Tehsils";
  }, [scopedTehsils]);

  const [filters, setFilters] = useState<Filters>({
    tehsil: defaultTehsil,
    village: "All Villages",
    month: "",
    year: currentYear,
  });
  const [activeFilters, setActiveFilters] = useState<Filters>({ ...filters });

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      tehsil: defaultTehsil,
      village: "All Villages",
    }));
    setActiveFilters((prev) => ({
      ...prev,
      tehsil: defaultTehsil,
      village: "All Villages",
    }));
  }, [defaultTehsil]);

  const TEHSILS = useMemo(() => {
    if (scopedTehsils.length === 1) return scopedTehsils;
    return ["All Tehsils", ...scopedTehsils];
  }, [scopedTehsils]);

  const [villageOptions, setVillageOptions] = useState<string[]>([
    "All Villages",
  ]);

  const {
    data: summary,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorObject,
    refetch,
  } = useTehsilProgramSummary(activeFilters);

  const MONTHS: Array<{ value: string | number; label: string }> = [
    { value: "", label: "All months" },
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const YEARS = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    const key = filters.tehsil.toUpperCase();
    if (filters.tehsil !== "All Tehsils" && LOCATION_DATA[key]) {
      setVillageOptions(["All Villages", ...LOCATION_DATA[key]]);
    } else {
      setVillageOptions(["All Villages"]);
      setFilters((prev) => ({ ...prev, village: "All Villages" }));
    }
  }, [filters.tehsil]);

  useEffect(() => {
    if (!statsError) return;
    toast.error(
      getApiErrorMessage(
        statsErrorObject,
        "Failed to load dashboard statistics",
      ),
    );
  }, [statsError, statsErrorObject]);

  const handleApplyFilters = () => {
    setActiveFilters({ ...filters });
  };

  const safeSummary = summary ?? {
    ohr_count: 0,
    solar_facilities: 0,
    bulk_meters: 0,
  };

  const meterCoveragePct = useMemo(() => {
    const total = safeSummary.ohr_count;
    if (!total) return null;
    return Math.round((100 * safeSummary.bulk_meters) / total);
  }, [safeSummary.ohr_count, safeSummary.bulk_meters]);

  const tehsilScope =
    scopedTehsils.length === 1
      ? scopedTehsils[0]
      : `${scopedTehsils.length} assigned tehsils`;

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      activeFilters.tehsil === "All Tehsils"
        ? "All tehsils"
        : activeFilters.tehsil;
    const village =
      activeFilters.village === "All Villages"
        ? "all villages"
        : activeFilters.village;
    const month =
      activeFilters.month === ""
        ? "all months"
        : MONTHS.find((m) => m.value === activeFilters.month)?.label ??
          String(activeFilters.month);
    return `${tehsil} · ${village} · ${month} ${activeFilters.year}`;
  }, [activeFilters, MONTHS]);

  return (
    <PageShell>
      <PageHeader
        icon={<LayoutDashboard className="size-[18px]" />}
        title="Dashboard"
        description="At-a-glance view of infrastructure in your tehsil scope."
        badge={
          <Badge
            variant="outline"
            className="text-xs font-medium uppercase tracking-wide"
          >
            {tehsilScope}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void refetch()}
            disabled={statsLoading}
          >
            <Activity className={`size-4 ${statsLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Tube wells"
          value={safeSummary.ohr_count}
          description="Registered in scope"
          icon={<Building className="size-5" />}
          loading={statsLoading}
          accent="blue"
        />
        <StatCard
          label="Solar sites"
          value={safeSummary.solar_facilities}
          description="Registered in scope"
          icon={<Sun className="size-5" />}
          loading={statsLoading}
          accent="amber"
        />
        <StatCard
          label="Bulk meters"
          value={
            meterCoveragePct !== null
              ? `${safeSummary.bulk_meters} (${meterCoveragePct}%)`
              : safeSummary.bulk_meters
          }
          description={
            meterCoveragePct !== null
              ? "Installed · share of tube wells"
              : "Installed in scope"
          }
          icon={<Gauge className="size-5" />}
          loading={statsLoading}
          accent="green"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scope</CardTitle>
          <CardDescription>
            Metrics reflect: <span className="font-medium">{activeScopeLabel}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="Tehsil"
            value={filters.tehsil}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                tehsil: value,
                village: "All Villages",
              }))
            }
            options={TEHSILS}
            disabled={scopedTehsils.length === 1}
          />
          <FilterSelect
            label="Village"
            value={filters.village}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, village: value }))
            }
            options={villageOptions}
          />
          <FilterSelect
            label="Month"
            value={String(filters.month)}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                month: value === "" ? "" : Number(value),
              }))
            }
            options={MONTHS.map((m) => ({
              label: m.label,
              value: String(m.value),
            }))}
          />
          <FilterSelect
            label="Year"
            value={String(filters.year)}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, year: Number(value) }))
            }
            options={YEARS.map((year) => ({
              label: String(year),
              value: String(year),
            }))}
          />
          <div className="flex items-end">
            <Button className="h-10 w-full" onClick={handleApplyFilters}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick access
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.route}
                type="button"
                onClick={() => navigate(link.route)}
                className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${link.accent}`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {link.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
};

type FilterSelectOption = string | { label: string; value: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  disabled?: boolean;
}) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option,
  );
  const EMPTY_VALUE = "__all__";
  const selectValue = value === "" ? EMPTY_VALUE : value;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (nextValue === null) return;
          onChange(nextValue === EMPTY_VALUE ? "" : nextValue);
        }}
      >
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder={`Select ${label}`} />
        </SelectTrigger>
        <SelectContent align="start" className="max-h-72">
          {normalizedOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value === "" ? EMPTY_VALUE : option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default TehsilManagerDashboard;
