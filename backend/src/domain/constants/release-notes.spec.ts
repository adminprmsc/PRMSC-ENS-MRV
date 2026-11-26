import {
  RELEASE_NOTES,
  announceUntilMs,
  isAnnounced,
  notesForRole,
  type ReleaseNote,
} from './release-notes';

const note = (over: Partial<ReleaseNote> = {}): ReleaseNote => ({
  id: 'x',
  version: '1',
  date: '2026-11-26',
  title: 't',
  category: 'feature',
  audiences: ['ADMIN'],
  summary: 's',
  highlights: [],
  training: [],
  ...over,
});

describe('release notes catalog', () => {
  it('ids are unique, dates valid, every note has training', () => {
    const ids = RELEASE_NOTES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of RELEASE_NOTES) {
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(n.date))).toBe(false);
      expect(n.audiences.length).toBeGreaterThan(0);
      expect(n.training.length).toBeGreaterThan(0);
      for (const t of n.training) expect(t.steps.length).toBeGreaterThan(0);
      // Every audience with a link gets a portal path.
      for (const l of Object.values(n.links ?? {}))
        expect(l?.path).toMatch(/^\//);
    }
  });

  it('announces for 30 days from go-live (Pakistan time)', () => {
    const n = note({ date: '2026-11-26' });
    expect(isAnnounced(n, new Date('2026-11-25T18:59:00Z'))).toBe(false); // 23:59 PKT on 25th
    expect(isAnnounced(n, new Date('2026-11-25T19:00:00Z'))).toBe(true); // 00:00 PKT on 26th
    expect(isAnnounced(n, new Date('2026-12-25T18:59:00Z'))).toBe(true); // day 30
    expect(isAnnounced(n, new Date('2026-12-25T19:00:00Z'))).toBe(false); // day 31
    expect(announceUntilMs(note({ announceDays: 7 }))).toBe(
      Date.parse('2026-12-03T00:00:00+05:00'),
    );
  });

  it('filters by role, newest first', () => {
    const notes = [
      note({ id: 'old', date: '2026-01-01' }),
      note({ id: 'new', date: '2026-02-01' }),
      note({ id: 'hq', audiences: ['SUPER_ADMIN'] }),
    ];
    expect(notesForRole('ADMIN', notes).map((n) => n.id)).toEqual([
      'new',
      'old',
    ]);
    expect(notesForRole('SUPER_ADMIN', notes).map((n) => n.id)).toEqual(['hq']);
    expect(notesForRole('USER', notes)).toEqual([]);
    expect(notesForRole(undefined, notes)).toEqual([]);
  });
});
