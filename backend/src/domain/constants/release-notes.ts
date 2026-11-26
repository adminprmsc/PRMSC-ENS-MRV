/**
 * Release notes — the "What's new" catalog.
 *
 * HOW TO PUBLISH A RELEASE NOTE
 *  1. Add an entry at the TOP of RELEASE_NOTES in the same change as the
 *     feature (so the note is reviewed and versioned with the code).
 *  2. `id` must be unique and never change (per-user read/dismiss state and
 *     bell notifications are keyed on it).
 *  3. `date` is the go-live day (Pakistan, YYYY-MM-DD). For `announceDays`
 *     (default 30) after it, matching roles see a banner + bell notification.
 *     After that the note stays in "What's new" permanently.
 *  4. Write `training` as steps a user can follow in the portal, and list any
 *     change to reported numbers in `numbersChange`.
 */

import { ADMIN, SUPER_ADMIN, SYSTEM_ADMIN } from './roles';

export type ReleaseCategory = 'feature' | 'enhancement' | 'fix';

export type ReleaseNote = {
  id: string;
  version: string;
  date: string;
  title: string;
  category: ReleaseCategory;
  /** Role codes that see this note. */
  audiences: readonly string[];
  summary: string;
  /** What is new, in plain words. */
  highlights: readonly string[];
  /** Step-by-step training, per task. */
  training: ReadonlyArray<{ title: string; steps: readonly string[] }>;
  /** How reported figures may differ after this release (if any). */
  numbersChange?: readonly string[];
  /** Where to try it, per role (portal route). */
  links?: Partial<Record<string, { label: string; path: string }>>;
  announceDays?: number;
};

