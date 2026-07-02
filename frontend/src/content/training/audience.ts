import { ROLE, type UserRole } from "@/constants/roles";

/** Roles a training video can be assigned to (publish targeting). */
export const TRAINING_VIDEO_AUDIENCE_OPTIONS: {
  code: UserRole;
  label: string;
}[] = [
  { code: ROLE.ADMIN, label: "Tehsil Managers" },
  { code: ROLE.SUPER_ADMIN, label: "Manager Operations" },
];

export const DEFAULT_TRAINING_VIDEO_AUDIENCE: UserRole[] = [
  ROLE.ADMIN,
  ROLE.SUPER_ADMIN,
];

export function trainingAudienceLabel(code: string): string {
  return (
    TRAINING_VIDEO_AUDIENCE_OPTIONS.find((option) => option.code === code)
      ?.label ?? code
  );
}
