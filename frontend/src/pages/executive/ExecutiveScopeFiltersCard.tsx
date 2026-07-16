import { memo, useMemo, useState } from "react";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXECUTIVE_MONTHS,
  EXECUTIVE_YEARS,
  type ExecutiveScopeFilters,
} from "./executiveAnalysisTypes";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import { ALL_SETTLEMENTS, ALL_VILLAGES } from "./registeredLocationOptions";

type ExecutiveScopeFiltersCardProps = {
  filters: ExecutiveScopeFilters;
  activeScopeLabel: string;
  tehsilOptions: string[];
  villageOptions: string[];
  settlementOptions: string[];
  villageEnabled: boolean;
  settlementEnabled: boolean;
  locationMeta?: {
    siteCount: number;
    villageCount: number;
    settlementCount: number;
  };
  locationsLoading?: boolean;
  onUpdate: <K extends keyof ExecutiveScopeFilters>(
    key: K,
    value: ExecutiveScopeFilters[K],
  ) => void;
  onApply: () => void;
};

function tehsilLabel(value: string, assignedCount?: number) {
  if (value === ALL_ASSIGNED_TEHSILS) {
    return assignedCount && assignedCount > 0
      ? `All assigned tehsils (${assignedCount})`
      : "All assigned tehsils";
  }
  return value;
}

function FilterSelect({
  label,
  hint,
  value,
  disabled,
  placeholder,
  options,
  optionLabel,
  searchable,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  placeholder: string;
  options: string[];
  optionLabel?: (value: string) => string;
  searchable?: boolean;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const [first, ...rest] = options;
    const matched = rest.filter((o) => o.toLowerCase().includes(q));
    return first ? [first, ...matched] : matched;
  }, [options, query, searchable]);

  return (
    <Field className="min-w-0">
      <FieldLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
        {hint ? (
          <span className="ml-1 font-normal normal-case tracking-normal">
            {hint}
          </span>
        ) : null}
      </FieldLabel>
      <div className="space-y-1.5">
        {searchable && !disabled && options.length > 12 ? (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-8 bg-background text-xs"
            disabled={disabled}
          />
        ) : null}
        <Select
          value={value}
          onValueChange={(v) => onChange(v ?? value)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 w-full bg-background text-sm">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {filtered.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {optionLabel ? optionLabel(opt) : opt}
              </SelectItem>
            ))}
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                No matches
              </div>
            ) : null}
          </SelectContent>
        </Select>
      </div>
    </Field>
  );
}

function ExecutiveScopeFiltersCard({
  filters,
  activeScopeLabel,
  tehsilOptions,
  villageOptions,
  settlementOptions,
  villageEnabled,
  settlementEnabled,
  locationMeta,
  locationsLoading,
  onUpdate,
  onApply,
}: ExecutiveScopeFiltersCardProps) {
  const assignedCount = Math.max(0, tehsilOptions.length - (tehsilOptions.includes(ALL_ASSIGNED_TEHSILS) ? 1 : 0));

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Scope filters</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Choose tehsil first, then village and settlement. Only places with
              registered sites appear in the lists.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locationsLoading ? (
            <Badge variant="outline" className="font-normal">
              Loading places…
            </Badge>
          ) : locationMeta ? (
            <Badge variant="outline" className="font-normal">
              {locationMeta.siteCount} registered sites
            </Badge>
          ) : null}
          <Badge
            variant="secondary"
            className="max-w-[min(100%,320px)] font-normal"
          >
            <MapPin className="mr-1 size-3 shrink-0" />
            <span className="truncate">{activeScopeLabel}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FilterSelect
            label="Tehsil"
            value={filters.tehsil}
            placeholder="Select tehsil"
            options={tehsilOptions}
            optionLabel={(v) => tehsilLabel(v, assignedCount)}
            onChange={(v) => onUpdate("tehsil", v)}
          />

          <FilterSelect
            label="Village"
            {...(villageEnabled
              ? locationMeta && locationMeta.villageCount > 0
                ? { hint: `(${locationMeta.villageCount})` }
                : {}
              : { hint: "(select a tehsil)" })}
            value={filters.village}
            disabled={!villageEnabled}
            placeholder={
              villageEnabled ? "Select village" : "Select a tehsil first"
            }
            options={
              villageEnabled ? villageOptions : [ALL_VILLAGES]
            }
            searchable
            onChange={(v) => onUpdate("village", v)}
          />

          <FilterSelect
            label="Settlement"
            {...(settlementEnabled
              ? locationMeta && locationMeta.settlementCount > 0
                ? { hint: `(${locationMeta.settlementCount})` }
                : {}
              : { hint: "(select a village)" })}
            value={filters.settlement}
            disabled={!settlementEnabled}
            placeholder={
              settlementEnabled
                ? "Select settlement"
                : "Select a village first"
            }
            options={
              settlementEnabled ? settlementOptions : [ALL_SETTLEMENTS]
            }
            searchable
            onChange={(v) => onUpdate("settlement", v)}
          />

          <FilterSelect
            label="Month"
            value={filters.month}
            placeholder="Month"
            options={[
              "All Months",
              ...EXECUTIVE_MONTHS.map((_, i) => String(i + 1)),
            ]}
            optionLabel={(v) =>
              v === "All Months"
                ? "All months"
                : EXECUTIVE_MONTHS[Number(v) - 1] ?? v
            }
            onChange={(v) => onUpdate("month", v)}
          />

          <FilterSelect
            label="Year"
            value={filters.year}
            placeholder="Year"
            options={EXECUTIVE_YEARS.map(String)}
            onChange={(v) => onUpdate("year", v)}
          />

          <Field className="flex min-w-0 flex-col justify-end">
            <Button onClick={onApply} className="h-9 w-full">
              Apply filters
            </Button>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Results update after Apply
            </p>
          </Field>
        </FieldGroup>

        {!villageEnabled ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Pick a specific tehsil to unlock village and settlement filters for
            registered sites in that area.
          </p>
        ) : villageEnabled &&
          !locationsLoading &&
          locationMeta &&
          locationMeta.villageCount === 0 ? (
          <p className="mt-3 text-xs text-amber-800">
            No registered sites found in this tehsil for this programme view.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default memo(ExecutiveScopeFiltersCard);
