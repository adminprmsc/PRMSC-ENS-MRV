"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PumpTimesService = void 0;
const common_1 = require("@nestjs/common");
const operator_helpers_service_1 = require("./operator-helpers.service");
let PumpTimesService = class PumpTimesService {
    operatorHelpers;
    constructor(operatorHelpers) {
        this.operatorHelpers = operatorHelpers;
    }
    parseTimeOfDay(value) {
        if (value == null) {
            return null;
        }
        if (typeof value === 'string') {
            const s = value.trim();
            if (!s) {
                return null;
            }
            for (const fmt of ['%H:%M:%S', '%H:%M']) {
                const match = fmt === '%H:%M:%S'
                    ? /^(\d{2}):(\d{2}):(\d{2})$/.exec(s)
                    : /^(\d{2}):(\d{2})$/.exec(s);
                if (match) {
                    if (fmt === '%H:%M') {
                        return `${match[1]}:${match[2]}:00`;
                    }
                    return s;
                }
            }
            try {
                const dt = new Date(s.replace('Z', '+00:00'));
                if (!Number.isNaN(dt.getTime())) {
                    const h = String(dt.getUTCHours()).padStart(2, '0');
                    const m = String(dt.getUTCMinutes()).padStart(2, '0');
                    const sec = String(dt.getUTCSeconds()).padStart(2, '0');
                    return `${h}:${m}:${sec}`;
                }
            }
            catch {
                return null;
            }
        }
        return null;
    }
    pumpHoursFromStartEnd(start, end) {
        const base = new Date('2000-01-01');
        const [sh, sm, ss] = start.split(':').map(Number);
        const [eh, em, es] = end.split(':').map(Number);
        const dtStart = new Date(base);
        dtStart.setHours(sh, sm, ss || 0, 0);
        const dtEnd = new Date(base);
        dtEnd.setHours(eh, em, es || 0, 0);
        if (dtEnd <= dtStart) {
            dtEnd.setDate(dtEnd.getDate() + 1);
        }
        return (dtEnd.getTime() - dtStart.getTime()) / (1000 * 3600);
    }
    timeToJson(t) {
        if (!t) {
            return null;
        }
        const parts = t.split(':');
        if (parts.length === 2) {
            return `${parts[0]}:${parts[1]}:00`;
        }
        return t;
    }
    applyPumpTimeFieldsFromPayload(record, data) {
        if ('pump_start_time' in data) {
            record.pumpStartTime = this.parseTimeOfDay(data.pump_start_time);
        }
        if ('pump_end_time' in data) {
            record.pumpEndTime = this.parseTimeOfDay(data.pump_end_time);
        }
        if (record.pumpStartTime && record.pumpEndTime) {
            record.pumpOperatingHours = this.pumpHoursFromStartEnd(record.pumpStartTime, record.pumpEndTime);
        }
        else if ('pump_operating_hours' in data) {
            record.pumpOperatingHours = this.operatorHelpers.coerceOptionalFloat(data.pump_operating_hours);
        }
    }
};
exports.PumpTimesService = PumpTimesService;
exports.PumpTimesService = PumpTimesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [operator_helpers_service_1.OperatorHelpersService])
], PumpTimesService);
//# sourceMappingURL=pump-times.service.js.map