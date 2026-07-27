import { Badge } from "@/components/ui/badge";
import {
  normalizeSolarSiteType,
  type SolarSiteType,
} from "@/constants/solarSiteTypes";
import { cn } from "@/lib/utils";

const SITE_TYPE_STYLES: Record<SolarSiteType, string> = {
  ABR: "border-sky-400 bg-sky-100 text-sky-950 ring-1 ring-sky-300/60",
  Tubewell:
    "border-emerald-400 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300/60",
  "RO Plant":
    "border-violet-400 bg-violet-100 text-violet-950 ring-1 ring-violet-300/60",
};

type SolarSiteTypeBadgeProps = {
  value?: string | null | undefined;
  className?: string;
  /** Show a muted "Not set" chip when empty (useful in grids). */
  showEmpty?: boolean;
  size?: "sm" | "md";
};

export function SolarSiteTypeBadge({
  value,
  className,
  showEmpty = true,
  size = "md",
}: SolarSiteTypeBadgeProps) {
  const normalized = normalizeSolarSiteType(value ?? null);
  if (!normalized) {
    if (!showEmpty) return null;
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-semibold tracking-wide text-muted-foreground",
          size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
          className,
        )}
      >
        Site type unset
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-bold tracking-wide uppercase",
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-1 text-xs",
        SITE_TYPE_STYLES[normalized],
        className,
      )}
    >
      {normalized}
    </Badge>
  );
}