export const DEFAULT_ANNOUNCE_DAYS = 30;

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: '2026-11-water-bulk-meter-source',
    version: '2026.11.3',
    date: '2026-11-26',
    title: 'Water: bulk meter vs pump-hours — one source per log',
    category: 'enhancement',
    audiences: [ADMIN, SUPER_ADMIN],
    summary:
      'Each water system now has a "Bulk meter readings start" date and time. Logs before it are calculated from pump hours; logs from it onward use only the bulk meter. No log is ever counted twice.',
    highlights: [
      'New "Bulk meter readings start" (date + time) on the water system form.',
      'Water analysis shows which source was used: Bulk meter, Estimated, or Mixed.',
      'New "Data source" switch on Water analysis: All sources / Bulk meter only / Estimate only — the Excel export follows it.',
      '"Logs missing reading" flags logs after the start that have no meter reading.',
      'The system refuses a start date that would make existing meter readings be ignored.',
    ],
    training: [
      {
        title: 'Set when a site’s bulk meter started (Tehsil Manager)',
        steps: [
          'Go to Water → Water systems and open the site → Edit.',
          'Under "Bulk meter installed: Yes", fill "Bulk meter readings start" with the date and time the meter began recording.',
          'Optional: enter Design and Actual time to fill tank so days before the meter can be estimated.',
          'Save. If existing meter readings fall before your start, the save is refused and the readings are listed — choose an earlier start.',
          'Leave the start blank to use the first meter reading automatically.',
        ],
      },
      {
        title: 'Read and export by source (Manager Operations)',
        steps: [
          'Open Analysis → Water analysis and pick tehsil / period.',
          'Use "Data source" at the top: Bulk meter only shows meter data from each site’s start; Estimate only shows pump-hour calculations.',
          'Check "Volume source" and "Bulk meter since" (auto = taken from the first meter reading).',
          'Click Export — the file contains only the source you selected.',
        ],
      },
    ],
    numbersChange: [
      'Meter averages now use only metered hours and days, so they are higher (more accurate) than before at sites with older hours-only logs.',
      'Days before a site’s bulk meter start are now estimated from pump hours instead of showing zero.',
      'No stored readings or logs were changed — only how totals are calculated.',
    ],
    links: {
      [ADMIN]: { label: 'Open Water systems', path: '/tehsil/water-systems' },
      [SUPER_ADMIN]: { label: 'Open Water analysis', path: '/hq/water' },
    },
  },
  {
    id: '2026-11-solar-before-green-meter',
    version: '2026.11.2',
    date: '2026-11-24',
    title: 'Solar: log months before the green meter',
    category: 'feature',
    audiences: [ADMIN, SUPER_ADMIN],
    summary:
      'Back-date solar bills from before the green meter was installed. Only units consumed (peak and off-peak) are entered — nothing was exported then — and HQ compares this baseline with the green-meter months.',
    highlights: [
      'New log type on monthly solar logs: "Before green meter" (units consumed only).',
      'Allowed months are decided by the site’s green meter connection date.',
      'Monthly logging list: log-type badge, filter, and "All years".',
      'HQ Solar analysis: "Before green meter / mo" and "Grid draw vs baseline" columns (hover ⓘ for meaning).',
    ],
    training: [
      {
        title: 'Back-date a bill (Tehsil Manager)',
        steps: [
          'Go to Solar → Monthly logging → Add log and choose the site.',
          'Pick a year and month before the green meter date — "Before green meter" is selected automatically.',
          'Enter Units consumed — peak and Units consumed — off-peak from the bill (0 is allowed). Attach the bill and save.',
          'For the month the green meter was connected you can choose either type. After it, only "Green meter" is allowed.',
        ],
      },
      {
        title: 'Read the baseline (Manager Operations)',
        steps: [
          'Open Analysis → Solar analysis and choose All years to include old bills.',
          '"Before green meter / mo" is the average monthly consumption before the green meter.',
          '"Grid draw vs baseline": ▼ green = less grid electricity than before; ▲ red = more.',
          'Open a site for the month-by-month records and the "Green meter & baseline" card.',
        ],
      },
    ],
    numbersChange: [
      'Grid import totals count green-meter months only; before-green-meter consumption is reported separately as a baseline.',
    ],
    links: {
      [ADMIN]: {
        label: 'Open Monthly logging',
        path: '/tehsil/solar-monthly-logging',
      },
      [SUPER_ADMIN]: { label: 'Open Solar analysis', path: '/hq/solar' },
    },
  },
  {
    id: '2026-11-geography-population',
    version: '2026.11.1',
    date: '2026-11-23',
    title: 'Geography & population',
    category: 'feature',
    audiences: [ADMIN, SUPER_ADMIN, SYSTEM_ADMIN],
    summary:
      'Record the population of every village and settlement in your tehsils. Totals roll up to tehsils and appear on the dashboards, with how many people each water site serves.',
    highlights: [
      'New Geography page: villages and settlements with +/- population counters.',
      'Served-by-water-site figures for every village and settlement.',
      'Dashboards: population, people served, water per person, and a population layer on the map.',
      'Every population change is recorded in the change log.',
    ],
    training: [
      {
        title: 'Enter population',
        steps: [
          'Open Geography from the sidebar and pick a tehsil.',
          'Use the − / + counter (choose the step: 1, 10, 100, 1000) or type the number.',
          'Expand a village to enter its settlements. Village total = main abadi + settlements.',
          'Click Save (or Ctrl/⌘ + S). Changes are listed under the Change log tab.',
        ],
      },
      {
        title: 'Read coverage',
        steps: [
          'The "Served by water sites" column shows people covered by a registered water site.',
          'A site in a settlement serves that settlement; a village-level site serves the main abadi and settlements without their own site.',
          'Use the status filter to find villages that still need a count or have no water site.',
        ],
      },
    ],
    links: {
      [ADMIN]: { label: 'Open Geography', path: '/tehsil/geography' },
      [SUPER_ADMIN]: { label: 'Open Geography', path: '/hq/geography' },
      [SYSTEM_ADMIN]: { label: 'Open Geography', path: '/admin/geography' },
    },
  },
];

const DAY_MS = 86_400_000;

/** Last day (exclusive, as ms) a note is announced. */
export function announceUntilMs(note: ReleaseNote): number {
  const start = Date.parse(`${note.date}T00:00:00+05:00`);
  return start + (note.announceDays ?? DEFAULT_ANNOUNCE_DAYS) * DAY_MS;
}

export function isAnnounced(
  note: ReleaseNote,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  return (
    t >= Date.parse(`${note.date}T00:00:00+05:00`) && t < announceUntilMs(note)
  );
}

export function notesForRole(
  role: string | null | undefined,
  notes: readonly ReleaseNote[] = RELEASE_NOTES,
): ReleaseNote[] {
  if (!role) return [];
  return notes
    .filter((n) => n.audiences.includes(role))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
