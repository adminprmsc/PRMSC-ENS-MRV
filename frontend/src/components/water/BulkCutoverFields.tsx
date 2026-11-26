import type { ChangeEvent } from "react";
import { Gauge, Info } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPakistanIsoDateString } from "@/utils/pakistanTime";

type Handler = (e: ChangeEvent<HTMLInputElement>) => void;

/**
 * Bulk-meter cutover for a water system: from this date + time only meter
 * readings count; earlier logs use the pump-hours estimate (η × Q × hours),
 * which needs the two fill times below.
 */
export function BulkCutoverFields({
  date,
  time,
  designFill,
  actualFill,
  onDate,
  onTime,
  onDesignFill,
  onActualFill,
  disabled,
}: {
  date: string;
  time: string;
  designFill: string;
  actualFill: string;
  onDate: Handler;
  onTime: Handler;
  onDesignFill: Handler;
  onActualFill: Handler;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-blue-200/70 bg-blue-50/30 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Gauge className="size-4 text-blue-700 dark:text-blue-400" />
          Bulk meter readings start
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          From this date and time only bulk-meter readings are used. Logs before
          it are calculated from pump hours. Leave blank to start from the first
          meter reading.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bulk-since-date">Start date</Label>
          <Input
            id="bulk-since-date"
            type="date"
            max={getPakistanIsoDateString()}
            value={date}
            onChange={onDate}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-since-time">Start time (24-hour)</Label>
          <Input
            id="bulk-since-time"
            type="time"
            value={time}
            onChange={onTime}
            disabled={disabled || !date}
            placeholder="00:00"
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-blue-200/60 pt-3 dark:border-blue-900/40">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Optional — needed to estimate water for days logged before the bulk
          meter (η = design ÷ actual fill time).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pre-design-fill">Design time to fill tank (min)</Label>
            <Input
              id="pre-design-fill"
              type="number"
              inputMode="decimal"
              min={0}
              value={designFill}
              onChange={onDesignFill}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pre-actual-fill">Actual time to fill tank (min)</Label>
            <Input
              id="pre-actual-fill"
              type="number"
              inputMode="decimal"
              min={0}
              value={actualFill}
              onChange={onActualFill}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
