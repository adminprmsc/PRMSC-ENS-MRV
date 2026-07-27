import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPinned, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout";
import {
  DataListCard,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
  kv,
} from "@/components/layout/tehsil-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocationCatalog } from "@/hooks/useLocationCatalog";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  addLocationSettlement,
  addLocationVillage,
  deactivateLocationSettlement,
  deactivateLocationVillage,
  listLocationSettlements,
  listLocationVillages,
  type LocationSettlementRow,
  type LocationVillageRow,
} from "@/services/locationsService";
import { formatPakistanDateTime } from "@/utils/pakistanTime";

export default function AdminLocationsPage() {
  const {
    catalog,
    loading: catalogLoading,
    reload: reloadCatalog,
    villagesFor,
    tehsils: catalogTehsils,
  } = useLocationCatalog();

  const [tehsil, setTehsil] = useState<string>("");
  useEffect(() => {
    if (!tehsil && catalogTehsils[0]) setTehsil(catalogTehsils[0]);
  }, [catalogTehsils, tehsil]);
  const [customVillages, setCustomVillages] = useState<LocationVillageRow[]>(
    [],
  );
  const [customSettlements, setCustomSettlements] = useState<
    LocationSettlementRow[]
  >([]);
  const [loadingCustom, setLoadingCustom] = useState(false);

  const [villageDialogOpen, setVillageDialogOpen] = useState(false);
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [newVillageName, setNewVillageName] = useState("");
  const [newSettlementVillage, setNewSettlementVillage] = useState("");
  const [newSettlementName, setNewSettlementName] = useState("");
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadCustom = useCallback(async () => {
    setLoadingCustom(true);
    try {
      const [v, s] = await Promise.all([
        listLocationVillages({ custom_only: true }),
        listLocationSettlements({ custom_only: true }),
      ]);
      setCustomVillages(v.villages ?? []);
      setCustomSettlements(s.settlements ?? []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load custom locations"));
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  useEffect(() => {
    void loadCustom();
  }, [loadCustom]);

  const villageChoices = useMemo(
    () => villagesFor(tehsil),
    [villagesFor, tehsil],
  );

  const refreshAll = async () => {
    await Promise.all([reloadCatalog(), loadCustom()]);
  };

  const submitVillage = async () => {
    const name = newVillageName.trim();
    if (!tehsil || name.length < 2) {
      toast.error("Choose a tehsil and enter a village name (min 2 characters)");
      return;
    }
    setSaving(true);
    try {
      await addLocationVillage({ tehsil, name });
      toast.success(`Village “${name}” added under ${tehsil}`);
      setVillageDialogOpen(false);
      setNewVillageName("");
      await refreshAll();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not add village"));
    } finally {
      setSaving(false);
    }
  };

  const submitSettlement = async () => {
    const name = newSettlementName.trim();
    const village = newSettlementVillage.trim();
    if (!tehsil || !village || name.length < 2) {
      toast.error("Choose tehsil, village, and settlement name");
      return;
    }
    setSaving(true);
    try {
      await addLocationSettlement({ tehsil, village, name });
      toast.success(`Settlement “${name}” added under ${village}`);
      setSettlementDialogOpen(false);
      setNewSettlementName("");
      await refreshAll();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not add settlement"));
    } finally {
      setSaving(false);
    }
  };

  const removeVillage = async (row: LocationVillageRow) => {
    if (
      !window.confirm(
        `Deactivate village “${row.name}” in ${row.tehsil}? It will no longer appear in registration pickers.`,
      )
    ) {
      return;
    }
    setActingId(row.id);
    try {
      await deactivateLocationVillage(row.id);
      toast.success("Village deactivated");
      await refreshAll();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not deactivate village"));
    } finally {
      setActingId(null);
    }
  };

  const removeSettlement = async (row: LocationSettlementRow) => {
    if (
      !window.confirm(
        `Deactivate settlement “${row.name}” under ${row.village}?`,
      )
    ) {
      return;
    }
    setActingId(row.id);
    try {
      await deactivateLocationSettlement(row.id);
      toast.success("Settlement deactivated");
      await refreshAll();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not deactivate settlement"));
    } finally {
      setActingId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={<MapPinned />}
        title="Villages & settlements"
        description={`${catalog.meta.village_count} villages · ${catalog.meta.settlement_count} settlements in catalog · ${catalog.meta.custom_village_count} custom villages · ${catalog.meta.custom_settlement_count} custom settlements. Additions appear immediately for Tehsil Managers registering water/solar sites.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={catalogLoading || loadingCustom}
              onClick={() => void refreshAll()}
            >
              <RefreshCcw
                className={`size-4 ${catalogLoading || loadingCustom ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewSettlementVillage("");
                setNewSettlementName("");
                setSettlementDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add settlement
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setNewVillageName("");
                setVillageDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add village
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border/70 bg-card p-3">
        <div className="min-w-[220px] space-y-1.5">
          <Label className="text-xs text-muted-foreground">Working tehsil</Label>
          <Select value={tehsil} onValueChange={(v) => v && setTehsil(v)}>
            <SelectTrigger className="h-9 w-full bg-background">
              <SelectValue placeholder="Select tehsil" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {catalogTehsils.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="pb-1 text-xs text-muted-foreground">
          {villageChoices.length} villages available in this tehsil (catalog).
        </p>
      </div>

      <Tabs defaultValue="custom">
        <TabsList>
          <TabsTrigger value="custom">Custom additions</TabsTrigger>
          <TabsTrigger value="preview">Tehsil preview</TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="mt-4 space-y-4">
          <DataListCard
            loading={loadingCustom}
            count={customVillages.length}
            title="Custom villages"
          >
            <DataTableWrap>
              <Table>
                <DataTableHeader>
                  <DataTableHead>Tehsil</DataTableHead>
                  <DataTableHead>Village</DataTableHead>
                  <DataTableHead>Added</DataTableHead>
                  <DataTableHead align="right">Actions</DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {customVillages.length === 0 ? (
                    <DataTableEmpty colSpan={4} />
                  ) : (
                    customVillages.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{kv(row.tehsil)}</TableCell>
                        <TableCell className="font-medium">
                          {kv(row.name)}
                          <Badge
                            variant="outline"
                            className="ml-2 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-900"
                          >
                            Custom
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatPakistanDateTime(row.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-rose-200 text-rose-700"
                            disabled={actingId === row.id}
                            onClick={() => void removeVillage(row)}
                          >
                            {actingId === row.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Deactivate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </DataTableWrap>
          </DataListCard>

          <DataListCard
            loading={loadingCustom}
            count={customSettlements.length}
            title="Custom settlements"
          >
            <DataTableWrap>
              <Table>
                <DataTableHeader>
                  <DataTableHead>Tehsil</DataTableHead>
                  <DataTableHead>Village</DataTableHead>
                  <DataTableHead>Settlement</DataTableHead>
                  <DataTableHead>Added</DataTableHead>
                  <DataTableHead align="right">Actions</DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {customSettlements.length === 0 ? (
                    <DataTableEmpty colSpan={5} />
                  ) : (
                    customSettlements.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{kv(row.tehsil)}</TableCell>
                        <TableCell className="text-sm">{kv(row.village)}</TableCell>
                        <TableCell className="font-medium">
                          {kv(row.name)}
                          <Badge
                            variant="outline"
                            className="ml-2 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-900"
                          >
                            Custom
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatPakistanDateTime(row.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-rose-200 text-rose-700"
                            disabled={actingId === row.id}
                            onClick={() => void removeSettlement(row)}
                          >
                            {actingId === row.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Deactivate
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

        <TabsContent value="preview" className="mt-4">
          <DataListCard
            loading={catalogLoading}
            count={villageChoices.length}
            title={`Villages in ${tehsil || "—"}`}
          >
            <DataTableWrap>
              <Table>
                <DataTableHeader>
                  <DataTableHead>Village</DataTableHead>
                  <DataTableHead>Settlements</DataTableHead>
                </DataTableHeader>
                <TableBody>
                  {villageChoices.length === 0 ? (
                    <DataTableEmpty colSpan={2} />
                  ) : (
                    villageChoices.map((v) => {
                      const sets =
                        catalog.settlements_by_tehsil_village[tehsil]?.[v] ??
                        [];
                      return (
                        <TableRow key={v}>
                          <TableCell className="font-medium">{v}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sets.length
                              ? sets.join(" · ")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </DataTableWrap>
          </DataListCard>
        </TabsContent>
      </Tabs>

      <Dialog open={villageDialogOpen} onOpenChange={setVillageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add village</DialogTitle>
            <DialogDescription>
              New villages are available immediately for water/solar registration
              under the selected tehsil.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tehsil</Label>
              <Select value={tehsil} onValueChange={(v) => v && setTehsil(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {catalogTehsils.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-village-name">Village name</Label>
              <Input
                id="new-village-name"
                value={newVillageName}
                onChange={(e) => setNewVillageName(e.target.value)}
                placeholder="e.g. NEW VILLAGE NAME"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setVillageDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void submitVillage()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Add village
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settlementDialogOpen}
        onOpenChange={setSettlementDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add settlement</DialogTitle>
            <DialogDescription>
              Settlements must belong to an existing village in the catalog for
              that tehsil.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tehsil</Label>
              <Select
                value={tehsil}
                onValueChange={(v) => {
                  if (!v) return;
                  setTehsil(v);
                  setNewSettlementVillage("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {catalogTehsils.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Village</Label>
              <Select
                value={newSettlementVillage || undefined}
                onValueChange={(v) => v && setNewSettlementVillage(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select village" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {villageChoices.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-settlement-name">Settlement name</Label>
              <Input
                id="new-settlement-name"
                value={newSettlementName}
                onChange={(e) => setNewSettlementName(e.target.value)}
                placeholder="e.g. BASTI EXAMPLE"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setSettlementDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void submitSettlement()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Add settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
