import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageShell, StatCard } from "../../../components/layout";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronRight,
  FileCheck,
  RefreshCcw,
  Search,
  Undo2,
  XCircle,
} from "lucide-react";

import PaginatedListFooter from "@/components/PaginatedListFooter";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../../components/ui/empty";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { tehsilRoutes } from "../../../constants/routes";
import { useAuth } from "../../../contexts/AuthContext";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { getApiErrorMessage } from "../../../lib/api-error";
import { formatPakistanDateTime, getPakistanYear } from "../../../utils/pakistanTime";
import {
  buildWaterSystemOptions,
  filterTubewellSubmissions,
  fmtSubmissionNum,
  tubewellSubmissionStats,
  type TubewellSubmissionRow,
  type WaterSystemCatalogRow,
} from "./tubewellSubmissionUtils";

function statusBadge(status: TubewellSubmissionRow["status"]) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="outline" className="gap-1">
          <FileCheck className="size-3.5" />
          Pending review
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="size-3.5" />
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="size-3.5" />
          Rejected
        </Badge>
      );
    case "reverted_back":
      return (
        <Badge variant="outline" className="gap-1">
          <Undo2 className="size-3.5" />
          Reverted back
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          {status}
        </Badge>
      );
  }
}

const currentYear = getPakistanYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);
const MONTH_OPTIONS = [
  { v: "", label: "All months" },
  { v: "1", label: "Jan" },
  { v: "2", label: "Feb" },
  { v: "3", label: "Mar" },
  { v: "4", label: "Apr" },
  { v: "5", label: "May" },
  { v: "6", label: "Jun" },
  { v: "7", label: "Jul" },
  { v: "8", label: "Aug" },
  { v: "9", label: "Sep" },
  { v: "10", label: "Oct" },
  { v: "11", label: "Nov" },
  { v: "12", label: "Dec" },
];

const DEFAULT_PAGE_SIZE = 10;

