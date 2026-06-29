"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREDEFINED_TAHSILS = void 0;
exports.canonicalTehsil = canonicalTehsil;
exports.isValidTehsil = isValidTehsil;
exports.validateTehsilAssignments = validateTehsilAssignments;
exports.PREDEFINED_TAHSILS = [
    'AHMADPUR SIAL',
    'ALIPUR',
    'BAHAWALNAGAR',
    'BHOWANA',
    'DARYA KHAN',
    'ISA KHEL',
    'KALLAR KAHAR',
    'KAHROR PACCA',
    'KHAIRPUR TAMEWALI',
    'KOT MOMIN',
    'LIAQATPUR',
    'NOORPUR THAL',
    'PAKPATTAN',
    'ROJHAN',
    'SHUJABAD',
    'TAUNSA',
];
const PREDEFINED_UPPER = new Map(exports.PREDEFINED_TAHSILS.map((t) => [t.toUpperCase(), t]));
function canonicalTehsil(name) {
    if (!name || typeof name !== 'string') {
        return null;
    }
    return PREDEFINED_UPPER.get(name.trim().toUpperCase()) ?? null;
}
function isValidTehsil(name) {
    return canonicalTehsil(name) !== null;
}
function validateTehsilAssignments(tehsils) {
    if (!tehsils || !Array.isArray(tehsils)) {
        throw new Error('tehsils must be a non-empty list');
    }
    const out = [];
    const seen = new Set();
    for (const raw of tehsils) {
        const c = canonicalTehsil(raw != null ? String(raw).trim() : '');
        if (!c) {
            throw new Error(`Unknown or invalid tehsil: ${String(raw)}`);
        }
        if (!seen.has(c)) {
            seen.add(c);
            out.push(c);
        }
    }
    if (out.length === 0) {
        throw new Error('At least one valid tehsil is required');
    }
    return out;
}
//# sourceMappingURL=tehsils.js.map