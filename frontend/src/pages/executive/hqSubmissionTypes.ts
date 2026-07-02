export type HqSubmissionRow = {
  id: string;
  submission_type: string;
  status: string;
  operator_name?: string;
  operator_email?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  remarks?: string | null;
  system_info?: {
    id?: string;
    uid?: string;
    village?: string;
    tehsil?: string;
    year?: number;
    month?: number;
    pump_operating_hours?: number | null;
    total_water_pumped?: number | null;
  };
};

export type HqSubmissionScope = {
  year?: number;
  month?: number;
};
