"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIsoDateString = toIsoDateString;
exports.toIsoDateTimeString = toIsoDateTimeString;
exports.getCalendarYear = getCalendarYear;
exports.getCalendarMonth = getCalendarMonth;
exports.getCalendarDay = getCalendarDay;
exports.toDateMs = toDateMs;
const date_transformer_1 = require("../../infrastructure/database/transformers/date.transformer");
function toIsoDateString(value) {
    const d = (0, date_transformer_1.parsePgDate)(value) ?? (0, date_transformer_1.parsePgTimestamp)(value);
    return d ? d.toISOString().slice(0, 10) : null;
}
function toIsoDateTimeString(value) {
    const d = (0, date_transformer_1.parsePgTimestamp)(value) ?? (0, date_transformer_1.parsePgDate)(value);
    return d ? d.toISOString() : null;
}
function getCalendarYear(value) {
    const d = (0, date_transformer_1.parsePgDate)(value) ?? (0, date_transformer_1.parsePgTimestamp)(value);
    return d ? d.getUTCFullYear() : null;
}
function getCalendarMonth(value) {
    const d = (0, date_transformer_1.parsePgDate)(value) ?? (0, date_transformer_1.parsePgTimestamp)(value);
    return d ? d.getUTCMonth() + 1 : null;
}
function getCalendarDay(value) {
    const d = (0, date_transformer_1.parsePgDate)(value) ?? (0, date_transformer_1.parsePgTimestamp)(value);
    return d ? d.getUTCDate() : null;
}
function toDateMs(value) {
    const d = (0, date_transformer_1.parsePgDate)(value) ?? (0, date_transformer_1.parsePgTimestamp)(value);
    return d ? d.getTime() : 0;
}
//# sourceMappingURL=date.util.js.map