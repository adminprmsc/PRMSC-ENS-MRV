import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPakistanIsoDateString } from "@/utils/pakistanTime";
import { EXECUTIVE_MONTHS, EXECUTIVE_YEARS } from "./executiveAnalysisTypes";
import {
  ALL_MONTHS,
  EXECUTIVE_YEAR_SELECT_OPTIONS,
  executiveYearLabel,
  formatDateRangeLabel,
  hasDateRange,
  isoParts,
  isoToLocalDate,
  localDateToIso,
  type ExecutivePeriod,
} from "./executivePeriodFilters";

type PeriodMode = "calendar" | "range";

type Preset = { label: string; range: () => [string, string] };

function shiftMonths(iso: string, delta: number): [number, number] {
  const [y, m] = isoParts(iso);
  const idx = y * 12 + (m - 1) + delta;
  return [Math.floor(idx / 12), (idx % 12) + 1];
}

function monthStart(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function monthEnd(y: number, m: number): string {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function daysAgo(iso: string, days: number): string {
  const d = isoToLocalDate(iso);
  d.setDate(d.getDate() - days);
  return localDateToIso(d);
}

/** Bank-style quick ranges, anchored on today in Pakistan time. */
function buildPresets(): Preset[] {
  const today = () => getPakistanIsoDateString();
  return [
    {
      label: "This month",
      range: () => {
        const t = today();
        const [y, m] = shiftMonths(t, 0);
        return [monthStart(y, m), t];
      },
    },
    {
      label: "Last month",
      range: () => {
        const [y, m] = shiftMonths(today(), -1);
        return [monthStart(y, m), monthEnd(y, m)];
      },
    },
    {
      label: "Last 30 days",
      range: () => {
        const t = today();
        return [daysAgo(t, 29), t];
      },
    },
    {
      label: "Last 3 months",
      range: () => {
        const t = today();
        const [y, m] = shiftMonths(t, -2);
        return [monthStart(y, m), t];
      },
    },
    {
      label: "Last 6 months",
      range: () => {
        const t = today();
        const [y, m] = shiftMonths(t, -5);
        return [monthStart(y, m), t];
      },
    },
    {
      label: "Year to date",
      range: () => {
        const t = today();
        return [`${t.slice(0, 4)}-01-01`, t];
      },
    },
    {
      label: "Last year",
      range: () => {
        const y = Number(today().slice(0, 4)) - 1;
        return [`${y}-01-01`, `${y}-12-31`];
      },
    },
  ];
}

type DateRangePickerProps = {
  dateFrom: string;
  dateTo: string;
  onApply: (range: { dateFrom: string; dateTo: string }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
};

/** Popover range calendar with presets; commits only on Apply. */
export function DateRangePicker({
  dateFrom,
  dateTo,
  onApply,
  open,
  onOpenChange,
  triggerClassName,
}: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const presets = useMemo(buildPresets, []);
  const hasRange = hasDateRange({ dateFrom, dateTo });
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setDraft(
      hasRange
        ? { from: isoToLocalDate(dateFrom), to: isoToLocalDate(dateTo) }
        : undefined,
    );
  }, [open, hasRange, dateFrom, dateTo]);

  const today = isoToLocalDate(getPakistanIsoDateString());
  const firstYear = Math.min(...EXECUTIVE_YEARS);
  const lastYear = Math.max(...EXECUTIVE_YEARS);

  const draftFrom = draft?.from ? localDateToIso(draft.from) : "";
  const draftTo = draft?.to ? localDateToIso(draft.to) : draftFrom;
  const canApply = Boolean(draftFrom);

  const commit = () => {
    if (!draftFrom) return;
    onApply({ dateFrom: draftFrom, dateTo: draftTo || draftFrom });
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start gap-2 bg-background font-normal shadow-none",
          !hasRange && "text-muted-foreground",
          triggerClassName,
        )}
      >
        <CalendarRange className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">
          {hasRange ? formatDateRangeLabel(dateFrom, dateTo) : "Select dates"}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="flex gap-1 overflow-x-auto border-b border-border/60 p-2 sm:w-36 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
            {presets.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 justify-start px-2 text-xs"
                onClick={() => {
                  const [from, to] = p.range();
                  setDraft({
                    from: isoToLocalDate(from),
                    to: isoToLocalDate(to),
                  });
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={isMobile ? 1 : 2}
            captionLayout="dropdown"
            startMonth={new Date(firstYear, 0)}
            endMonth={new Date(lastYear, 11)}
            defaultMonth={
              draft?.from ??
              new Date(today.getFullYear(), today.getMonth() - (isMobile ? 0 : 1))
            }
            selected={draft}
            onSelect={setDraft}
            disabled={{ after: today }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 p-2">
          <p className="text-xs text-muted-foreground">
            {draftFrom
              ? formatDateRangeLabel(draftFrom, draftTo || draftFrom)
              : "Pick a start and end date"}
          </p>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={!canApply}
              onClick={commit}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ExecutivePeriodFieldsProps = {
  value: ExecutivePeriod;
  onChange: (patch: Partial<ExecutivePeriod>) => void;
  /** Show the month select in year/month mode (false for year-only screens). */
  showMonth?: boolean;
  /** Include "All years" in the year select. */
  allowAllYears?: boolean;
  size?: "sm" | "md";
  /** Grid span for the date range field so it lines up with year + month. */
  rangeClassName?: string;
};

/**
 * Period controls for HQ filters: a mode switch between calendar year/month
 * and a custom date range (rendered as sibling grid cells).
 */
export function ExecutivePeriodFields({
  value,
  onChange,
  showMonth = true,
  allowAllYears = true,
  size = "sm",
  rangeClassName = "col-span-2",
}: ExecutivePeriodFieldsProps) {
  const rangeActive = hasDateRange(value);
  const [mode, setMode] = useState<PeriodMode>(
    rangeActive ? "range" : "calendar",
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (rangeActive) setMode("range");
  }, [rangeActive]);

  const trigger = size === "sm" ? "h-8 text-xs" : "h-9 text-sm";
  const labelClass =
    "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  const fieldClass = size === "sm" ? "min-w-0 gap-1" : "min-w-0";

  const yearOptions = allowAllYears
    ? [...EXECUTIVE_YEAR_SELECT_OPTIONS]
    : EXECUTIVE_YEARS.map(String);

  return (
    <>
      <Field className={fieldClass}>
        <FieldLabel className={labelClass}>Period</FieldLabel>
        <Select
          value={mode}
          onValueChange={(v) => {
            const next = (v ?? mode) as PeriodMode;
            setMode(next);
            if (next === "calendar") {
              setPickerOpen(false);
              if (rangeActive) onChange({ dateFrom: "", dateTo: "" });
            } else if (!rangeActive) {
              // Defer so the select's closing click doesn't dismiss the popover.
              window.setTimeout(() => setPickerOpen(true), 0);
            }
          }}
        >
          <SelectTrigger
            className={cn("w-full bg-background shadow-none", trigger)}
          >
            <SelectValue>
              {(v: string) => (v === "range" ? "Custom range" : "Year / month")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="calendar">Year / month</SelectItem>
            <SelectItem value="range">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {mode === "range" ? (
        <Field className={cn(fieldClass, rangeClassName)}>
          <FieldLabel className={labelClass}>Date range</FieldLabel>
          <DateRangePicker
            dateFrom={value.dateFrom}
            dateTo={value.dateTo}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onApply={(r) => onChange(r)}
            triggerClassName={trigger}
          />
        </Field>
      ) : (
        <>
          <Field className={fieldClass}>
            <FieldLabel className={labelClass}>Year</FieldLabel>
            <Select
              value={value.year}
              onValueChange={(v) => onChange({ year: v ?? value.year })}
            >
              <SelectTrigger
                className={cn("w-full bg-background shadow-none", trigger)}
              >
                <SelectValue placeholder="Year">
                  {(v: string) => executiveYearLabel(v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {executiveYearLabel(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {showMonth ? (
            <Field className={fieldClass}>
              <FieldLabel className={labelClass}>Month</FieldLabel>
              <Select
                value={value.month}
                onValueChange={(v) => onChange({ month: v ?? value.month })}
              >
                <SelectTrigger
                  className={cn("w-full bg-background shadow-none", trigger)}
                >
                  <SelectValue placeholder="Month">
                    {(v: string) =>
                      v === ALL_MONTHS
                        ? "All months"
                        : (EXECUTIVE_MONTHS[Number(v) - 1] ?? v)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL_MONTHS}>All months</SelectItem>
                  {EXECUTIVE_MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </>
      )}
    </>
  );
}
