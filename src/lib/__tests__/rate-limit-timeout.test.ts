import { describe, expect, it } from 'vitest';
import { resolveDoTimeoutMs } from '@/lib/rate-limit';

const DEFAULT = 750;

describe('resolveDoTimeoutMs', () => {
  it('falls back to the default when nothing is configured', () => {
    expect(resolveDoTimeoutMs(undefined, undefined)).toBe(DEFAULT);
  });

  it('uses the env override when a bucket asks for nothing', () => {
    expect(resolveDoTimeoutMs(undefined, '1200')).toBe(1200);
  });

  it('lets a bucket override the env value', () => {
    // The case that matters: auth buckets need a cold-start-tolerant
    // deadline even if someone globally tightens the default.
    expect(resolveDoTimeoutMs(2500, '400')).toBe(2500);
  });

  it('ignores junk and non-positive env values rather than disabling the timeout', () => {
    // A zero or negative deadline would make every DO call fail instantly and
    // silently drop the whole platform onto the halved KV limit.
    expect(resolveDoTimeoutMs(undefined, 'soon')).toBe(DEFAULT);
    expect(resolveDoTimeoutMs(undefined, '0')).toBe(DEFAULT);
    expect(resolveDoTimeoutMs(undefined, '-5')).toBe(DEFAULT);
  });

  it('ignores a non-positive per-bucket override too', () => {
    expect(resolveDoTimeoutMs(0, '1200')).toBe(1200);
    expect(resolveDoTimeoutMs(-1, undefined)).toBe(DEFAULT);
  });
});
