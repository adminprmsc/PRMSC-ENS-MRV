import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Pencil,
  Plus,
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
import {
  MONTH_NAMES,
  type SolarMonthlyYearPayload,
  type SolarSystemListItem,
} from "./loggingComplianceTypes";

type SolarLoggingComplianceSectionProps = {
  baseId: string;
  panelId: string;
  solarSites: SolarSystemListItem[];
  sitesLoading: boolean;
  selectedSolarSystemId: string;
  onSelectSolarSystem: (id: string) => void;
  solarYear: number;
  onSolarYearChange: (y: number) => void;
  yearOptions: number[];
  loading: boolean;
  yearData: SolarMonthlyYearPayload | null;
};

export default function SolarLoggingComplianceSection({
  baseId,
  panelId,
  solarSites,
  sitesLoading,
  selectedSolarSystemId,
  onSelectSolarSystem,
  solarYear,
  onSolarYearChange,
  yearOptions,
  loading,
  yearData,
}: SolarLoggingComplianceSectionProps) {
  const navigate = useNavigate();
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "logged" | "missing">(
    "all",
  );

  const selectedSite = solarSites.find((s) => s.id === selectedSolarSystemId);

  const counts = useMemo(() => {
    const months = yearData?.months ?? [];
    let logged = 0;
    for (const m of months) {
      if (m.monthly_status === "logged") logged += 1;
    }
    return { logged, missing: 12 - logged };
  }, [yearData?.months]);

  const filteredMonths = useMemo(() => {
    const months = yearData?.months ?? [];
    const q = tableSearch.trim().toLowerCase();
    return months.filter((row) => {
      const name = (MONTH_NAMES[row.month] ?? "").toLowerCase();
      const isLogged = row.monthly_status === "logged";
      if (statusFilter === "logged" && !isLogged) return false;
      if (statusFilter === "missing" && isLogged) return false;
      if (!q) return true;
      return name.includes(q) || row.month.toString().includes(q);
    });
  }, [yearData?.months, tableSearch, statusFilter]);

  const showEmptyPick =
    !sitesLoading && solarSites.length > 0 && !selectedSolarSystemId;
  const showNoSites = !sitesLoading && solarSites.length === 0;
  const showData = Boolean(yearData && selectedSolarSystemId);

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-solar`}
      className="space-y-5"
    >
      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
            <Field className="lg:col-span-8">
              <FieldLabel htmlFor="solar-site-pick">Solar site</FieldLabel>
              <Select
                value={selectedSolarSystemId || undefined}
                onValueChange={(v) => {
                  if (v != null) onSelectSolarSystem(v);
                }}
                disabled={sitesLoading || solarSites.length === 0}
              >
                <SelectTrigger id="solar-site-pick" className="h-10 w-full">
                  <SelectValue
                    placeholder={sitesLoading ? "Loading…" : "Select site"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {solarSites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono text-xs">
                        {s.unique_identifier}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {s.village}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Monthly status for every month in the selected year.
              </FieldDescription>
            </Field>

            <Field className="lg:col-span-4">
              <FieldLabel htmlFor="solar-year-pick">Year</FieldLabel>
              <Select
                value={String(solarYear)}
                onValueChange={(v) => {
                  if (v != null) onSolarYearChange(Number(v));
                }}
                disabled={loading || !selectedSolarSystemId}
              >
                <SelectTrigger id="solar-year-pick" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {sitesLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
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
            <EmptyTitle>Select a solar site</EmptyTitle>
            <EmptyDescription>
              Choose a site above to load monthly logging for the year.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showNoSites ? (
        <Empty className="border border-dashed bg-muted/20 py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPin />
            </EmptyMedia>
            <EmptyTitle>No solar sites in scope</EmptyTitle>
            <EmptyDescription>
              Register sites under Solar systems, then return here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {loading && !yearData && selectedSolarSystemId ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading monthly logs…
        </div>
      ) : null}

      {showData && yearData ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/25 px-4 py-3 text-sm">
            <span className="font-mono text-xs font-semibold">
              {yearData.unique_identifier}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {selectedSite?.settlement
                ? `${selectedSite.village}, ${selectedSite.settlement}`
                : yearData.village}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs font-medium">{yearData.year}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Logged"
              value={
                <>
                  {counts.logged}
                  <span className="text-lg font-normal text-muted-foreground">
                    {" "}
                    / 12
                  </span>
                </>
              }
              description="Months with a saved log"
              accent="green"
              icon={<CheckCircle2 className="size-5" />}
              loading={loading}
            />
            <StatCard
              label="Missing"
              value={counts.missing}
              description="No monthly entry on file"
              accent="amber"
              icon={<AlertCircle className="size-5" />}
              valueClassName="text-destructive"
              loading={loading}
            />
            <StatCard
              label="Completion"
              value={`${Math.round((counts.logged / 12) * 100)}%`}
              description="Share of months logged"
              accent="blue"
              loading={loading}
            />
          </div>

          <DataListCard
            title={`Monthly status — ${yearData.year}`}
            count={filteredMonths.length}
            search={tableSearch}
            onSearchChange={setTableSearch}
            searchPlaceholder="Search month…"
            loading={loading && (yearData.months?.length ?? 0) === 0}
            toolbar={
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "logged", label: "Logged" },
                    { id: "missing", label: "Missing" },
                  ] as const
                ).map(({ id, label }) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={statusFilter === id ? "default" : "ghost"}
                    className="rounded-md px-3"
                    onClick={() => setStatusFilter(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            }
          >
            <DataTableWrap>
              <Table>
                <DataTableHeader>
                  <DataTableHead className="min-w-[140px]">Month</DataTableHead>
                  <DataTableHead className="min-w-[120px]">Status</DataTableHead>
                  <DataTableHead align="right" className="min-w-[160px]">
                    Actions
                  </DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {filteredMonths.length === 0 ? (
                    <DataTableEmpty
                      colSpan={3}
                      message={
                        tableSearch.trim() || statusFilter !== "all"
                          ? "No months match your filters."
                          : "No months in range."
                      }
                    />
                  ) : (
                    filteredMonths.map((row) => {
                      const name =
                        MONTH_NAMES[row.month] ?? `Month ${row.month}`;
                      const isLogged = row.monthly_status === "logged";
                      return (
                        <TableRow key={row.month}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            {isLogged ? (
                              <Badge variant="secondary" className="font-normal">
                                Logged
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="font-normal text-destructive"
                              >
                                Missing
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex justify-end gap-1.5">
                              {row.monthly_log?.record_id ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5"
                                  onClick={() =>
                                    navigate(
                                      tehsilRoutes.solarMonthlyLogEdit(
                                        row.monthly_log!.record_id,
                                      ),
                                    )
                                  }
                                >
                                  <Pencil className="size-3.5" />
                                  Edit
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 gap-1.5"
                                  onClick={() =>
                                    navigate(tehsilRoutes.solarMonthlyLogging)
                                  }
                                >
                                  <Plus className="size-3.5" />
                                  Add log
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
