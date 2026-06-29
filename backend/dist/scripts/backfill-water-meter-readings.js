"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const water_meter_backfill_service_1 = require("../application/services/water-meter-backfill.service");
function fmt(value) {
    if (value == null) {
        return '—';
    }
    return Number(value).toPrecision(4);
}
function parseArgs(argv) {
    return {
        apply: argv.includes('--apply'),
        verbose: argv.includes('--verbose'),
        systemId: (() => {
            const idx = argv.indexOf('--system-id');
            if (idx >= 0 && argv[idx + 1]) {
                return argv[idx + 1];
            }
            return null;
        })(),
    };
}
function printCorrection(row) {
    console.log(`\nlog ${row.logId}  system ${row.waterSystemId}  date ${row.logDate ?? '—'}`);
    console.log(`  note: ${row.note}`);
    console.log(`  start: ${fmt(row.oldMeterReadingStart)} → ${fmt(row.newMeterReadingStart)}`);
    console.log(`  end:   ${fmt(row.oldMeterReadingEnd)} → ${fmt(row.newMeterReadingEnd)}`);
    console.log(`  total: ${fmt(row.oldTotalWaterPumped)} → ${fmt(row.newTotalWaterPumped)} m³`);
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    try {
        const backfill = app.get(water_meter_backfill_service_1.WaterMeterBackfillService);
        const { corrections, issues } = await backfill.planMeterCorrections(args.systemId);
        console.log(`Planned row updates: ${corrections.length}`);
        console.log(`Issues (skipped rows): ${issues.length}`);
        if (args.verbose && corrections.length > 0) {
            console.log('\n--- Planned corrections ---');
            for (const row of corrections) {
                printCorrection(row);
            }
        }
        if (issues.length > 0) {
            console.log('\n--- Issues ---');
            for (const issue of issues.slice(0, 50)) {
                console.log(`  log ${issue.logId} (${issue.logDate ?? '—'}): ${issue.message}`);
            }
            if (issues.length > 50) {
                console.log(`  … and ${issues.length - 50} more`);
            }
        }
        if (!args.apply) {
            if (corrections.length > 0) {
                console.log('\nDry run only — re-run with --apply to persist changes.');
            }
            return 0;
        }
        if (corrections.length === 0) {
            console.log('\nNothing to update.');
            return 0;
        }
        const updated = await backfill.applyMeterCorrections(corrections);
        console.log(`\nApplied ${updated} row update(s).`);
        return 0;
    }
    finally {
        await app.close();
    }
}
main().then((code) => process.exit(code));
//# sourceMappingURL=backfill-water-meter-readings.js.map