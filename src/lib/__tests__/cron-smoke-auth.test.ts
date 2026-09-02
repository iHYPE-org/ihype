import { describe, expect, it } from 'vitest';
import { isSmokeRequestAuthorized } from '../../../workers/cron';

describe('isSmokeRequestAuthorized (cron worker /smoke)', () => {
  it('accepts exactly the configured bearer and nothing else', () => {
    expect(isSmokeRequestAuthorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(isSmokeRequestAuthorized('Bearer s3cre', 's3cret')).toBe(false);
    expect(isSmokeRequestAuthorized('Bearer s3cretx', 's3cret')).toBe(false);
    expect(isSmokeRequestAuthorized('s3cret', 's3cret')).toBe(false);
    expect(isSmokeRequestAuthorized(null, 's3cret')).toBe(false);
  });

  it('fails closed when no secret is configured — "Bearer undefined" used to pass', () => {
    expect(isSmokeRequestAuthorized('Bearer undefined', undefined)).toBe(false);
    expect(isSmokeRequestAuthorized('Bearer ', '')).toBe(false);
  });
});
