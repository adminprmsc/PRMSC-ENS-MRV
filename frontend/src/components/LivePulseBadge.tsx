import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type LivePulseBadgeProps = {
  syncing?: boolean;
  label?: string;
  className?: string;
};

/** Emerald live indicator used across HQ surfaces. */
export function LivePulseBadge({
  syncing = false,
  label,
  className,
}: LivePulseBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border-emerald-200/80 bg-emerald-50 px-2 py-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-800",
        syncing && "opacity-70",
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full bg-emerald-400 opacity-60",
            !syncing && "animate-live-ping",
          )}
        />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      {label ?? (syncing ? "Syncing" : "Live")}
    </Badge>
  );
}
