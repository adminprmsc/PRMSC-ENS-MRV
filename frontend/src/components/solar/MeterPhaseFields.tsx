import { Gauge, History, Info, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  METER_PHASE_LABEL,
  phaseWindowHint,
  type MeterPhase,
  type PhaseWindow,
} from "@/lib/solarMeterPhase";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const num = (s: string) => {
  const n = Number(s.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Which bill this monthly log comes from — green meter or before it. */
export function MeterPhaseSelector({
  value,
  onChange,
  window,
  disabled,
}: {
  value: MeterPhase;
  onChange: (p: MeterPhase) => void;
  window: PhaseWindow;
  disabled?: boolean;
}) {
  const options: Array<{ phase: MeterPhase; icon: React.ReactNode; sub: string }> = [
    {
      phase: "green",
      icon: <Gauge className="size-4" />,
      sub: "Import · export · net",
    },
    {
      phase: "pre_green",
      icon: <History className="size-4" />,
      sub: "Units consumed only",
    },
  ];
  const locked = window.allowed.length === 1;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            Log type
            {locked ? (
              <Lock className="size-3.5 text-muted-foreground" aria-label="Set by green meter date" />
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {phaseWindowHint(window)}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Log type"
          className="grid w-full shrink-0 grid-cols-2 overflow-hidden rounded-lg border md:w-auto"
        >
          {options.map((o) => {
            const allowed = window.allowed.includes(o.phase);
            const active = value === o.phase;
            return (
              <button
                key={o.phase}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled || !allowed}
                onClick={() => onChange(o.phase)}
                title={
                  allowed
                    ? undefined
                    : o.phase === "pre_green"
                      ? "Not available — this month is after the green meter was connected"
                      : "Not available — this month is before the green meter was connected"
                }
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-left transition-colors first:border-r disabled:cursor-not-allowed disabled:opacity-40",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {o.icon}
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">
                    {METER_PHASE_LABEL[o.phase]}
                  </span>
                  <span
                    className={cn(
                      "block text-[11px] leading-tight",
                      active ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {o.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Units consumed peak + off-peak for a month before the green meter. */
export function PreGreenConsumptionFields({
  peak,
  offPeak,
  onPeak,
  onOffPeak,
  inputClassName,
  disabled,
}: {
  peak: string;
  offPeak: string;
  onPeak: (v: string) => void;
  onOffPeak: (v: string) => void;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const total = num(peak) + num(offPeak);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          No green meter was installed this month, so nothing was exported.
          Enter only the units consumed from the electricity bill.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Units consumed — peak (kWh)</span>
          <Input
            id="units-consumed-peak"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={inputClassName}
            value={peak}
            onChange={(e) => onPeak(e.target.value)}
            placeholder="0"
            disabled={disabled}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Units consumed — off-peak (kWh)</span>
          <Input
            id="units-consumed-off-peak"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={inputClassName}
            value={offPeak}
            onChange={(e) => onOffPeak(e.target.value)}
            placeholder="0"
            disabled={disabled}
          />
        </label>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-muted-foreground">Total consumed</span>
          <p className="flex h-10 items-center rounded-md border border-dashed bg-muted/40 px-3 text-sm font-semibold tabular-nums">
            {fmt(total)} kWh
          </p>
        </div>
      </div>
    </div>
  );
}

/** Small label for list rows. Green logs render nothing unless `showGreen`. */
export function MeterPhaseBadge({
  phase,
  showGreen = false,
  className,
}: {
  phase: MeterPhase | null | undefined;
  showGreen?: boolean;
  className?: string;
}) {
  if (phase !== "pre_green" && !showGreen) return null;
  const pre = phase === "pre_green";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        pre
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        className,
      )}
    >
      {pre ? <History className="size-3" /> : <Gauge className="size-3" />}
      {METER_PHASE_LABEL[pre ? "pre_green" : "green"]}
    </span>
  );
}
