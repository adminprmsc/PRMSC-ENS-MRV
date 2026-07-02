import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataListCard,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
  PageHeader,
  PageShell,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableRow,
  kv,
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
  Field,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getPakistanIsoDateString,
  getPakistanMonth,
  getPakistanYear,
} from "../../../utils/pakistanTime";
import { getLoggingCompliance } from "../../../services/tehsilManagerOperatorService";

type WaterSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  unique_identifier: string;
  daily_status: string;
};

type SolarSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  unique_identifier: string;
  monthly_status: string;
  monthly_log: { record_id: string; has_data: boolean } | null;
};

type CompliancePayload = {
  water_date: string;
  solar_year: number;
  solar_month: number;
  water_systems: WaterSystemRow[];
  solar_systems: SolarSystemRow[];
};

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = MONTH_NAMES.map((m) =>
  m ? m.slice(0, 3) : "",
);

function waterStatusLabel(status: string): string {
  switch (status) {
    case "missing":
      return "Missing";
    case "draft":
      return "Draft";
    case "submitted":
      return "Pending review";
    case "accepted":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "reverted_back":
      return "Reverted";
    default:
      return status;
  }
}

function waterStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "missing":
    case "rejected":
      return "destructive";
    case "draft":
    case "reverted_back":
      return "secondary";
    case "submitted":
      return "default";
    default:
      return "outline";
  }
}

function todayIsoDate(): string {
  return getPakistanIsoDateString();
}

