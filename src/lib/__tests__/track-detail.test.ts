import { describe, expect, it } from 'vitest';
import { copyrightTone, resolveCopyrightState } from '@/lib/track-detail';

describe('resolveCopyrightState', () => {
  it('reads an open report as flagged and pending review', () => {
    expect(resolveCopyrightState('OPEN')).toBe('flagged');
    expect(copyrightTone('flagged')).toBe('pending');
  });

  it('reads a dismissed report as cleared BY a moderator', () => {
    // Distinct from "no flags at upload": a human looked at this one, and the
    // copy on both pages says so.
    expect(resolveCopyrightState('DISMISSED')).toBe('cleared-reviewed');
    expect(copyrightTone('cleared-reviewed')).toBe('ok');
  });

  it('reads no report as cleared with no flags', () => {
    for (const empty of [null, undefined, '']) {
      expect(resolveCopyrightState(empty), String(empty)).toBe('cleared-unflagged');
    }
    expect(copyrightTone('cleared-unflagged')).toBe('ok');
  });

  it('does not treat an unexpected status as flagged', () => {
    /* ACTIONED is the one that matters here: it unpublishes the track, so it
       cannot reach either page — and if it somehow did, claiming "flagged ·
       pending review" about a removed track would be wrong in the other
       direction. Both pages fetch with `isPublished: true`, which is the real
       guard; this only pins the fallback. */
    expect(resolveCopyrightState('ACTIONED')).toBe('cleared-unflagged');
  });
});
