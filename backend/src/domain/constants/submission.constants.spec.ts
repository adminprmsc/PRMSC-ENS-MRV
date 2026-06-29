import {
  normalizeWaterSubmissionStatus,
  SUBMISSION_STATUS_DRAFTED,
  SUBMISSION_STATUS_SUBMITTED,
  SUBMISSION_STATUS_ACCEPTED,
} from './submission.constants';

describe('normalizeWaterSubmissionStatus', () => {
  it('defaults empty to drafted', () => {
    expect(normalizeWaterSubmissionStatus(null)).toBe(
      SUBMISSION_STATUS_DRAFTED,
    );
    expect(normalizeWaterSubmissionStatus('')).toBe(SUBMISSION_STATUS_DRAFTED);
  });

  it('maps draft alias', () => {
    expect(normalizeWaterSubmissionStatus('draft')).toBe(
      SUBMISSION_STATUS_DRAFTED,
    );
  });

  it('maps legacy aliases', () => {
    expect(normalizeWaterSubmissionStatus('under_review')).toBe(
      SUBMISSION_STATUS_SUBMITTED,
    );
    expect(normalizeWaterSubmissionStatus('verified')).toBe(
      SUBMISSION_STATUS_ACCEPTED,
    );
    expect(normalizeWaterSubmissionStatus('approved')).toBe(
      SUBMISSION_STATUS_ACCEPTED,
    );
  });
});
