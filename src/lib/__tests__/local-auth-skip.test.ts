import { describe, expect, it } from 'vitest';
import { isLocalAuthSkipEnabled } from '@/lib/local-auth-skip';

describe('isLocalAuthSkipEnabled', () => {
  it('requires an explicit opt-in on a loopback hostname', () => {
    expect(isLocalAuthSkipEnabled('localhost', 'true')).toBe(true);
    expect(isLocalAuthSkipEnabled('127.0.0.1', 'true')).toBe(true);
    expect(isLocalAuthSkipEnabled('preview.localhost', 'true')).toBe(true);
    expect(isLocalAuthSkipEnabled('localhost', undefined)).toBe(false);
    expect(isLocalAuthSkipEnabled('localhost', 'false')).toBe(false);
  });

  it('cannot activate on a deployed hostname even when flagged', () => {
    expect(isLocalAuthSkipEnabled('ihype.org', 'true')).toBe(false);
    expect(isLocalAuthSkipEnabled('preview.ihype.org', 'true')).toBe(false);
  });
});

