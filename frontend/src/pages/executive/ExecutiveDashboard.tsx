import ProgramDashboard from "./ProgramDashboard";
import { roleDisplayLabel } from "../../constants/roles";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Manager Operations (SUPER_ADMIN) — HQ KPI for assigned review tehsils only.
 */
const ExecutiveDashboard = () => {
  const { user } = useAuth();
  const subtitle = roleDisplayLabel(user?.role);
  const tehsilCount = user?.tehsils?.length ?? 0;
  const scope =
    tehsilCount > 0
      ? `${tehsilCount} assigned tehsil${tehsilCount === 1 ? "" : "s"}.`
      : "No review tehsils assigned yet — contact your platform administrator.";

  return (
    <ProgramDashboard
      headingTitle="Operations overview"
      headingDescription={`${scope} Progress, logging readiness, and tehsil follow-up for your assigned area · ${subtitle}`}
      managementView
      mapPosition="top"
      showAnomalies={false}
    />
  );
};

export default ExecutiveDashboard;
