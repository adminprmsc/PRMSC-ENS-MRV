import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileEdit,
  Loader2,
  MapPin,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  DataListCard,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "../../../components/layout";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../../components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { toast } from "sonner";
import { tehsilRoutes } from "../../../constants/routes";
import { cn } from "../../../lib/utils";
import {
  formatPakistanIsoDateLabel,
  getPakistanIsoDateString,
  subtractPakistanDays,
} from "../../../utils/pakistanTime";
import {
  type WaterDailyRangeDay,
  type WaterDailyRangePayload,
  type WaterSystemListItem,
  formatAssignedOperators,
  formatAssignedOperatorsTitle,
  waterStatusLabel,
  waterStatusVariant,
} from "./loggingComplianceTypes";

type WaterLoggingComplianceSectionProps = {
  baseId: string;
  panelId: string;
  waterSystems: WaterSystemListItem[];
  systemsLoading: boolean;
  selectedWaterSystemId: string;
  onSelectWaterSystem: (id: string) => void;
  dateFrom: string;
  dateTo: string;
  onRangeChange: (dateFrom: string, dateTo: string) => void;
  loading: boolean;
  rangeData: WaterDailyRangePayload | null;
};

const MAX_RANGE_DAYS = 31;

function inclusiveDaySpan(dateFrom: string, dateTo: string): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const fromMs = new Date(`${dateFrom.slice(0, 10)}T00:00:00+05:00`).getTime();
  const toMs = new Date(`${dateTo.slice(0, 10)}T00:00:00+05:00`).getTime();
  return Math.floor((toMs - fromMs) / DAY_MS) + 1;
}

function presetRange(days: 7 | 14 | 30): { dateFrom: string; dateTo: string } {
  const dateTo = getPakistanIsoDateString();
  const dateFrom = subtractPakistanDays(dateTo, days - 1);
  return { dateFrom, dateTo };
}

function matchingPreset(
  dateFrom: string,
  dateTo: string,
): 7 | 14 | 30 | null {
  for (const days of [7, 14, 30] as const) {
    const preset = presetRange(days);
    if (preset.dateFrom === dateFrom && preset.dateTo === dateTo) {
      return days;
    }
  }
  return null;
}

function formatDayLabel(isoDate: string): string {
  return formatPakistanIsoDateLabel(isoDate);
}

