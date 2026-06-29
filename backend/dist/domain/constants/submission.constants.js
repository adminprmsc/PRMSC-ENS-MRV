"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeterType = exports.SubmissionStatus = exports.WATER_LOG_OPERATOR_EDITABLE = exports.METER_TYPE_SOLAR = exports.METER_TYPE_TUBEWELL = exports.SUBMISSION_STATUS_REVERTED_BACK = exports.SUBMISSION_STATUS_REJECTED = exports.SUBMISSION_STATUS_ACCEPTED = exports.SUBMISSION_STATUS_SUBMITTED = exports.SUBMISSION_STATUS_DRAFTED = void 0;
exports.normalizeWaterSubmissionStatus = normalizeWaterSubmissionStatus;
exports.SUBMISSION_STATUS_DRAFTED = 'drafted';
exports.SUBMISSION_STATUS_SUBMITTED = 'submitted';
exports.SUBMISSION_STATUS_ACCEPTED = 'accepted';
exports.SUBMISSION_STATUS_REJECTED = 'rejected';
exports.SUBMISSION_STATUS_REVERTED_BACK = 'reverted_back';
exports.METER_TYPE_TUBEWELL = 'tubewell';
exports.METER_TYPE_SOLAR = 'solar';
exports.WATER_LOG_OPERATOR_EDITABLE = new Set([
    exports.SUBMISSION_STATUS_DRAFTED,
    exports.SUBMISSION_STATUS_REVERTED_BACK,
]);
var SubmissionStatus;
(function (SubmissionStatus) {
    SubmissionStatus["DRAFTED"] = "drafted";
    SubmissionStatus["SUBMITTED"] = "submitted";
    SubmissionStatus["ACCEPTED"] = "accepted";
    SubmissionStatus["REJECTED"] = "rejected";
    SubmissionStatus["REVERTED_BACK"] = "reverted_back";
})(SubmissionStatus || (exports.SubmissionStatus = SubmissionStatus = {}));
var MeterType;
(function (MeterType) {
    MeterType["TUBEWELL"] = "tubewell";
    MeterType["SOLAR"] = "solar";
})(MeterType || (exports.MeterType = MeterType = {}));
function normalizeWaterSubmissionStatus(value) {
    if (value == null || (typeof value === 'string' && !value.trim())) {
        return exports.SUBMISSION_STATUS_DRAFTED;
    }
    const v = String(value).trim().toLowerCase();
    if (v === 'draft') {
        return exports.SUBMISSION_STATUS_DRAFTED;
    }
    const legacy = {
        under_review: exports.SUBMISSION_STATUS_SUBMITTED,
        verified: exports.SUBMISSION_STATUS_ACCEPTED,
        approved: exports.SUBMISSION_STATUS_ACCEPTED,
    };
    if (v in legacy) {
        return legacy[v];
    }
    const canon = {
        drafted: exports.SUBMISSION_STATUS_DRAFTED,
        submitted: exports.SUBMISSION_STATUS_SUBMITTED,
        accepted: exports.SUBMISSION_STATUS_ACCEPTED,
        rejected: exports.SUBMISSION_STATUS_REJECTED,
        reverted_back: exports.SUBMISSION_STATUS_REVERTED_BACK,
    };
    return canon[v] ?? String(value).trim();
}
//# sourceMappingURL=submission.constants.js.map