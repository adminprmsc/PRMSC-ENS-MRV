/**
 * Backfill water_energy_logging_daily meter columns from legacy cumulative readings.
 *
 * Usage:
 *   npm run script:backfill-water-meter
 *   npm run script:backfill-water-meter -- --apply
 *   npm run script:backfill-water-meter -- --apply --system-id <uuid>
 *   npm run script:backfill-water-meter -- --verbose
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  MeterCorrection,
  WaterMeterBackfillService,
} from '../application/services/water-meter-backfill.service';

function fmt(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return Number(value).toPrecision(4);
}

function parseArgs(argv: string[]) {
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

function printCorrection(row: MeterCorrection): void {
  console.log(
    `\nlog ${row.logId}  system ${row.waterSystemId}  date ${row.logDate ?? '—'}`,
  );
  console.log(`  note: ${row.note}`);
  console.log(
    `  start: ${fmt(row.oldMeterReadingStart)} → ${fmt(row.newMeterReadingStart)}`,
  );
  console.log(
    `  end:   ${fmt(row.oldMeterReadingEnd)} → ${fmt(row.newMeterReadingEnd)}`,
  );
  console.log(
    `  total: ${fmt(row.oldTotalWaterPumped)} → ${fmt(row.newTotalWaterPumped)} m³`,
  );
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const backfill = app.get(WaterMeterBackfillService);
    const { corrections, issues } = await backfill.planMeterCorrections(
      args.systemId,
    );

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
        console.log(
          `  log ${issue.logId} (${issue.logDate ?? '—'}): ${issue.message}`,
        );
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
  } finally {
    await app.close();
  }
}

main().then((code) => process.exit(code));
