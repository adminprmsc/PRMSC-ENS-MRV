import ProgramDashboard from "./ProgramDashboard";
import { roleDisplayLabel } from "../../constants/roles";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Manager Operations (SUPER_ADMIN) — HQ Command Center for assigned review tehsils.
 */
const ExecutiveDashboard = () => {
  const { user } = useAuth();
  const subtitle = roleDisplayLabel(user?.role);
  const tehsilCount = user?.tehsils?.length ?? 0;
  const scope =
    tehsilCount > 0
      ? `${tehsilCount} tehsil${tehsilCount === 1 ? "" : "s"} assigned`
      : "No tehsils assigned";

  return (
    <ProgramDashboard
      headingTitle="Command Center"
      headingDescription={`${scope} · ${subtitle}`}
      managementView
      mapPosition="top"
      showAnomalies={false}
    />
  );
};

export default ExecutiveDashboard;
