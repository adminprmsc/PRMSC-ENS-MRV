"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timestampColumnTransformer = exports.dateColumnTransformer = void 0;
exports.parsePgDate = parsePgDate;
exports.parsePgTimestamp = parsePgTimestamp;
function parsePgDate(value) {
    if (value == null) {
        return null;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
            ? new Date(`${trimmed}T00:00:00.000Z`)
            : new Date(trimmed);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}
exports.dateColumnTransformer = {
    to: (value) => {
        if (value == null) {
            return null;
        }
        if (value instanceof Date) {
            return value.toISOString().slice(0, 10);
        }
        return String(value).slice(0, 10);
    },
    from: (value) => parsePgDate(value),
};
function parsePgTimestamp(value) {
    if (value == null) {
        return null;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}
exports.timestampColumnTransformer = {
    to: (value) => value ?? null,
    from: (value) => parsePgTimestamp(value),
};
//# sourceMappingURL=date.transformer.js.map