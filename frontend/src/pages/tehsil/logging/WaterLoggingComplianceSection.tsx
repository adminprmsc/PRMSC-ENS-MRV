import { useMemo, useState } from "react";
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
import { Skeleton } from "../../../components/ui/skeleton";
import { tehsilRoutes } from "../../../constants/routes";
import { cn } from "../../../lib/utils";
import { formatPakistanIsoDateLabel } from "../../../utils/pakistanTime";
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
  rangeDays: 7 | 14 | 30;
  onRangeDaysChange: (days: 7 | 14 | 30) => void;
  loading: boolean;
  rangeData: WaterDailyRangePayload | null;
};

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
  rangeDays,
  onRangeDaysChange,
  loading,
  rangeData,
}: WaterLoggingComplianceSectionProps) {
  const navigate = useNavigate();
  const [tableSearch, setTableSearch] = useState("");

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
                Window ends today and counts backward.
              </FieldDescription>
            </Field>

            <Field className="lg:col-span-7">
              <FieldLabel>Period</FieldLabel>
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                {RANGE_PRESETS.map(({ days, label }) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={rangeDays === days ? "default" : "ghost"}
                    className="min-w-[3.25rem] rounded-md"
                    onClick={() => onRangeDaysChange(days)}
                    disabled={loading || !selectedWaterSystemId}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <FieldDescription>
                All days in the window are shown in the table below.
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
