import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ListPaginationBar({
  page,
  pageCount,
  rangeLabel,
  canPrev,
  canNext,
  onPrev,
  onNext,
  className,
}: {
  page: number;
  pageCount: number;
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 ${className ?? ""}`}
    >
      <p className="text-xs text-muted-foreground tabular-nums">{rangeLabel}</p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2"
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </Button>
        <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2"
          disabled={!canNext}
          onClick={onNext}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
