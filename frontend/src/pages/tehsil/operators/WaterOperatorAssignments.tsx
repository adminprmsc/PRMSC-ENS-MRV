import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Droplets,
  Loader2,
  PencilLine,
  RefreshCw,
  ShieldOff,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataListCard,
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
} from "../../../components/layout";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Skeleton } from "../../../components/ui/skeleton";
import { tehsilRoutes } from "../../../constants/routes";
import { cn } from "../../../lib/utils";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getWaterOperatorAssignments,
  replaceWaterOperatorAssignments,
} from "../../../services/tehsilManagerOperatorService";

type WaterSystemRef = {
  id: string;
  unique_identifier: string;
  village: string;
  tehsil: string;
  settlement?: string | null;
};

type OperatorRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  water_systems: WaterSystemRef[];
};

type AssignmentsPayload = {
  operators: OperatorRow[];
  /** All tubewell operators you may assign in your scope (includes operators with no local links yet). */
  eligible_operators?: OperatorRow[];
  water_systems_catalog: WaterSystemRef[];
};

type AssignmentDialogFlow = "edit" | "add";

export default function WaterOperatorAssignments() {
  const navigate = useNavigate();
  const [data, setData] = useState<AssignmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFlow, setDialogFlow] = useState<AssignmentDialogFlow>("edit");
  const [editing, setEditing] = useState<OperatorRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Empty string = show all tehsils in the catalog (still only your tehsils from the server). */
  const [dialogTehsilFilter, setDialogTehsilFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getWaterOperatorAssignments();
      const p = raw as AssignmentsPayload;
      if (!p.eligible_operators?.length && p.operators?.length) {
        p.eligible_operators = p.operators;
      }
      setData(p);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load operator assignments"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogByTehsil = useMemo(() => {
    const catalog = data?.water_systems_catalog ?? [];
    const m = new Map<string, WaterSystemRef[]>();
    for (const s of catalog) {
      const t = s.tehsil?.trim() || "—";
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data?.water_systems_catalog]);

  const tehsilFilterOptions = useMemo(
    () => catalogByTehsil.map(([t]) => t),
    [catalogByTehsil],
  );

  const eligibleOperatorList = useMemo(() => {
    const list = data?.eligible_operators ?? data?.operators ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [data?.eligible_operators, data?.operators]);

  const catalogByTehsilFiltered = useMemo(() => {
    if (!dialogTehsilFilter) return catalogByTehsil;
    return catalogByTehsil.filter(([t]) => t === dialogTehsilFilter);
  }, [catalogByTehsil, dialogTehsilFilter]);

  const idsInTehsil = useCallback(
    (tehsilKey: string) => {
      const row = catalogByTehsil.find(([t]) => t === tehsilKey);
      return (row?.[1] ?? []).map((s) => s.id);
    },
    [catalogByTehsil],
  );

  const openEdit = (op: OperatorRow) => {
    setDialogFlow("edit");
    setEditing(op);
    setSelectedIds(new Set(op.water_systems.map((w) => w.id)));
    setDialogTehsilFilter("");
    setDialogOpen(true);
  };

  const openAddAssignment = () => {
    setDialogFlow("add");
    setEditing(null);
    setSelectedIds(new Set());
    setDialogTehsilFilter("");
    setDialogOpen(true);
  };

  const onPickOperatorForAdd = (operatorId: string) => {
    if (!operatorId.trim()) {
      setEditing(null);
      setSelectedIds(new Set());
      return;
    }
    const op = eligibleOperatorList.find((o) => o.id === operatorId);
    if (!op) return;
    setEditing(op);
    setSelectedIds(new Set(op.water_systems.map((w) => w.id)));
  };

  const toggleSystem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await replaceWaterOperatorAssignments(editing.id, [...selectedIds]);
      toast.success("Assignments updated.");
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not save assignments"));
    } finally {
      setSaving(false);
    }
  };

  const revokeAllForOperator = async (op: OperatorRow) => {
    const ok = window.confirm(
      `Remove all water system access for ${op.name} in your tehsil scope? They will keep assignments in other areas (if any) managed by other admins.`,
    );
    if (!ok) return;
    try {
      setSaving(true);
      await replaceWaterOperatorAssignments(op.id, []);
      toast.success("Assignments revoked for your tehsil scope.");
      await load();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not revoke assignments"));
    } finally {
      setSaving(false);
    }
  };

  const catalogLen = data?.water_systems_catalog.length ?? 0;
  const selectedCount = selectedIds.size;
  const operatorCount = data?.operators.length ?? 0;
  const tehsilCount = tehsilFilterOptions.length;

  return (
    <PageShell>
      <PageHeader
        icon={<Users />}
        title="Operator assignments"
        description={`${operatorCount} operators · ${catalogLen} systems`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openAddAssignment}
              disabled={loading || catalogLen === 0}
            >
              <UserPlus className="size-4" />
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      {data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Operators" value={operatorCount} accent="blue" />
          <StatCard label="Systems" value={catalogLen} accent="green" />
          <StatCard label="Tehsils" value={tehsilCount} accent="slate" />
        </div>
      ) : null}

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      ) : null}

      {data ? (
        <DataListCard
          title="Assignments"
          count={data.operators.length}
          loading={false}
        >
          {catalogLen === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Droplets className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Register water systems first.
              </p>
            </div>
          ) : data.operators.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Users className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No operators linked yet.
              </p>
            </div>
          ) : (
            <DataTableWrap>
              <Table>
                <DataTableHeader>
                  <DataTableHead>Operator</DataTableHead>
                  <DataTableHead>Email</DataTableHead>
                  <DataTableHead>Systems</DataTableHead>
                  <DataTableHead align="right">Actions</DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {data.operators.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="align-top">
                        <div className="font-medium">{row.name}</div>
                        {row.phone ? (
                          <div className="text-xs text-muted-foreground">
                            {row.phone}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {row.email}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {row.water_systems.map((ws) => (
                            <Badge
                              key={ws.id}
                              variant="outline"
                              className="max-w-[200px] truncate font-normal"
                              title={`${ws.unique_identifier} — ${ws.village}`}
                            >
                              {ws.village}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => openEdit(row)}
                            title="Edit assignments"
                          >
                            <PencilLine className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:text-destructive"
                            disabled={saving}
                            onClick={() => void revokeAllForOperator(row)}
                            title="Revoke all"
                          >
                            <ShieldOff className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableWrap>
          )}
        </DataListCard>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setDialogTehsilFilter("");
            setDialogFlow("edit");
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden border-border/80 p-0 shadow-lg sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-3 border-b border-border/80 bg-muted/30 px-6 py-5">
            <DialogTitle className="font-heading text-lg sm:text-xl">
              {dialogFlow === "add" ? "New assignment" : "Assign water systems"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {dialogFlow === "add" && !editing
                ? "Select operator and water systems."
                : editing
                  ? `${editing.name} · ${selectedCount} selected`
                  : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {dialogFlow === "add" ? (
              <div className="space-y-2">
                <Label
                  htmlFor="assign-pick-operator"
                  className="text-sm font-medium text-foreground"
                >
                  Tubewell operator
                </Label>
                <Select
                  value={editing?.id ?? "__none__"}
                  onValueChange={(v) =>
                    onPickOperatorForAdd(
                      v == null || v === "__none__" ? "" : v,
                    )
                  }
                  disabled={eligibleOperatorList.length === 0}
                >
                  <SelectTrigger
                    id="assign-pick-operator"
                    className="h-11 w-full min-w-0 text-base"
                  >
                    <SelectValue placeholder="Select an operator…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select an operator…</SelectItem>
                    {eligibleOperatorList.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name} — {op.email}
                        {op.water_systems.length === 0
                          ? " (no sites in your tehsil yet)"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eligibleOperatorList.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    No operators available.{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-2"
                      onClick={() => navigate(tehsilRoutes.onboardOperator)}
                    >
                      Onboard operator
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              className={cn(
                "space-y-4",
                dialogFlow === "add" && !editing && eligibleOperatorList.length > 0
                  ? "pointer-events-none opacity-45"
                  : "",
              )}
            >
            {tehsilFilterOptions.length > 1 ? (
              <div className="space-y-2">
                <Label
                  htmlFor="assign-tehsil-filter"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Filter by tehsil
                </Label>
                <NativeSelect
                  id="assign-tehsil-filter"
                  className="h-11 w-full min-w-0 text-base"
                  value={dialogTehsilFilter}
                  onChange={(e) => setDialogTehsilFilter(e.target.value)}
                >
                  <NativeSelectOption value="">
                    All tehsils ({catalogLen} systems)
                  </NativeSelectOption>
                  {tehsilFilterOptions.map((t) => {
                    const n = idsInTehsil(t).length;
                    return (
                      <NativeSelectOption key={t} value={t}>
                        {t} ({n} systems)
                      </NativeSelectOption>
                    );
                  })}
                </NativeSelect>
              </div>
            ) : null}

            <ScrollArea className="h-[min(52vh,400px)] rounded-xl border border-border/80 bg-card shadow-sm">
              <div className="p-3">
                {catalogByTehsil.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No systems in catalog.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {catalogByTehsilFiltered.map(([tehsil, systems]) => (
                      <div key={tehsil}>
                        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {tehsil}
                        </p>
                        <ul className="space-y-2">
                          {systems.map((s) => {
                            const checked = selectedIds.has(s.id);
                            return (
                              <li
                                key={s.id}
                                className={cn(
                                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                                  checked
                                    ? "border-primary/35 bg-primary/5"
                                    : "border-border/60 bg-background hover:bg-muted/50",
                                )}
                              >
                                <Checkbox
                                  id={`ws-${s.id}`}
                                  checked={checked}
                                  onCheckedChange={() => toggleSystem(s.id)}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`ws-${s.id}`}
                                  className="min-w-0 flex-1 cursor-pointer text-sm leading-snug font-normal"
                                >
                                  <span className="font-medium text-foreground">
                                    {s.village}
                                  </span>
                                  {s.settlement ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {s.settlement}
                                    </span>
                                  ) : null}
                                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                                    {s.unique_identifier}
                                  </span>
                                </Label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border/80 bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-w-[160px] gap-2 shadow-sm"
              onClick={() => void saveAssignments()}
              disabled={saving || !editing}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Save changes
                  <Check className="size-4 opacity-90" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
