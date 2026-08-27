import { memo } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { SearchableOptionField } from "@/components/common/SearchableOptionField";
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
  /** When false, hide year/month (e.g. Solar analysis — location only). */
  showPeriodFilters?: boolean;
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
      ? `All tehsils (${assignedCount})`
      : "All tehsils";
  }
  return value;
}

function FilterSelect({
  label,
  value,
  disabled,
  placeholder,
  options,
  optionLabel,
  searchable,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder: string;
  options: string[];
  optionLabel?: (value: string) => string;
  searchable?: boolean;
  onChange: (value: string) => void;
}) {
  if (searchable && !disabled && options.length > 12) {
    const allValue = options[0] ?? "All";
    return (
      <SearchableOptionField
        label={label}
        value={value}
        options={options}
        allValue={allValue}
        allLabel={optionLabel ? optionLabel(allValue) : allValue}
        {...(disabled ? { disabled: true } : {})}
        placeholder={placeholder}
        onChange={onChange}
        {...(optionLabel ? { optionLabel } : {})}
      />
    );
  }

  return (
    <Field className="min-w-0 gap-1">
      <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </FieldLabel>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? value)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {optionLabel ? optionLabel(opt) : opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const ExecutiveScopeFiltersCard = memo(function ExecutiveScopeFiltersCard({
  filters,
  activeScopeLabel,
  tehsilOptions,
  villageOptions,
  settlementOptions,
  villageEnabled,
  settlementEnabled,
  showPeriodFilters = true,
  locationMeta,
  locationsLoading,
  onUpdate,
  onApply,
}: ExecutiveScopeFiltersCardProps) {
  const assignedCount = tehsilOptions.filter(
    (t) => t !== ALL_ASSIGNED_TEHSILS,
  ).length;

  return (
    <Card className="gap-0 overflow-visible py-0 shadow-sm ring-border/40">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Filters</p>
          <Badge
            variant="secondary"
            className="max-w-[min(100%,280px)] truncate font-normal"
          >
            <MapPin className="mr-1 size-3 shrink-0" />
            <span className="truncate">{activeScopeLabel}</span>
          </Badge>
        </div>

        <FieldGroup
          className={
            showPeriodFilters
              ? "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
              : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          }
        >
          <FilterSelect
            label="Tehsil"
            value={filters.tehsil}
            placeholder="Tehsil"
            options={tehsilOptions}
            optionLabel={(v) => tehsilLabel(v, assignedCount)}
            onChange={(v) => onUpdate("tehsil", v)}
          />

          <FilterSelect
            label="Village"
            value={filters.village}
            disabled={!villageEnabled}
            placeholder={villageEnabled ? "Village" : "Tehsil first"}
            options={villageEnabled ? villageOptions : [ALL_VILLAGES]}
            searchable
            onChange={(v) => onUpdate("village", v)}
          />

          <FilterSelect
            label="Settlement"
            value={filters.settlement}
            disabled={!settlementEnabled}
            placeholder={
              settlementEnabled ? "Settlement" : "Village first"
            }
            options={
              settlementEnabled ? settlementOptions : [ALL_SETTLEMENTS]
            }
            searchable
            onChange={(v) => onUpdate("settlement", v)}
          />

          {showPeriodFilters ? (
            <>
              <FilterSelect
                label="Year"
                value={filters.year}
                placeholder="Year"
                options={EXECUTIVE_YEARS.map(String)}
                onChange={(v) => onUpdate("year", v)}
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
                    : (EXECUTIVE_MONTHS[Number(v) - 1] ?? v)
                }
                onChange={(v) => onUpdate("month", v)}
              />
            </>
          ) : null}

          <div className="flex items-end">
            <Button type="button" size="sm" className="h-8 w-full" onClick={onApply}>
              Apply
            </Button>
          </div>
        </FieldGroup>

        {!locationsLoading &&
        locationMeta &&
        locationMeta.villageCount === 0 ? (
          <p className="text-xs text-amber-800">No villages in this scope.</p>
        ) : null}
      </CardContent>
    </Card>
  );
});

export default ExecutiveScopeFiltersCard;
