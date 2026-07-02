import { ROLE, type UserRole } from "@/constants/roles";
import { tehsilRoutes } from "@/constants/routes";

export type TrainingCategoryId =
  | "getting-started"
  | "by-role"
  | "mobile"
  | "tasks"
  | "faqs";

export type GuideBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "tip"; text: string };

export type TrainingGuide = {
  slug: string;
  title: string;
  summary: string;
  readMinutes: number;
  category: TrainingCategoryId;
  /** When set, only these portal roles see this guide. Omit for all portal roles. */
  roles?: UserRole[];
  blocks: GuideBlock[];
};

export const TRAINING_CATEGORIES: {
  id: TrainingCategoryId;
  title: string;
  description: string;
}[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Platform overview and navigation basics.",
  },
  {
    id: "by-role",
    title: "By role",
    description: "What each role is responsible for in PRMSC MRV.",
  },
  {
    id: "mobile",
    title: "Mobile operator",
    description: "Field logging with the tubewell operator app.",
  },
  {
    id: "tasks",
    title: "Task guides",
    description: "Step-by-step workflows with links into the portal.",
  },
  {
    id: "faqs",
    title: "FAQs & troubleshooting",
    description: "Common issues and how to resolve them.",
  },
];

export const TRAINING_GUIDES: TrainingGuide[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Platform overview — roles, navigation, and daily workflow.",
    readMinutes: 5,
    category: "getting-started",
    blocks: [
      {
        type: "paragraph",
        text: "PRMSC MRV helps tehsil teams register water and solar assets, collect field readings, verify submissions, and monitor compliance across Punjab Rural Municipal Services.",
      },
      {
        type: "heading",
        text: "Who uses what",
      },
      {
        type: "list",
        items: [
          "Tehsil Manager Operator (web) — registers systems, reviews submissions, monitors anomalies and logging compliance.",
          "Manager Operations / HQ (web) — organization-wide KPIs, water and solar analysis.",
          "Platform Administrator (web) — user accounts and training video publishing.",
          "Tubewell operator (mobile app) — daily water readings and evidence photos in the field.",
        ],
      },
      {
        type: "heading",
        text: "Typical tehsil workflow",
      },
      {
        type: "steps",
        items: [
          "Register water systems and solar sites in your tehsil.",
          "Onboard tubewell operators and assign them to systems.",
          "Operators log daily readings on mobile; you review and verify submissions.",
          "Use logging compliance and anomalies views to follow up on missed days or unusual readings.",
        ],
      },
      {
        type: "tip",
        text: "Use the sidebar to jump between Water, Solar, Operators, and this Training Center. Your menu items depend on your assigned role.",
      },
    ],
  },
  {
    slug: "role-tehsil-manager",
    title: "Tehsil manager",
    summary: "Your main demo audience — day-to-day tehsil operations on the web portal.",
    readMinutes: 4,
    category: "by-role",
    roles: [ROLE.ADMIN],
    blocks: [
      {
        type: "paragraph",
        text: "As Tehsil Manager Operator you own facility registration, operator onboarding, submission verification, and compliance follow-up within your tehsil.",
      },
      {
        type: "heading",
        text: "Key areas in the portal",
      },
      {
        type: "list",
        items: [
          `Dashboard — quick view of tehsil activity (${tehsilRoutes.dashboard}).`,
          `Water systems — register and maintain tubewell assets (${tehsilRoutes.waterSystems}).`,
          `Submissions — open the verification queue (${tehsilRoutes.waterSubmissions}).`,
          `Logging compliance — see who has not logged (${tehsilRoutes.waterLoggingCompliance}).`,
          `Anomalies — investigate unusual consumption patterns (${tehsilRoutes.waterAlerts}).`,
          `Operators — onboard staff and manage assignments (${tehsilRoutes.onboardOperator}).`,
        ],
      },
      {
        type: "tip",
        text: "During demos, start from the dashboard, register one water system, then show a sample submission review — that sequence matches how tehsils adopt the platform.",
      },
    ],
  },
  {
    slug: "role-manager-operations",
    title: "Manager Operations (HQ)",
    summary: "Organization KPIs and cross-tehsil analysis for Manager Operations.",
    readMinutes: 3,
    category: "by-role",
    roles: [ROLE.SUPER_ADMIN],
    blocks: [
      {
        type: "paragraph",
        text: "Manager Operations users see organization-wide KPIs and can drill into water and solar analysis across assigned tehsils. You do not register facilities or verify daily tubewell submissions — that stays with tehsil managers.",
      },
      {
        type: "heading",
        text: "HQ navigation",
      },
      {
        type: "list",
        items: [
          "Organization KPI — high-level performance and systems map.",
          "Water analysis — tabular and drill-down views across tehsils.",
          "Solar analysis — monthly energy logging trends.",
          "Training videos — visible to Tehsil Managers and Manager Operations when published.",
        ],
      },
    ],
  },
  {
    slug: "role-platform-admin",
    title: "Platform administrator",
    summary: "User lifecycle and training video publishing.",
    readMinutes: 3,
    category: "by-role",
    roles: [ROLE.SYSTEM_ADMIN],
    blocks: [
      {
        type: "paragraph",
        text: "Platform Administrators manage portal user accounts and publish training videos (upload to Supabase or unlisted YouTube). Published videos are visible to Tehsil Managers and Manager Operations.",
      },
      {
        type: "heading",
        text: "Responsibilities",
      },
      {
        type: "list",
        items: [
          "Create and deactivate user accounts with the correct role and tehsil scope.",
          "Publish training videos from Training Center → Videos (upload MP4/WebM to Supabase or paste an unlisted YouTube link).",
          "Do not use this role for day-to-day tehsil data entry or submission verification.",
        ],
      },
      {
        type: "tip",
        text: "Upload videos as MP4/WebM/MOV (max 200 MB) to Supabase storage, or use YouTube as Unlisted and paste the share URL. Assign each video to Tehsil Managers, Manager Operations, or both before publishing.",
      },
    ],
  },
  {
    slug: "mobile-operator",
    title: "Mobile operator",
    summary: "How tubewell operators log readings — share this guide with field staff.",
    readMinutes: 4,
    category: "mobile",
    blocks: [
      {
        type: "paragraph",
        text: "Tubewell operators use the PRMSC mobile app (Android) — not this web portal. Tehsil managers onboard operators and assign water systems before operators can log.",
      },
      {
        type: "heading",
        text: "Operator checklist",
      },
      {
        type: "steps",
        items: [
          "Install the PRMSC operator APK provided by your tehsil or IT team.",
          "Sign in with the email and password created during onboarding.",
          "Select the assigned water system and enter meter readings for the day.",
          "Attach clear photos of the meter when prompted.",
          "Submit before end of day; sync when back on network if you were offline.",
        ],
      },
      {
        type: "heading",
        text: "Sharing this guide",
      },
      {
        type: "paragraph",
        text: "Use the QR code on this page to open this guide on an operator's phone, or share the page link during training sessions.",
      },
      {
        type: "tip",
        text: "If login fails on mobile, confirm the device can reach the API URL configured in the release build and that the operator account is active.",
      },
    ],
  },
  {
    slug: "register-water-system",
    title: "Register a water system",
    summary: "Add a new tubewell / water supply asset to your tehsil.",
    readMinutes: 6,
    category: "tasks",
    roles: [ROLE.ADMIN],
    blocks: [
      {
        type: "paragraph",
        text: "Water systems must exist in the portal before operators can be assigned and daily logging can begin.",
      },
      {
        type: "steps",
        items: [
          `Open Water → Water systems (${tehsilRoutes.waterSystems}).`,
          "Choose Add / register and complete location fields (tehsil, village, identifiers).",
          "Enter meter details and calibration information where applicable.",
          "Save the system and note the unique identifier — you will need it for operator assignment.",
          `Upload or link calibration certificates from ${tehsilRoutes.calibrationCertificates} if required.`,
        ],
      },
      {
        type: "tip",
        text: "After registration, assign the system to at least one tubewell operator under Operators → Assignments.",
      },
    ],
  },
  {
    slug: "review-verify-submission",
    title: "Review & verify a submission",
    summary: "Open the queue, check evidence, and verify or return submissions.",
    readMinutes: 5,
    category: "tasks",
    roles: [ROLE.ADMIN],
    blocks: [
      {
        type: "steps",
        items: [
          `Go to Water → Submissions (${tehsilRoutes.waterSubmissions}).`,
          "Open a pending record to view meter values, photos, and operator notes.",
          "Compare readings against recent history and calibration validity.",
          "Verify if complete and reasonable, or reject with a clear reason for the operator to resubmit.",
        ],
      },
      {
        type: "paragraph",
        text: "Verified submissions feed compliance and anomaly detection. Rejected submissions return to the operator's mobile app for correction.",
      },
    ],
  },
  {
    slug: "water-anomalies",
    title: "Water anomalies",
    summary: "Investigate unusual consumption or missing patterns.",
    readMinutes: 4,
    category: "tasks",
    roles: [ROLE.ADMIN],
    blocks: [
      {
        type: "paragraph",
        text: "The anomalies view highlights readings that deviate from expected patterns so tehsil staff can follow up before month-end reporting.",
      },
      {
        type: "steps",
        items: [
          `Open Water → Anomalies (${tehsilRoutes.waterAlerts}).`,
          "Filter by system or date range if available.",
          "Open the linked submission or system record for context.",
          "Contact the operator or inspect the site if readings look incorrect or evidence is missing.",
        ],
      },
    ],
  },
  {
    slug: "logging-compliance",
    title: "Logging compliance",
    summary: "Track daily water logging coverage across your tehsil.",
    readMinutes: 4,
    category: "tasks",
    roles: [ROLE.ADMIN],
    blocks: [
      {
        type: "paragraph",
        text: "Logging compliance shows which systems and operators have submitted for each calendar day, helping tehsil managers chase gaps early.",
      },
      {
        type: "steps",
        items: [
          `Navigate to Water → Logging compliance (${tehsilRoutes.waterLoggingCompliance}).`,
          "Review missing days per system or operator.",
          "Follow up with operators who have not submitted.",
          "Use solar logging compliance separately for monthly solar records.",
        ],
      },
    ],
  },
  {
    slug: "solar-monthly-logging",
    title: "Solar monthly logging",
    summary: "Record and review monthly solar energy data for registered sites.",
    readMinutes: 5,
    category: "tasks",
    roles: [ROLE.ADMIN],
    blocks: [
      {
        type: "steps",
        items: [
          `Register solar sites under Solar → Solar sites (${tehsilRoutes.solarSites}).`,
          `Add a monthly log via Solar monthly logging (${tehsilRoutes.solarMonthlyLogging}) or the solar energy data form.`,
          "Enter generation readings for the correct month — do not duplicate an existing month.",
          "Review entries from the solar compliance view when auditing tehsil coverage.",
        ],
      },
    ],
  },
  {
    slug: "faq-login",
    title: "Login issues",
    summary: "Cannot sign in to the web portal or mobile app.",
    readMinutes: 2,
    category: "faqs",
    blocks: [
      {
        type: "list",
        items: [
          "Confirm you are using the email address provisioned by your administrator.",
          "Check caps lock and re-enter your password; use Forgot password on the web login page if needed.",
          "Web portal access requires Tehsil Manager, Manager Operations, or Platform Administrator role — tubewell operators must use the mobile app.",
          "If your account was deactivated, contact your Platform Administrator.",
          "On mobile, ensure the device has network access to the production API endpoint.",
        ],
      },
    ],
  },
  {
    slug: "faq-upload-failed",
    title: "Upload failed",
    summary: "Photo or file upload errors during submission.",
    readMinutes: 2,
    category: "faqs",
    blocks: [
      {
        type: "list",
        items: [
          "Check internet connectivity and retry after a few seconds.",
          "Use JPG/PNG photos under the size limit; retake if the image is corrupted.",
          "On mobile, keep the app open until upload completes — switching away can interrupt temp files.",
          "If the error persists, note the time and water system ID and contact support — storage may be temporarily unavailable.",
        ],
      },
    ],
  },
  {
    slug: "faq-offline-sync",
    title: "Offline sync (mobile)",
    summary: "Logging when connectivity is poor and syncing later.",
    readMinutes: 3,
    category: "faqs",
    blocks: [
      {
        type: "paragraph",
        text: "Operators in low-coverage areas can complete forms offline where the app supports it; data syncs when the device reconnects.",
      },
      {
        type: "steps",
        items: [
          "Complete the daily log and save while offline if the app allows.",
          "Return to an area with mobile data or Wi‑Fi.",
          "Open the app and wait for sync indicators to clear.",
          "Ask your tehsil manager to confirm the submission appears in the verification queue.",
        ],
      },
      {
        type: "tip",
        text: "If sync never completes, force-close and reopen the app after confirming network access, then try again before re-entering duplicate readings.",
      },
    ],
  },
];

export function guideBySlug(slug: string): TrainingGuide | undefined {
  return TRAINING_GUIDES.find((g) => g.slug === slug);
}

export function guidesForRole(role: UserRole | undefined): TrainingGuide[] {
  if (!role) return [];
  return TRAINING_GUIDES.filter(
    (guide) => !guide.roles?.length || guide.roles.includes(role),
  );
}

export function guidesInCategory(
  category: TrainingCategoryId,
  role: UserRole | undefined,
): TrainingGuide[] {
  return guidesForRole(role).filter((g) => g.category === category);
}