export default function TubewellSubmissionsHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { getWaterVerificationQueue, getWaterSystems } =
    useTehsilManagerOperatorApi();

  const [rows, setRows] = useState<TubewellSubmissionRow[]>([]);
  const [waterSystems, setWaterSystems] = useState<WaterSystemCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [status, setStatus] = useState("submitted");
  const [tehsil, setTehsil] = useState("all");
  const [waterSystemId, setWaterSystemId] = useState("all");
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");

  const userTehsils = useMemo(
    () => (user?.tehsils ?? []).map((t) => String(t).trim()).filter(Boolean),
    [user?.tehsils],
  );

  useEffect(() => {
    if (tehsil !== "all") return;
    if (userTehsils.length === 0) return;
    setTehsil(userTehsils[0]!);
  }, [tehsil, userTehsils]);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = (await getWaterVerificationQueue()) as {
        submissions?: TubewellSubmissionRow[];
      };
      const list = Array.isArray(data?.submissions) ? data.submissions : [];
      setRows(list);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load tubewell submissions"));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadWaterSystems = async () => {
    try {
      const data = await getWaterSystems({});
      const list = Array.isArray(data) ? (data as WaterSystemCatalogRow[]) : [];
      setWaterSystems(list);
    } catch {
      setWaterSystems([]);
    }
  };

  useEffect(() => {
    void load();
    void loadWaterSystems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tehsilOptions = useMemo(() => {
    const fromRows = rows
      .map((r) => (r.system_info?.tehsil ?? "").trim())
      .filter(Boolean);
    const base = userTehsils.length > 0 ? userTehsils : fromRows;
    const unique = [...new Set(base)].sort((a, b) => a.localeCompare(b));
    return ["all", ...unique];
  }, [rows, userTehsils]);

  const waterSystemOptions = useMemo(
    () => buildWaterSystemOptions(rows, waterSystems, tehsil),
    [rows, waterSystems, tehsil],
  );

  const waterSystemOptionIds = useMemo(
    () => waterSystemOptions.map((o) => o.id).join("|"),
    [waterSystemOptions],
  );

  useEffect(() => {
    if (waterSystemId === "all") return;
    if (!waterSystemOptionIds.includes(waterSystemId)) {
      setWaterSystemId("all");
    }
  }, [waterSystemId, waterSystemOptionIds]);

  const listFilters = useMemo(
    () => ({ search, status, tehsil, waterSystemId, year, month }),
    [search, status, tehsil, waterSystemId, year, month],
  );

  const filtered = useMemo(
    () => filterTubewellSubmissions(rows, listFilters),
    [rows, listFilters],
  );

  const stats = useMemo(() => tubewellSubmissionStats(rows), [rows]);

  const {
    pageItems,
    pageIndex,
    pageSize,
    pageCount,
    total,
    setPageSize,
    goToPage,
    resetPage,
  } = useClientPagination(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [listFilters, resetPage]);

  const resetFilters = () => {
    setStatus("submitted");
    setTehsil(userTehsils[0] ?? "all");
    setWaterSystemId("all");
    setYear(String(currentYear));
    setMonth("");
    setSearch("");
  };

  return (
    <PageShell>
      <PageHeader
        icon={<FileCheck />}
        title="Submissions"
        description="Daily water logs from tubewell operators"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void load(true);
              void loadWaterSystems();
            }}
            disabled={refreshing || loading}
          >
            <RefreshCcw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total" value={stats.total} accent="slate" />
        <StatCard label="Pending" value={stats.pending} accent="amber" />
        <StatCard label="Accepted" value={stats.accepted} accent="green" />
        <StatCard label="Rejected" value={stats.rejected} accent="slate" />
        <StatCard label="Reverted" value={stats.reverted} accent="violet" />
      </div>

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v ?? "submitted")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted">Pending review</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="reverted_back">Reverted back</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tehsil</Label>
            <Select value={tehsil} onValueChange={(v) => setTehsil(v ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select tehsil" />
              </SelectTrigger>
              <SelectContent>
                {tehsilOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "all" ? "All tehsils" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Water system</Label>
            <Select
              value={waterSystemId}
              onValueChange={(v) => setWaterSystemId(v ?? "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select water system" />
              </SelectTrigger>
              <SelectContent>
                {waterSystemOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={(v) => setMonth(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.v || "__all__"} value={m.v}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by operator email, system UID, tehsil, or status…"
              className="h-11 pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">
            Results
            {!loading ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({total.toLocaleString()})
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: DEFAULT_PAGE_SIZE }).map((_, idx) => (
                <Skeleton key={idx} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <Empty className="border-border/60">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileCheck className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>No matching submissions</EmptyTitle>
                  <EmptyDescription>
                    Try adjusting status, tehsil, or water system filters.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Water system</TableHead>
                      <TableHead>Operator email</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Last edited</TableHead>
                      <TableHead className="text-right">Pump hrs</TableHead>
                      <TableHead className="text-right">
                        Interval pumped (m³)
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="sticky right-0 z-20 bg-card text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((r) => {
                      const from = `${location.pathname}${location.search}`;
                      return (
                        <TableRow key={r.id} className="align-top">
                          <TableCell>
                            <div className="min-w-[220px]">
                              <p className="font-medium text-foreground">
                                {r.system_info?.uid || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(r.system_info?.village || "—") +
                                  " · " +
                                  (r.system_info?.tehsil || "—") +
                                  " · " +
                                  (r.system_info?.month ?? "—") +
                                  "/" +
                                  (r.system_info?.year ?? "—")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.operator_email || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatPakistanDateTime(r.submitted_at)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatPakistanDateTime(
                              r.system_info?.last_edited_at ?? null,
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtSubmissionNum(r.system_info?.pump_operating_hours)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.system_info?.total_water_pumped ?? "—"}
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)]">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() =>
                                navigate(
                                  tehsilRoutes.waterSubmissionDetails(r.id),
                                  { state: { from } },
                                )
                              }
                            >
                              Details <ChevronRight className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <PaginatedListFooter
                pageIndex={pageIndex}
                pageSize={pageSize}
                pageCount={pageCount}
                total={total}
                onPageChange={goToPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
