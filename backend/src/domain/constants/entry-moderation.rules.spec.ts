import {
  checkWaterLogModeration,
  isIsoDay,
  MODERATION_LIST_DEFAULT_LIMIT,
  MODERATION_LIST_MAX_LIMIT,
  MODERATION_REASON_MAX_LENGTH,
  normalizeModerationReason,
  parseModerationListLimit,
} from './entry-moderation.rules';

describe('normalizeModerationReason', () => {
  it.each([undefined, null, 42, {}, [], true])('rejects non-string %p', (v) => {
    expect(normalizeModerationReason(v)).toEqual({
      ok: false,
      error: 'A reason is required',
    });
  });

  it.each(['', '   ', '\n\t '])('rejects blank %p', (v) => {
    expect(normalizeModerationReason(v).ok).toBe(false);
  });

  it('enforces the minimum on the trimmed value', () => {
    expect(normalizeModerationReason('  123456789  ').ok).toBe(false);
    expect(normalizeModerationReason('  1234567890  ')).toEqual({
      ok: true,
      reason: '1234567890',
    });
  });

  it('enforces the maximum length', () => {
    expect(
      normalizeModerationReason('x'.repeat(MODERATION_REASON_MAX_LENGTH)).ok,
    ).toBe(true);
    expect(
      normalizeModerationReason('x'.repeat(MODERATION_REASON_MAX_LENGTH + 1))
        .ok,
    ).toBe(false);
  });
});

describe('checkWaterLogModeration', () => {
  it('reject: allows only accepted (incl. legacy aliases)', () => {
    expect(checkWaterLogModeration('reject', 'accepted')).toEqual({
      ok: true,
      status: 'accepted',
    });
    expect(checkWaterLogModeration('reject', 'approved').ok).toBe(true);
    expect(checkWaterLogModeration('reject', 'VERIFIED').ok).toBe(true);
  });

  it.each(['submitted', 'drafted', 'reverted_back', null, undefined, ''])(
    'reject: refuses in-flight status %p',
    (s) => {
      const r = checkWaterLogModeration('reject', s);
      expect(r.ok).toBe(false);
    },
  );

  it('reject: refuses an already rejected log with a specific message', () => {
    expect(checkWaterLogModeration('reject', 'rejected')).toEqual({
      ok: false,
      error: 'This water log has already been rejected',
    });
  });

  it('delete: allows accepted and rejected', () => {
    expect(checkWaterLogModeration('delete', 'accepted').ok).toBe(true);
    expect(checkWaterLogModeration('delete', 'rejected').ok).toBe(true);
  });

  it.each(['submitted', 'drafted', 'reverted_back', null])(
    'delete: refuses in-flight status %p',
    (s) => {
      expect(checkWaterLogModeration('delete', s).ok).toBe(false);
    },
  );
});

describe('parseModerationListLimit', () => {
  it.each([undefined, '', 'abc', '0', '-5', null])('defaults for %p', (v) => {
    expect(parseModerationListLimit(v)).toBe(MODERATION_LIST_DEFAULT_LIMIT);
  });
  it('clamps to the max', () => {
    expect(parseModerationListLimit('100000')).toBe(MODERATION_LIST_MAX_LIMIT);
  });
  it('accepts a normal value', () => {
    expect(parseModerationListLimit('25')).toBe(25);
  });
});

describe('isIsoDay', () => {
  it('accepts real days', () => {
    expect(isIsoDay('2026-02-28')).toBe(true);
    expect(isIsoDay('2024-02-29')).toBe(true);
  });
  it.each([
    '2026-02-30',
    '2026-13-01',
    '2026-1-01',
    '26-01-01',
    '',
    5,
    null,
    "2026-01-01' OR 1=1",
  ])('rejects %p', (v) => {
    expect(isIsoDay(v)).toBe(false);
  });
});
