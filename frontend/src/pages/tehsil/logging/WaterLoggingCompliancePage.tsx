import { useCallback, useEffect, useState } from "react";
import { useId } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Droplets, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageShell } from "../../../components/layout";
import { tehsilRoutes } from "../../../constants/routes";
import { Button } from "../../../components/ui/button";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getWaterDailyLoggingRange,
  getWaterSystems,
} from "../../../services/tehsilManagerOperatorService";
import type {
  WaterDailyRangePayload,
  WaterSystemListItem,
} from "./loggingComplianceTypes";
import { downloadWaterComplianceExcel } from "./exportComplianceExcel";
import WaterLoggingComplianceSection from "./WaterLoggingComplianceSection";
import {
  getPakistanIsoDateString,
  subtractPakistanDays,
} from "../../../utils/pakistanTime";

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const dateTo = getPakistanIsoDateString();
  const dateFrom = subtractPakistanDays(dateTo, 13);
  return { dateFrom, dateTo };
}

export default function WaterLoggingCompliancePage() {
  const navigate = useNavigate();
  const baseId = useId();
  const panelId = `${baseId}-water-panel`;

  const [waterSystems, setWaterSystems] = useState<WaterSystemListItem[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [selectedWaterSystemId, setSelectedWaterSystemId] = useState("");
  const [{ dateFrom, dateTo }, setDateRange] = useState(defaultDateRange);
  const [rangeData, setRangeData] = useState<WaterDailyRangePayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const allDays = rangeData?.days ?? [];

  const loadSystems = useCallback(async () => {
    try {
      setSystemsLoading(true);
      const raw = await getWaterSystems();
      const list = Array.isArray(raw) ? (raw as WaterSystemListItem[]) : [];
      setWaterSystems(list);
      setSelectedWaterSystemId((prev) =>
        prev && list.some((s) => s.id === prev) ? prev : "",
      );
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load water systems"));
      setWaterSystems([]);
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  const loadRange = useCallback(async () => {
    if (!selectedWaterSystemId) {
      setRangeData(null);
      return;
    }
    try {
      setLoading(true);
      const raw = await getWaterDailyLoggingRange({
        water_system_id: selectedWaterSystemId,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setRangeData(raw);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Failed to load daily logging for this system"),
      );
      setRangeData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedWaterSystemId, dateFrom, dateTo]);

  useEffect(() => {
    void loadSystems();
  }, [loadSystems]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  return (
    <PageShell>
      <PageHeader
        icon={<Droplets />}
        title="Water logging compliance"
        description="Daily log status by system and date range"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(tehsilRoutes.loggingCompliance)}
            >
              <ExternalLink className="size-4" />
              Overview
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !rangeData || loading || !selectedWaterSystemId || allDays.length === 0
              }
              onClick={() => {
                if (!rangeData) return;
                downloadWaterComplianceExcel(rangeData, {
                  tableDays: allDays,
                });
              }}
            >
              <Download className="size-4" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || systemsLoading || !selectedWaterSystemId}
              onClick={() => void loadRange()}
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

      <WaterLoggingComplianceSection
        baseId={baseId}
        panelId={panelId}
        waterSystems={waterSystems}
        systemsLoading={systemsLoading}
        selectedWaterSystemId={selectedWaterSystemId}
        onSelectWaterSystem={setSelectedWaterSystemId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onRangeChange={(from, to) => setDateRange({ dateFrom: from, dateTo: to })}
        loading={loading}
        rangeData={rangeData}
      />
    </PageShell>
  );
}
