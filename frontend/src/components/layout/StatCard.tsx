import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatAccent = "blue" | "green" | "amber" | "slate" | "violet";

const accentStyles: Record<
  StatAccent,
  { border: string; iconBg: string; iconText: string }
> = {
  blue: {
    border: "border-l-blue-500",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
  },
  green: {
    border: "border-l-emerald-500",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
  },
  amber: {
    border: "border-l-amber-500",
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
  },
  slate: {
    border: "border-l-slate-400",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
  },
  violet: {
    border: "border-l-violet-500",
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
  },
};

type StatCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  loading?: boolean;
  valueClassName?: string;
  className?: string;
  accent?: StatAccent;
};

export function StatCard({
  label,
  value,
  description,
  icon,
  loading,
  valueClassName,
  className,
  accent = "slate",
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <Card
      className={cn(
        "enterprise-card-shadow border-l-4",
        styles.border,
        className,
      )}
    >
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <div
              className={cn(
                "text-3xl font-semibold tabular-nums tracking-tight text-foreground",
                valueClassName,
              )}
            >
              {value}
            </div>
          )}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              styles.iconBg,
              styles.iconText,
            )}
          >
            {icon}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