function countStatuses(days: WaterDailyRangeDay[]) {
  const counts: Record<string, number> = {};
  for (const row of days) {
    const k = row.daily_status;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

const RANGE_PRESETS: { days: 7 | 14 | 30; label: string }[] = [
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
];

export default function WaterLoggingComplianceSection({
  baseId,
  panelId,
  waterSystems,
  systemsLoading,
  selectedWaterSystemId,
  onSelectWaterSystem,
  dateFrom,
  dateTo,
  onRangeChange,
  loading,
  rangeData,
}: WaterLoggingComplianceSectionProps) {
  const navigate = useNavigate();
  const [tableSearch, setTableSearch] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(dateTo);
  const activePreset = useMemo(
    () => matchingPreset(dateFrom, dateTo),
    [dateFrom, dateTo],
  );

  useEffect(() => {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
  }, [dateFrom, dateTo]);

  const allDays = rangeData?.days ?? [];
  const rangeStats = useMemo(() => countStatuses(allDays), [allDays]);

  const selectedSystem = waterSystems.find(
    (s) => s.id === selectedWaterSystemId,
  );
  const operatorsForTable = rangeData?.assigned_operators;
  const opsText = formatAssignedOperators(operatorsForTable);
  const opsTitle = formatAssignedOperatorsTitle(operatorsForTable);
  const showOps = opsText.trim() !== "";

  const filteredDays = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return allDays;
    return allDays.filter((row) => {
      const status = waterStatusLabel(row.daily_status).toLowerCase();
      return row.date.includes(q) || status.includes(q);
    });
  }, [allDays, tableSearch]);

  const showEmptyPick =
    !systemsLoading && waterSystems.length > 0 && !selectedWaterSystemId;
  const showNoSystems = !systemsLoading && waterSystems.length === 0;
  const showData = Boolean(rangeData && selectedWaterSystemId);

  const applyCustomRange = () => {
    const from = draftDateFrom.trim();
    const to = draftDateTo.trim();
    if (!from || !to) {
      toast.error("Choose both start and end dates.");
      return;
    }
    if (to < from) {
      toast.error("End date must be on or after start date.");
      return;
    }
    const span = inclusiveDaySpan(from, to);
    if (span > MAX_RANGE_DAYS) {
      toast.error(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`);
      return;
    }
    onRangeChange(from, to);
  };

  const applyPreset = (days: 7 | 14 | 30) => {
    const { dateFrom: from, dateTo: to } = presetRange(days);
    setDraftDateFrom(from);
    setDraftDateTo(to);
    onRangeChange(from, to);
  };

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-water`}
      className="space-y-5"
    >
      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <FieldGroup className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Field className="lg:col-span-5">
              <FieldLabel htmlFor="water-system-pick">Water system</FieldLabel>
              <Select
                value={selectedWaterSystemId || undefined}
                onValueChange={(v) => {
                  if (v != null) onSelectWaterSystem(v);
                }}
                disabled={systemsLoading || waterSystems.length === 0}
              >
                <SelectTrigger
                  id="water-system-pick"
                  className="h-10 w-full"
                  aria-describedby={`${baseId}-step1-hint`}
                >
                  <SelectValue
                    placeholder={
                      systemsLoading ? "Loading…" : "Select system"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {waterSystems.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      <span className="font-mono text-xs">
                        {ws.unique_identifier}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {ws.village}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription id={`${baseId}-step1-hint`}>
                Pick a date range below (max {MAX_RANGE_DAYS} days).
              </FieldDescription>
            </Field>

            <Field className="lg:col-span-7">
              <FieldLabel>Period</FieldLabel>
              <div className="space-y-3">
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                  {RANGE_PRESETS.map(({ days, label }) => (
                    <Button
                      key={days}
                      type="button"
                      size="sm"
                      variant={activePreset === days ? "default" : "ghost"}
                      className="min-w-[3.25rem] rounded-md"
                      onClick={() => applyPreset(days)}
                      disabled={loading || !selectedWaterSystemId}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor={`${baseId}-date-from`}>
                      From
                    </FieldLabel>
                    <Input
                      id={`${baseId}-date-from`}
                      type="date"
                      className="h-10"
                      value={draftDateFrom}
                      max={draftDateTo || undefined}
                      disabled={loading || !selectedWaterSystemId}
                      onChange={(e) => setDraftDateFrom(e.target.value)}
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor={`${baseId}-date-to`}>To</FieldLabel>
                    <Input
                      id={`${baseId}-date-to`}
                      type="date"
                      className="h-10"
                      value={draftDateTo}
                      min={draftDateFrom || undefined}
                      max={getPakistanIsoDateString()}
                      disabled={loading || !selectedWaterSystemId}
                      onChange={(e) => setDraftDateTo(e.target.value)}
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 shrink-0 px-5"
                    disabled={loading || !selectedWaterSystemId}
                    onClick={applyCustomRange}
                  >
                    Apply
                  </Button>
                </div>
              </div>
              <FieldDescription>
                Quick presets or choose custom dates, then Apply. All days in
                the range appear in the table below.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {systemsLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {showEmptyPick ? (
        <Empty className="border border-dashed bg-muted/20 py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPin />
            </EmptyMedia>
            <EmptyTitle>Select a water system</EmptyTitle>
            <EmptyDescription>
              Choose a site above to load daily logging for the selected period.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showNoSystems ? (
        <Empty className="border border-dashed bg-muted/20 py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPin />
            </EmptyMedia>
            <EmptyTitle>No water systems in scope</EmptyTitle>
            <EmptyDescription>
              Register systems under Water systems, then return here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {loading && !rangeData && selectedWaterSystemId ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading daily logs…
        </div>
      ) : null}

      {showData && rangeData ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/25 px-4 py-3 text-sm">
            <span className="font-mono text-xs font-semibold">
              {rangeData.unique_identifier}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {selectedSystem?.settlement
                ? `${selectedSystem.village}, ${selectedSystem.settlement}`
                : rangeData.village}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {rangeData.date_from} — {rangeData.date_to} · {allDays.length}{" "}
              day{allDays.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Missing"
              value={rangeStats.missing ?? 0}
              description="No entry for that day"
              accent="amber"
              icon={<AlertCircle className="size-5" />}
              valueClassName="text-destructive"
              loading={loading}
            />
            <StatCard
              label="Draft"
              value={rangeStats.draft ?? 0}
              description="Saved but not submitted"
              accent="slate"
              icon={<FileEdit className="size-5" />}
              loading={loading}
            />
            <StatCard
              label="Submitted / approved"
              value={(rangeStats.submitted ?? 0) + (rangeStats.accepted ?? 0)}
              description="In review or accepted"
              accent="green"
              icon={<CheckCircle2 className="size-5" />}
              loading={loading}
            />
          </div>

          <DataListCard
            title="Daily log"
            count={filteredDays.length}
            search={tableSearch}
            onSearchChange={setTableSearch}
            searchPlaceholder="Search date or status…"
            loading={loading && allDays.length === 0}
            toolbar={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(tehsilRoutes.waterSubmissions)}
              >
                <ClipboardList className="size-4" />
                Submissions
              </Button>
            }
          >
            <DataTableWrap>
              <Table>
                <DataTableHeader>
                  <DataTableHead className="min-w-[200px]">Date</DataTableHead>
                  <DataTableHead className="min-w-[140px]">Status</DataTableHead>
                  <DataTableHead className="min-w-[200px]">
                    Operators
                  </DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {filteredDays.length === 0 ? (
                    <DataTableEmpty
                      colSpan={3}
                      message={
                        tableSearch.trim()
                          ? "No rows match your search."
                          : "No rows for this period."
                      }
                    />
                  ) : (
                    filteredDays.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {formatDayLabel(row.date)}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.date}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={waterStatusVariant(row.daily_status)}
                            className="font-normal"
                          >
                            {waterStatusLabel(row.daily_status)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "max-w-[360px] text-sm",
                            showOps
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                          title={opsTitle}
                        >
                          {showOps ? (
                            <span className="line-clamp-2">{opsText}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </DataTableWrap>
          </DataListCard>
        </>
      ) : null}
    </div>
  );
}
