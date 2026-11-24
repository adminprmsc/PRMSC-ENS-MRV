import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export const MAX_POPULATION = 10_000_000;

const clamp = (n: number) =>
  Math.min(MAX_POPULATION, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

type PopulationCounterProps = {
  value: number;
  onChange: (next: number) => void;
  /** Amount added / removed per +/- click. */
  step?: number;
  disabled?: boolean;
  /** Highlights the control when the value differs from what is saved. */
  dirty?: boolean;
  label: string;
  size?: "sm" | "md";
};

/** − [ value ] + stepper. Typing is allowed; the value is clamped to 0…10M. */
export function PopulationCounter({
  value,
  onChange,
  step = 1,
  disabled,
  dirty,
  label,
  size = "md",
}: PopulationCounterProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (raw: string) => {
    const n = clamp(Number(raw.replace(/[,\s]/g, "")));
    setDraft(String(n));
    if (n !== value) onChange(n);
  };

  const btn =
    "flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
  const h = size === "sm" ? "h-8" : "h-9";

  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border bg-background",
        h,
        dirty
          ? "border-amber-400 ring-2 ring-amber-400/25"
          : "border-input",
      )}
    >
      <button
        type="button"
        className={cn(btn, "w-8 border-r border-input")}
        disabled={disabled || value <= 0}
        onClick={() => onChange(clamp(value - step))}
        aria-label={`Decrease ${label} by ${step}`}
      >
        <Minus className="size-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="w-24 bg-transparent px-2 text-center text-sm font-medium tabular-nums outline-none disabled:opacity-60"
        value={draft}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d,]/g, ""))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(value + step));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(value - step));
          }
        }}
      />
      <button
        type="button"
        className={cn(btn, "w-8 border-l border-input")}
        disabled={disabled || value >= MAX_POPULATION}
        onClick={() => onChange(clamp(value + step))}
        aria-label={`Increase ${label} by ${step}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
