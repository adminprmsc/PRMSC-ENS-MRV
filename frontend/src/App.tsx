import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { Toaster } from "sonner";
import { AppLoading } from "./components/layout/AppLoading";

import {
  defaultPathForRole,
  EXECUTIVE_ROLES,
  PORTAL_ROLES,
  TEHSIL_MANAGER_ROLES,
  TRAINING_VIDEO_ROLES,
  USER_ADMIN_ROLES,
  isExecutiveRole,
  isTehsilManager,
} from "./constants/roles";
import OnboardOperator from "./pages/tehsil/onboarding/OnboardOperator";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";

import Login from "./pages/auth/Login";
import ForgotPasswordPage from "./pages/auth/ForgotPassword";
import ResetPasswordPage from "./pages/auth/ResetPassword";
import ChangePasswordPage from "./pages/account/ChangePassword";

import WaterSystemForm from "./pages/tehsil/water/WaterSystemForm";
import WaterSystemEditPage from "./pages/tehsil/water/systems/WaterSystemEditPage";
import WaterSystemViewPage from "./pages/tehsil/water/systems/WaterSystemViewPage";
import WaterSystems from "./pages/tehsil/water/WaterSystems";
import WaterAlertsPage from "./pages/tehsil/water/WaterAlertsPage";
import CalibrationCertificates from "./pages/tehsil/water/CalibrationCertificates";
import SolarSites from "./pages/tehsil/solar/SolarSites";
import SolarSystemForm from "./pages/tehsil/solar/SolarSystemForm";
import SolarSiteEditPage from "./pages/tehsil/solar/sites/SolarSiteEditPage";
import SolarSiteViewPage from "./pages/tehsil/solar/sites/SolarSiteViewPage";
import SolarMonthlyLogging from "./pages/tehsil/solar/monthly-logging/SolarMonthlyLogging";
import SolarMonthlyLogEditPage from "./pages/tehsil/solar/monthly-logging/SolarMonthlyLogEditPage";
import SolarSupplyDataForm from "./pages/tehsil/solar/SolarSupplyDataForm";
import TubewellSubmissionsHub from "./pages/tehsil/submissions/TubewellSubmissionsHub";
import WaterSubmissionDetailsPage from "./pages/tehsil/submissions/WaterSubmissionDetailsPage";

import ExecutiveDashboard from "./pages/executive/ExecutiveDashboard";
import ExecutiveSitesProgress from "./pages/executive/ExecutiveSitesProgress";
import ExecutiveAttentionPage from "./pages/executive/ExecutiveAttentionPage";
import ExecutiveWaterAnalysis from "./pages/executive/ExecutiveWaterAnalysis";
import ExecutiveSolarAnalysis from "./pages/executive/ExecutiveSolarAnalysis";
import HqSolarRecordViewPage from "./pages/executive/HqSolarRecordViewPage";
import HqWaterSystemDetailPage from "./pages/executive/HqWaterSystemDetailPage";
import HqSolarSiteDetailPage from "./pages/executive/HqSolarSiteDetailPage";
import TehsilManagerDashboard from "./pages/tehsil/dashboard/TehsilManagerDashboard";
import LoggingCompliance from "./pages/tehsil/logging/LoggingCompliance";
import SolarLoggingCompliancePage from "./pages/tehsil/logging/SolarLoggingCompliancePage";
import WaterLoggingCompliancePage from "./pages/tehsil/logging/WaterLoggingCompliancePage";
import WaterOperatorAssignments from "./pages/tehsil/operators/WaterOperatorAssignments";

import SubmissionsAudit from "./pages/verification/VerificationDashboard";
import SubmissionReview from "./pages/verification/SubmissionReview";
import UsersAdminPage from "./pages/admin/UsersAdminPage";
import TrainingLayout from "./pages/training/TrainingLayout";
import { TrainingHub } from "./pages/training/TrainingHub";
import TrainingGuidePage from "./pages/training/TrainingGuidePage";
import TrainingVideosPage from "./pages/training/TrainingVideosPage";
import { adminRoutes, tehsilRoutes, trainingRoutes } from "./constants/routes";

const VerificationsRedirect = () => {
  const { user } = useAuth();
  const role = user?.role ?? null;
  const target = isTehsilManager(role)
    ? tehsilRoutes.waterSubmissions
    : isExecutiveRole(role)
      ? "/hq"
      : "/submissions";
  return <Navigate to={target} replace />;
};

/** Legacy bookmarked URLs: `/operator/solar-energy-data/:id` → tehsil edit route */
const LegacyOperatorSolarRecordRedirect = () => {
  const { recordId } = useParams();
  return (
    <Navigate to={`/tehsil/solar-energy-data/${recordId ?? ""}`} replace />
  );
};

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: string[];
};

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <AppLoading />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={defaultPathForRole(user.role)} replace />;
  }
  return <>{children}</>;
};

function PortalHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultPathForRole(user.role)} replace />;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultPathForRole(user.role)} replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />

          <Route path="/" element={<RootRedirect />} />

          <Route element={<MainLayout />}>
            <Route
              path="/account/change-password"
              element={
                <ProtectedRoute allowedRoles={[...PORTAL_ROLES]}>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />

            <Route
              path={trainingRoutes.hub}
              element={
                <ProtectedRoute allowedRoles={[...PORTAL_ROLES]}>
                  <TrainingLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TrainingHub />} />
              <Route path="guides/:slug" element={<TrainingGuidePage />} />
              <Route
                path="videos"
                element={
                  <ProtectedRoute allowedRoles={[...TRAINING_VIDEO_ROLES]}>
                    <TrainingVideosPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route
              path={adminRoutes.users}
              element={
                <ProtectedRoute allowedRoles={[...USER_ADMIN_ROLES]}>
                  <UsersAdminPage />
                </ProtectedRoute>
              }
            />
            {/* MRV COO & Manager Operations — org KPI only */}
            <Route
              path="/hq"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <ExecutiveDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/sites"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <ExecutiveSitesProgress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/attention"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <ExecutiveAttentionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/water"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <ExecutiveWaterAnalysis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/solar"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <ExecutiveSolarAnalysis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/water-systems/:id"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <HqWaterSystemDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/solar-sites/:id"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <HqSolarSiteDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/submissions/:id"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <WaterSubmissionDetailsPage readOnly />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hq/solar-records/:id"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <HqSolarRecordViewPage />
                </ProtectedRoute>
              }
            />

            {/* Tehsil Manager Operator */}
            <Route
              path="/tehsil"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <TehsilManagerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/onboard-operator"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <OnboardOperator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/onboard-operator"
              element={<Navigate to="/tehsil/onboard-operator" replace />}
            />

            <Route
              path="/tehsil/operator-assignments"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterOperatorAssignments />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/water-systems"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSystems />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/water-systems/:systemId/view"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSystemViewPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/calibration-certificates"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <CalibrationCertificates />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/submissions/:id/details"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSubmissionDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/submissions"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <TubewellSubmissionsHub />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/water-form"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSystemForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/water-form/:waterSystemKey/edit"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSystemEditPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/water-alerts"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterAlertsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-sites"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/solar-sites/:systemId/view"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSiteViewPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-sites/:systemId/edit"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSiteEditPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-monthly-logging/:recordId/edit"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarMonthlyLogEditPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-monthly-logging"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarMonthlyLogging />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/logging-compliance"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <LoggingCompliance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/logging-compliance/water"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterLoggingCompliancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/logging-compliance/solar"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarLoggingCompliancePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-form"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSystemForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-energy-data/add"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSupplyDataForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/solar-energy-data/:recordId"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSupplyDataForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/solar-energy-data"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSupplyDataForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/review/:id"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />

            {/* Submissions & verification — tehsil managers only; HQ uses water/solar drill-down */}
            <Route path="/verification" element={<VerificationsRedirect />} />
            <Route
              path="/verification/review/:id"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />

            <Route
              path="/submissions"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SubmissionsAudit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submissions/review/:id"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />

            <Route path="/verifications" element={<VerificationsRedirect />} />

            {/* Legacy analyst paths → executive KPI home */}
            <Route path="/analyst" element={<Navigate to="/hq" replace />} />
            <Route path="/analyst/*" element={<Navigate to="/hq" replace />} />

            {/* Legacy operator URLs */}
            <Route path="/operator" element={<PortalHomeRedirect />} />
            <Route
              path="/operator/water-form"
              element={<Navigate to="/tehsil/water-form" replace />}
            />
            <Route
              path="/operator/solar-form"
              element={<Navigate to="/tehsil/solar-form" replace />}
            />
            <Route
              path="/operator/solar-data"
              element={<Navigate to="/tehsil/solar-energy-data" replace />}
            />
            <Route
              path="/operator/solar-energy-data/:recordId"
              element={<LegacyOperatorSolarRecordRedirect />}
            />
            <Route
              path="/operator/solar-energy-data"
              element={<Navigate to="/tehsil/solar-energy-data" replace />}
            />
            <Route
              path="/operator/solar-drafts"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/solar-submissions"
              element={<Navigate to="/tehsil/submissions" replace />}
            />
            <Route
              path="/operator/review/:id"
              element={<Navigate to="/tehsil/review/:id" replace />}
            />
            <Route
              path="/operator/water-data"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/water-supply-data"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/water-drafts"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/water-submissions"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/mvr-data-entry"
              element={<Navigate to="/tehsil" replace />}
            />

            <Route
              path="/view-submission"
              element={
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-slate-700">
                  <h1 className="text-lg font-semibold text-slate-900">
                    View submission
                  </h1>
                  <p className="mt-2 text-sm">
                    Open a record from Tehsil submissions.
                  </p>
                </div>
              }
            />
          </Route>
        </Routes>
        <Toaster richColors position="top-right" />
      </Router>
    </AuthProvider>
  );
}

export default App;
