import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function kv(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

type DataListCardProps = {
  title?: string;
  count?: number | undefined;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  colSpan?: number;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DataListCard({
  title = "Records",
  count,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  loading,
  skeletonRows = 8,
  children,
  toolbar,
  className,
}: DataListCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base font-semibold">
          {title}
          {count !== undefined && !loading ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({count})
            </span>
          ) : null}
        </CardTitle>
        {toolbar}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {onSearchChange !== undefined ? (
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-9"
            />
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: skeletonRows }).map((_, idx) => (
              <Skeleton key={idx} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function DataTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/80">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableEmpty({
  colSpan,
  message = "No records found.",
}: {
  colSpan: number;
  message?: string;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-20 text-center text-sm text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}

export function DataTableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableHeader>
      <TableRow
        className={cn(
          "border-border/80 bg-muted/30 hover:bg-muted/30",
          className,
        )}
      >
        {children}
      </TableRow>
    </TableHeader>
  );
}

export function DataTableHead({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <TableHead
      className={cn(
        "text-xs font-medium uppercase tracking-wide text-muted-foreground",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

export { Table, TableBody, TableCell, TableRow };