export default function LoggingCompliance() {
  const navigate = useNavigate();
  const [section, setSection] = useState<"water" | "solar">("water");
  const [waterDate, setWaterDate] = useState(todayIsoDate);
  const [solarYear, setSolarYear] = useState(getPakistanYear());
  const [solarMonth, setSolarMonth] = useState(getPakistanMonth());
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [waterSearch, setWaterSearch] = useState("");
  const [solarSearch, setSolarSearch] = useState("");
  const [waterStatusFilter, setWaterStatusFilter] = useState<string>("all");
  const [solarStatusFilter, setSolarStatusFilter] = useState<
    "all" | "logged" | "missing"
  >("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getLoggingCompliance({
        water_date: waterDate,
        solar_year: solarYear,
        solar_month: solarMonth,
      });
      setData(raw as CompliancePayload);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load compliance"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [waterDate, solarYear, solarMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const waterStats = useMemo(() => {
    const rows = data?.water_systems ?? [];
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.daily_status] = (counts[r.daily_status] ?? 0) + 1;
    }
    return counts;
  }, [data?.water_systems]);

  const solarStats = useMemo(() => {
    const rows = data?.solar_systems ?? [];
    let logged = 0;
    for (const r of rows) {
      if (r.monthly_status === "logged") logged += 1;
    }
    return { logged, missing: rows.length - logged, total: rows.length };
  }, [data?.solar_systems]);

  const yearOptions = useMemo(() => {
    const y = getPakistanYear();
    return Array.from({ length: 8 }, (_, i) => y - 4 + i);
  }, []);

  const waterDone =
    (waterStats.submitted ?? 0) + (waterStats.accepted ?? 0);

  const filteredWater = useMemo(() => {
    const rows = data?.water_systems ?? [];
    const q = waterSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (waterStatusFilter !== "all" && row.daily_status !== waterStatusFilter) {
        return false;
      }
      if (!q) return true;
      return [row.unique_identifier, row.village, row.tehsil]
        .some((x) => x.toLowerCase().includes(q));
    });
  }, [data?.water_systems, waterSearch, waterStatusFilter]);

  const filteredSolar = useMemo(() => {
    const rows = data?.solar_systems ?? [];
    const q = solarSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const isLogged = row.monthly_status === "logged";
      if (solarStatusFilter === "logged" && !isLogged) return false;
      if (solarStatusFilter === "missing" && isLogged) return false;
      if (!q) return true;
      return [row.unique_identifier, row.village, row.tehsil]
        .some((x) => x.toLowerCase().includes(q));
    });
  }, [data?.solar_systems, solarSearch, solarStatusFilter]);

  const waterStatusOptions = useMemo(() => {
    const rows = data?.water_systems ?? [];
    const statuses = [...new Set(rows.map((r) => r.daily_status))].sort();
    return statuses;
  }, [data?.water_systems]);

  return (
    <PageShell>
      <PageHeader
        icon={<CalendarClock />}
        title="Logging compliance"
        description="Daily water and monthly solar log status across your scope"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(tehsilRoutes.waterLoggingCompliance)}
            >
              <ExternalLink className="size-4" />
              Water detail
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(tehsilRoutes.solarLoggingCompliance)}
            >
              <ExternalLink className="size-4" />
              Solar detail
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCcw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as "water" | "solar")}
        className="space-y-5"
      >
        <TabsList className="grid h-10 w-full max-w-md grid-cols-2">
          <TabsTrigger value="water" className="gap-1.5">
            <Droplets className="size-4" />
            Water
          </TabsTrigger>
          <TabsTrigger value="solar" className="gap-1.5">
            <Sun className="size-4" />
            Solar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="water" className="mt-0 space-y-5">
          <Card>
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base font-semibold">
                Water — {waterDate}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <FieldGroup className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <Field className="min-w-[200px] flex-1 sm:max-w-xs">
                  <FieldLabel htmlFor="water-date">Reporting date</FieldLabel>
                  <Input
                    id="water-date"
                    type="date"
                    className="h-10"
                    value={waterDate}
                    onChange={(e) => setWaterDate(e.target.value)}
                  />
                </Field>
                <Button
                  size="sm"
                  className="h-10 shrink-0 px-5"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  Apply
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>

          {data ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Missing"
                value={waterStats.missing ?? 0}
                accent="amber"
                icon={<AlertCircle className="size-5" />}
                valueClassName="text-destructive"
                loading={loading}
              />
              <StatCard
                label="Draft"
                value={waterStats.draft ?? 0}
                accent="slate"
                loading={loading}
              />
              <StatCard
                label="Submitted / approved"
                value={waterDone}
                accent="green"
                icon={<CheckCircle2 className="size-5" />}
                loading={loading}
              />
            </div>
          ) : null}

          <DataListCard
            title="Water systems"
            count={filteredWater.length}
            loading={loading && !data}
            emptyMessage="No water systems in scope."
            search={waterSearch}
            onSearchChange={setWaterSearch}
            searchPlaceholder="UID, village, tehsil…"
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={waterStatusFilter}
                  onValueChange={(v) => {
                    if (v) setWaterStatusFilter(v);
                  }}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {waterStatusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {waterStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {waterDone > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(tehsilRoutes.waterSubmissions)}
                  >
                    Submissions
                  </Button>
                ) : null}
              </div>
            }
          >
            <DataTableWrap>
              <Table>
                <DataTableHeader>
                  <DataTableHead>Location</DataTableHead>
                  <DataTableHead>UID</DataTableHead>
                  <DataTableHead>Tehsil</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead align="right">Actions</DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {filteredWater.length === 0 ? (
                    <DataTableEmpty
                      colSpan={5}
                      message={
                        waterSearch.trim() || waterStatusFilter !== "all"
                          ? "No systems match your filters."
                          : "No water systems in scope."
                      }
                    />
                  ) : (
                    filteredWater.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">{kv(row.village)}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {kv(row.unique_identifier)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {kv(row.tehsil)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={waterStatusVariant(row.daily_status)}>
                            {waterStatusLabel(row.daily_status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() =>
                              navigate(tehsilRoutes.waterLoggingCompliance)
                            }
                          >
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </DataTableWrap>
          </DataListCard>
        </TabsContent>

        <TabsContent value="solar" className="mt-0 space-y-5">
          <Card>
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base font-semibold">
                Solar — {MONTH_NAMES[solarMonth]} {solarYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                <Field className="lg:col-span-4">
                  <FieldLabel htmlFor="solar-y">Year</FieldLabel>
                  <Select
                    value={String(solarYear)}
                    onValueChange={(v) => v && setSolarYear(Number(v))}
                  >
                    <SelectTrigger id="solar-y" className="h-10">
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
                <Field className="lg:col-span-4">
                  <FieldLabel htmlFor="solar-m">Month</FieldLabel>
                  <Select
                    value={String(solarMonth)}
                    onValueChange={(v) => v && setSolarMonth(Number(v))}
                  >
                    <SelectTrigger id="solar-m" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_SHORT.slice(1).map((name, i) => (
                        <SelectItem key={name} value={String(i + 1)}>
                          {MONTH_NAMES[i + 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="lg:col-span-4">
                  <Button
                    size="sm"
                    className="h-10 w-full sm:w-auto"
                    onClick={() => void load()}
                    disabled={loading}
                  >
                    Apply
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {data ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Logged"
                value={solarStats.logged}
                accent="green"
                icon={<CheckCircle2 className="size-5" />}
                loading={loading}
              />
              <StatCard
                label="Missing"
                value={solarStats.missing}
                accent="amber"
                icon={<AlertCircle className="size-5" />}
                valueClassName="text-destructive"
                loading={loading}
              />
              <StatCard
                label="Total sites"
                value={solarStats.total}
                accent="slate"
                loading={loading}
              />
            </div>
          ) : null}

          <DataListCard
            title="Solar sites"
            count={filteredSolar.length}
            loading={loading && !data}
            search={solarSearch}
            onSearchChange={setSolarSearch}
            searchPlaceholder="UID, village, tehsil…"
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
                    variant={solarStatusFilter === id ? "default" : "ghost"}
                    className="rounded-md px-3"
                    onClick={() => setSolarStatusFilter(id)}
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
                  <DataTableHead>Location</DataTableHead>
                  <DataTableHead>UID</DataTableHead>
                  <DataTableHead>Tehsil</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead align="right">Actions</DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {filteredSolar.length === 0 ? (
                    <DataTableEmpty
                      colSpan={5}
                      message={
                        solarSearch.trim() || solarStatusFilter !== "all"
                          ? "No sites match your filters."
                          : "No solar sites in scope."
                      }
                    />
                  ) : (
                    filteredSolar.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">{kv(row.village)}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {kv(row.unique_identifier)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {kv(row.tehsil)}
                        </TableCell>
                        <TableCell>
                          {row.monthly_status === "logged" ? (
                            <Badge variant="secondary">Logged</Badge>
                          ) : (
                            <Badge variant="destructive">Missing</Badge>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </DataTableWrap>
          </DataListCard>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
