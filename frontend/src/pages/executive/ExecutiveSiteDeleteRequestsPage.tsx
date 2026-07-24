import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import {
  DataListCard,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableWrap,
  kv,
  PageHeader,
  PageShell,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  approveSiteDeleteRequest,
  listSiteDeleteRequests,
  rejectSiteDeleteRequest,
  type SiteDeleteRequestRow,
} from "@/services/tehsilManagerOperatorService";
import { formatPakistanDateTime } from "@/utils/pakistanTime";

export default function ExecutiveSiteDeleteRequestsPage() {
  const [rows, setRows] = useState<SiteDeleteRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSiteDeleteRequests("pending");
      setRows(Array.isArray(data.requests) ? data.requests : []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load delete requests"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (row: SiteDeleteRequestRow) => {
    setActingId(row.id);
    try {
      await approveSiteDeleteRequest(row.id);
      toast.success(`Deleted ${row.unique_identifier}`);
      await load();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Approve failed"));
    } finally {
      setActingId(null);
    }
  };

  const reject = async (row: SiteDeleteRequestRow) => {
    setActingId(row.id);
    try {
      await rejectSiteDeleteRequest(row.id);
      toast.success(`Rejected delete for ${row.unique_identifier}`);
      await load();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Reject failed"));
    } finally {
      setActingId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={<ShieldAlert className="text-rose-600" />}
        title="Site delete requests"
        description={`${rows.length} pending · Approve only for tehsils assigned to you. Approval permanently removes the site and related submissions.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Refresh
          </Button>
        }
      />

      <DataListCard loading={loading} count={rows.length} title="Pending">
        <DataTableWrap>
          <Table>
            <DataTableHeader>
              <DataTableHead>Type</DataTableHead>
              <DataTableHead>UID</DataTableHead>
              <DataTableHead>Location</DataTableHead>
              <DataTableHead>Reason</DataTableHead>
              <DataTableHead>Requested</DataTableHead>
              <DataTableHead align="right">Actions</DataTableHead>
            </DataTableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <DataTableEmpty colSpan={6} />
              ) : (
                rows.map((row) => {
                  const busy = actingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.resource_type === "water"
                              ? "border-sky-200 bg-sky-50 text-sky-900"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                          }
                        >
                          {row.resource_type === "water" ? "Water" : "Solar"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {kv(row.unique_identifier)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{kv(row.village)}</p>
                        <p className="text-xs text-muted-foreground">
                          {kv(row.tehsil)}
                          {row.settlement ? ` · ${row.settlement}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="whitespace-pre-wrap text-sm text-slate-800">
                          {kv(row.request_reason)}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatPakistanDateTime(row.requested_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                            disabled={busy}
                            onClick={() => void reject(row)}
                          >
                            {busy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <X className="size-3.5" />
                            )}
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1 bg-rose-700 text-white hover:bg-rose-800"
                            disabled={busy}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Approve deletion of ${row.unique_identifier}? This permanently removes the site and all related submissions.`,
                                )
                              ) {
                                return;
                              }
                              void approve(row);
                            }}
                          >
                            {busy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                            Approve & delete
                          </Button>
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
    </PageShell>
  );
}
