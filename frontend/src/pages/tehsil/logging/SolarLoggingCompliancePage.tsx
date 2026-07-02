import { useCallback, useEffect, useMemo, useState } from "react";
import { useId } from "react";
import { Download, ExternalLink, Loader2, RefreshCcw, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "../../../components/layout";
import { Button } from "../../../components/ui/button";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getSolarMonthlyYearRange,
  getSolarSystems,
} from "../../../services/tehsilManagerOperatorService";
import type {
  SolarMonthlyYearPayload,
  SolarSystemListItem,
} from "./loggingComplianceTypes";
import { downloadSolarComplianceExcel } from "./exportComplianceExcel";
import SolarLoggingComplianceSection from "./SolarLoggingComplianceSection";
import { getPakistanYear } from "../../../utils/pakistanTime";

export default function SolarLoggingCompliancePage() {
  const navigate = useNavigate();
  const baseId = useId();
  const panelId = `${baseId}-solar-panel`;

  const [solarSites, setSolarSites] = useState<SolarSystemListItem[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSolarSystemId, setSelectedSolarSystemId] = useState("");
  const [solarYear, setSolarYear] = useState(() => getPakistanYear());
  const [yearData, setYearData] = useState<SolarMonthlyYearPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => {
    const y = getPakistanYear();
    return Array.from({ length: 9 }, (_, i) => y - 4 + i);
  }, []);

  const loadSites = useCallback(async () => {
    try {
      setSitesLoading(true);
      const raw = await getSolarSystems();
      const list = Array.isArray(raw) ? (raw as SolarSystemListItem[]) : [];
      setSolarSites(list);
      setSelectedSolarSystemId((prev) =>
        prev && list.some((s) => s.id === prev) ? prev : "",
      );
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load solar sites"));
      setSolarSites([]);
    } finally {
      setSitesLoading(false);
    }
  }, []);

  const loadYear = useCallback(async () => {
    if (!selectedSolarSystemId) {
      setYearData(null);
      return;
    }
    try {
      setLoading(true);
      const raw = await getSolarMonthlyYearRange({
        solar_system_id: selectedSolarSystemId,
        year: solarYear,
      });
      setYearData(raw);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Failed to load monthly solar logging"),
      );
      setYearData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSolarSystemId, solarYear]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    void loadYear();
  }, [loadYear]);

  return (
    <PageShell>
      <PageHeader
        icon={<Sun />}
        title="Solar logging compliance"
        description="Monthly grid log status by site and year"
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
              disabled={!yearData || loading || !selectedSolarSystemId}
              onClick={() => {
                if (yearData) downloadSolarComplianceExcel(yearData);
              }}
            >
              <Download className="size-4" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || sitesLoading || !selectedSolarSystemId}
              onClick={() => void loadYear()}
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

      <SolarLoggingComplianceSection
        baseId={baseId}
        panelId={panelId}
        solarSites={solarSites}
        sitesLoading={sitesLoading}
        selectedSolarSystemId={selectedSolarSystemId}
        onSelectSolarSystem={setSelectedSolarSystemId}
        solarYear={solarYear}
        onSolarYearChange={setSolarYear}
        yearOptions={yearOptions}
        loading={loading}
        yearData={yearData}
      />
    </PageShell>
  );
}
