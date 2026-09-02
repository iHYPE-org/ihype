import { describe, expect, it } from 'vitest';
import { MEDIA_FILE_MB_CEILING, MEDIA_LIMIT_DEFAULTS, resolveMediaLimits } from '@/lib/media-limits';

describe('resolveMediaLimits (scale storage without a deploy)', () => {
  it('uses the defaults when nothing is set', () => {
    expect(resolveMediaLimits({})).toEqual(MEDIA_LIMIT_DEFAULTS);
  });
  it('reads KV strings and numbers alike', () => {
    expect(resolveMediaLimits({ profileGb: '5', profileTracks: 250 })).toMatchObject({ profileGb: 5, profileTracks: 250 });
  });
  it('never raises the per-file cap past the Worker memory ceiling', () => {
    expect(resolveMediaLimits({ fileMb: '500' }).fileMb).toBe(MEDIA_FILE_MB_CEILING);
    expect(resolveMediaLimits({ fileMb: 20 }).fileMb).toBe(20);
  });
  it('ignores garbage and clamps nonsense', () => {
    expect(resolveMediaLimits({ profileGb: 'lots', profileTracks: -4, fileMb: null })).toEqual({ fileMb: 60, profileGb: 1, profileTracks: 1 });
  });
});
