import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Gauge, Pencil, Sun } from "lucide-react";

import { kv, PageHeader, PageShell } from "../../../../components/layout";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import { tehsilRoutes } from "../../../../constants/routes";
import { getApiErrorMessage } from "../../../../lib/api-error";
import { getSolarSystem } from "../../../../services/tehsilManagerOperatorService";
import type { SolarSystemRow } from "../../../../types/api";
import Toast from "../../../../components/Toast";
import { formatPakistanDateTime } from "../../../../utils/pakistanTime";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

export default function SolarSiteViewPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const id = String(systemId || "").trim();

  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<SolarSystemRow | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" }>({
    message: "",
    type: "success",
  });

  useEffect(() => {
    const run = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const res = (await getSolarSystem(id)) as SolarSystemRow;
        setSite(res);
      } catch (e: unknown) {
        setToast({
          message: getApiErrorMessage(e, "Failed to load solar site"),
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const title = site?.unique_identifier ? kv(site.unique_identifier) : "Solar site";

  return (
    <PageShell>
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />
      <PageHeader
        icon={<Sun />}
        title={loading ? "Solar site" : title}
        description={
          site
            ? [site.tehsil, site.village, site.settlement].filter(Boolean).join(" · ")
            : "Site details"
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(tehsilRoutes.solarSites)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            {site ? (
              <Button size="sm" onClick={() => navigate(tehsilRoutes.solarSiteEdit(site.id))}>
                <Pencil className="size-4" />
                Edit
              </Button>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="space-y-3 pt-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : site ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{kv(site.unique_identifier)}</Badge>
            <Badge variant="outline">{kv(site.tehsil)}</Badge>
            <Badge variant="outline">{kv(site.village)}</Badge>
            {site.settlement ? (
              <Badge variant="outline">{kv(site.settlement)}</Badge>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4 text-muted-foreground" />
                  Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                <DetailRow label="System ID" value={site.id} />
                <DetailRow label="UID" value={kv(site.unique_identifier)} />
                <DetailRow
                  label="Created"
                  value={formatPakistanDateTime(site.created_at)}
                />
                <DetailRow
                  label="Updated"
                  value={formatPakistanDateTime(site.updated_at)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="size-4 text-muted-foreground" />
                  Technical
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                <DetailRow label="Location" value={kv(site.installation_location)} />
                <DetailRow label="DISCO" value={kv(site.disco_info)} />
                <DetailRow label="Bill ref" value={kv(site.bill_reference_number)} />
                <DetailRow label="Panel (kW)" value={kv(site.solar_panel_capacity)} />
                <DetailRow label="Inverter" value={kv(site.inverter_capacity)} />
                <DetailRow label="Inverter serial" value={kv(site.inverter_serial_number)} />
                <DetailRow
                  label="Connected"
                  value={kv(site.solar_connection_date ?? site.installation_date)}
                />
                <DetailRow label="Meter model" value={kv(site.meter_model)} />
                <DetailRow label="Meter serial" value={kv(site.meter_serial_number)} />
                <DetailRow label="Monthly logs" value={kv(site.monthly_log_count)} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Site not found.
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
