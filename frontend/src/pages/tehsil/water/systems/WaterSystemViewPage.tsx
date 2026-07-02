import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Droplets, Gauge, Pencil } from "lucide-react";

import { kv, PageHeader, PageShell } from "../../../../components/layout";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import { tehsilRoutes } from "../../../../constants/routes";
import { getApiErrorMessage } from "../../../../lib/api-error";
import { getWaterSystem } from "../../../../services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "../../../../types/api";
import Toast from "../../../../components/Toast";
import { formatPakistanDateTime } from "../../../../utils/pakistanTime";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function WaterSystemViewPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const id = String(systemId || "").trim();

  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState<WaterSystemRow | null>(null);
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
        const res = (await getWaterSystem(id)) as WaterSystemRow;
        setSystem(res);
      } catch (e: unknown) {
        setToast({
          message: getApiErrorMessage(e, "Failed to load water system"),
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const title = system?.unique_identifier
    ? kv(system.unique_identifier)
    : "Water system";

  return (
    <PageShell>
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />
      <PageHeader
        icon={<Droplets />}
        title={loading ? "Water system" : title}
        description={
          system
            ? [system.tehsil, system.village, system.settlement].filter(Boolean).join(" · ")
            : "System details"
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(tehsilRoutes.waterSystems)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            {system?.unique_identifier ? (
              <Button
                size="sm"
                onClick={() =>
                  navigate(tehsilRoutes.waterFormEdit(system.unique_identifier || ""))
                }
              >
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
      ) : system ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{kv(system.unique_identifier)}</Badge>
            <Badge variant="outline">{kv(system.tehsil)}</Badge>
            <Badge variant="outline">{kv(system.village)}</Badge>
            {system.settlement ? (
              <Badge variant="outline">{kv(system.settlement)}</Badge>
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
                <DetailRow label="System ID" value={system.id} />
                <DetailRow label="UID" value={kv(system.unique_identifier)} />
                <DetailRow
                  label="Created"
                  value={formatPakistanDateTime(system.created_at)}
                />
                <DetailRow
                  label="Updated"
                  value={formatPakistanDateTime(system.updated_at)}
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
                <DetailRow
                  label="Bulk meter"
                  value={system.bulk_meter_installed ? "Yes" : "No"}
                />
                <DetailRow label="Pump model" value={kv(system.pump_model)} />
                <DetailRow label="Pump serial" value={kv(system.pump_serial_number)} />
                <DetailRow label="Flow rate" value={kv(system.pump_flow_rate)} />
                {system.bulk_meter_installed ? (
                  <>
                    <DetailRow label="Meter model" value={kv(system.meter_model)} />
                    <DetailRow
                      label="Meter serial"
                      value={kv(system.meter_serial_number)}
                    />
                    <DetailRow
                      label="Accuracy class"
                      value={kv(system.meter_accuracy_class)}
                    />
                    <DetailRow
                      label="Installation"
                      value={kv(system.installation_date)}
                    />
                  </>
                ) : (
                  <>
                    <DetailRow
                      label="Tank capacity"
                      value={kv(system.ohr_tank_capacity)}
                    />
                    <DetailRow
                      label="Fill required"
                      value={kv(system.ohr_fill_required)}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            System not found.
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
