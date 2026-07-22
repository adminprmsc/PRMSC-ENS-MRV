import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import * as XLSX from "xlsx";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type DataGridColumnMeta = {
  filterVariant?: "text" | "select" | "none";
  filterOptions?: string[];
};

type DataGridProps<T extends Record<string, unknown>> = {
  title: string;
  description?: string;
  rows: T[];
  columns: Array<ColumnDef<T, unknown>>;
  exportFileName: string;
  initialPageSize?: number;
  getRowId?: (row: T) => string;
  renderRowDetails?: (row: T) => ReactNode;
  toolbarExtra?: ReactNode;
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120);
}

function getColumnMeta<T>(col: ColumnDef<T, unknown>): DataGridColumnMeta {
  return (col.meta as DataGridColumnMeta | undefined) ?? {};
}

function getColumnLabel<T>(col: Column<T, unknown>): string {
  const header = col.columnDef.header;
  if (typeof header === "string") return header;
  return col.id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ArrowUp className="size-3.5 text-primary" />;
  }
  if (sorted === "desc") {
    return <ArrowDown className="size-3.5 text-primary" />;
  }
  return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />;
}

export default function DataGrid<T extends Record<string, unknown>>({
  title,
  description,
  rows,
  columns,
  exportFileName,
  initialPageSize = 25,
  getRowId: resolveRowId,
  renderRowDetails,
  toolbarExtra,
}: DataGridProps<T>) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 350);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [debouncedSearch, columnFilters, rows.length]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      globalFilter: debouncedSearch,
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (original, index) =>
      resolveRowId ? resolveRowId(original) : String(index),
    globalFilterFn: "includesString",
  });

  const visibleLeafColumns = useMemo(
    () => table.getAllLeafColumns().filter((c) => c.getIsVisible()),
    [table, columnVisibility],
  );

  const leafColumns = useMemo(
    () => table.getAllLeafColumns(),
    [table, columnVisibility, columns],
  );

  const filterableColumns = useMemo(
    () =>
      table
        .getAllLeafColumns()
        .filter((col) => {
          const meta = getColumnMeta(col.columnDef);
          return meta.filterVariant !== "none" && col.getIsVisible();
        }),
    [table, columnVisibility, columns],
  );

  const selectOptionsByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of table.getAllLeafColumns()) {
      const meta = getColumnMeta(col.columnDef);
      if (meta.filterVariant !== "select") continue;
      if (meta.filterOptions?.length) {
        map.set(col.id, meta.filterOptions);
        continue;
      }
      const values = new Set<string>();
      for (const row of rows) {
        const v = row[col.id];
        if (v != null && String(v).trim()) values.add(String(v));
      }
      map.set(col.id, Array.from(values).sort((a, b) => a.localeCompare(b)));
    }
    return map;
  }, [rows, table]);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const { pageIndex, pageSize } = table.getState().pagination;
  const from =
    table.getRowModel().rows.length === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, filteredCount);

  const exportXlsx = useCallback(() => {
    const exportRows = table.getFilteredRowModel().rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const col of visibleLeafColumns) {
        out[String(col.columnDef.header ?? col.id)] = r.getValue(col.id);
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${safeFileName(exportFileName)}.xlsx`);
  }, [exportFileName, table, visibleLeafColumns]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setColumnFilters([]);
    setExpandedRowId(null);
  }, []);

  const toggleRow = useCallback((rowId: string) => {
    setExpandedRowId((prev) => (prev === rowId ? null : rowId));
  }, []);

  const hasActiveFilters =
    searchInput.trim().length > 0 || columnFilters.length > 0;

  return (
    <TooltipProvider>
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="gap-4 border-b bg-muted/20 py-4 [.border-b]:pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">
                {title}
              </CardTitle>
              <Badge
                variant="secondary"
                className="border border-emerald-200/80 bg-emerald-50 font-medium text-emerald-800"
              >
                {filteredCount.toLocaleString()}{" "}
                {filteredCount === 1 ? "record" : "records"}
              </Badge>
              {hasActiveFilters ? (
                <Badge variant="outline" className="font-normal">
                  Filtered
                </Badge>
              ) : null}
            </div>
            {description ? (
              <CardDescription className="max-w-3xl text-xs leading-relaxed">
                {description}
              </CardDescription>
            ) : null}
          </div>

          <CardAction className="col-start-1 row-start-2 w-full justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-auto sm:justify-self-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <InputGroup className="h-9 w-full min-w-[220px] bg-background sm:w-72">
                <InputGroupAddon align="inline-start">
                  <Search className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search all columns…"
                  aria-label="Search all columns"
                />
                {searchInput ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label="Clear search"
                      onClick={() => setSearchInput("")}
                    >
                      <X className="size-3.5" />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>

              {toolbarExtra}

              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9"
                >
                  Clear filters
                </Button>
              ) : null}

              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 gap-1.5 bg-background",
                  )}
                >
                  <SlidersHorizontal className="size-3.5" />
                  Columns
                  <ChevronDown className="size-3.5 opacity-60" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <PopoverHeader className="px-1.5 pb-1.5">
                    <PopoverTitle className="text-xs font-medium text-muted-foreground">
                      Toggle columns
                    </PopoverTitle>
                  </PopoverHeader>
                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                    {leafColumns.map((col) => {
                      const visible = col.getIsVisible();
                      return (
                        <label
                          key={col.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={visible}
                            onCheckedChange={(checked) => {
                              col.toggleVisibility(checked === true);
                            }}
                          />
                          <span className="truncate">{getColumnLabel(col)}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5"
                onClick={exportXlsx}
              >
                <Download className="size-3.5" />
                Export Excel
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        {filterableColumns.length > 0 ? (
          <div className="border-b border-border/60 bg-background px-4 py-3">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Column filters
              </p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-xs"
                  onClick={clearFilters}
                >
                  Reset all
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {filterableColumns.map((col) => {
                const meta = getColumnMeta(col.columnDef);
                const label = String(col.columnDef.header ?? col.id);

                if (meta.filterVariant === "select") {
                  const options = selectOptionsByColumn.get(col.id) ?? [];
                  const current = (col.getFilterValue() as string) ?? "all";
                  return (
                    <div key={col.id} className="min-w-0 space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {label}
                      </Label>
                      <Select
                        value={current}
                        onValueChange={(v) =>
                          col.setFilterValue(v === "all" ? undefined : v)
                        }
                      >
                        <SelectTrigger className="h-8 w-full bg-background text-xs shadow-none">
                          <SelectValue placeholder={`All ${label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                return (
                  <div key={col.id} className="min-w-0 space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </Label>
                    <Input
                      value={(col.getFilterValue() ?? "") as string}
                      onChange={(e) =>
                        col.setFilterValue(e.target.value || undefined)
                      }
                      placeholder={`Filter ${label}…`}
                      className="h-8 bg-background text-xs shadow-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <Table className="enterprise-table min-w-[960px]">
          <TableHeader className="sticky top-0 z-10 bg-muted/60 [&_tr]:border-border/60">
            {table.getHeaderGroups().map((hg) => (
              <TableRow
                key={hg.id}
                className="hover:bg-transparent"
              >
                {renderRowDetails ? (
                  <TableHead className="w-10 px-2" aria-label="Expand" />
                ) : null}
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  return (
                    <TableHead
                      key={h.id}
                      className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          <SortIcon sorted={sorted} />
                        </button>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const rowId = row.id;
              const isExpanded = expandedRowId === rowId;
              return (
                <Fragment key={rowId}>
                  <TableRow
                    data-state={isExpanded ? "selected" : undefined}
                    className={cn(
                      "border-border/50 transition-colors duration-200",
                      isExpanded && "bg-primary/[0.04]",
                    )}
                  >
                    {renderRowDetails ? (
                      <TableCell className="px-2 py-2">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => toggleRow(rowId)}
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? "Collapse details"
                                    : "Expand details"
                                }
                              >
                                <ChevronDown
                                  className={cn(
                                    "size-4 transition-transform duration-200",
                                    isExpanded && "rotate-180",
                                  )}
                                />
                              </Button>
                            }
                          />
                          <TooltipContent>
                            {isExpanded ? "Collapse" : "Expand details"}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    ) : null}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="px-3 py-3 text-sm text-foreground/90"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderRowDetails && isExpanded ? (
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableCell
                        colSpan={row.getVisibleCells().length + 1}
                        className="bg-muted/25 px-3 py-3 whitespace-normal"
                      >
                        {renderRowDetails(row.original)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={
                    visibleLeafColumns.length + (renderRowDetails ? 1 : 0)
                  }
                  className="h-48 whitespace-normal p-0"
                >
                  <Empty className="border-0 py-10">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Table2 />
                      </EmptyMedia>
                      <EmptyTitle>No matching records</EmptyTitle>
                      <EmptyDescription>
                        No systems match your current search or column filters.
                        Try clearing filters or broadening the scope.
                      </EmptyDescription>
                    </EmptyHeader>
                    {hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </Empty>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <Separator />

        <CardFooter className="flex flex-col gap-3 border-0 bg-muted/20 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium tabular-nums text-foreground">
              {from.toLocaleString()}–{to.toLocaleString()}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-foreground">
              {filteredCount.toLocaleString()}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="datagrid-page-size"
                className="text-xs text-muted-foreground"
              >
                Rows per page
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => table.setPageSize(Number(v))}
              >
                <SelectTrigger
                  id="datagrid-page-size"
                  className="h-8 w-[72px] bg-background text-xs shadow-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 bg-background"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label="First page"
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 bg-background"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 min-w-[72px] bg-background px-2 text-xs tabular-nums"
                disabled
              >
                {pageCount === 0 ? 0 : pageIndex + 1}/{pageCount}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 bg-background"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 bg-background"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
                aria-label="Last page"
              >
                <ChevronsRight className="size-4" />
              </Button>
            </ButtonGroup>
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
