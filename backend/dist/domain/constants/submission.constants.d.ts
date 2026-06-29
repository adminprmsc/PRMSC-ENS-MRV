export declare const SUBMISSION_STATUS_DRAFTED = "drafted";
export declare const SUBMISSION_STATUS_SUBMITTED = "submitted";
export declare const SUBMISSION_STATUS_ACCEPTED = "accepted";
export declare const SUBMISSION_STATUS_REJECTED = "rejected";
export declare const SUBMISSION_STATUS_REVERTED_BACK = "reverted_back";
export declare const METER_TYPE_TUBEWELL = "tubewell";
export declare const METER_TYPE_SOLAR = "solar";
export declare const WATER_LOG_OPERATOR_EDITABLE: ReadonlySet<string>;
export declare enum SubmissionStatus {
    DRAFTED = "drafted",
    SUBMITTED = "submitted",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    REVERTED_BACK = "reverted_back"
}
export declare enum MeterType {
    TUBEWELL = "tubewell",
    SOLAR = "solar"
}
export declare function normalizeWaterSubmissionStatus(value: string | null | undefined): string;
