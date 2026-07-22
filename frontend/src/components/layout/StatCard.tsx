import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatAccent = "blue" | "green" | "amber" | "slate" | "violet";

const accentStyles: Record<StatAccent, string> = {
  blue: "bg-blue-500/10 text-blue-700",
  green: "bg-emerald-500/10 text-emerald-700",
  amber: "bg-amber-500/10 text-amber-700",
  slate: "bg-primary/10 text-primary",
  violet: "bg-violet-500/10 text-violet-700",
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

/** WFM-style KPI tile: left primary rail, uppercase label, compact icon chip. */
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
  return (
    <Card
      className={cn(
        "relative overflow-hidden shadow-sm ring-1 ring-border/80",
        className,
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2 pl-5">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {icon ? (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              accentStyles[accent],
            )}
          >
            {icon}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pl-5 pt-0">
        {loading ? (
          <Skeleton className="mt-1 h-8 w-16" />
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
          <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
