import { describe, expect, it } from 'vitest';
import {
  ADS_PER_BREAK,
  STATION_AD_INTERVAL_SECS,
  adIdFromClipId,
  interleaveStationAds,
  isBillableAd,
  type StationItemLike,
} from '@/lib/station-breaks';
import type { ShowAdClip } from '@/lib/show-composer';

/** Five-minute tracks, so three of them clear the fifteen-minute interval. */
const track = (n: number, durationSecs = 300): StationItemLike => ({
  hexId: `t${n}`,
  title: `Track ${n}`,
  url: `/api/media/t${n}`,
  artistName: 'Someone',
  artistSlug: 'someone',
  artworkUrl: null,
  durationSecs,
});

const tracks = (n: number, durationSecs = 300) =>
  Array.from({ length: n }, (_, i) => track(i + 1, durationSecs));

const clip = (id: string, durationSeconds?: number): ShowAdClip => ({
  clipId: id,
  title: `Ad ${id}`,
  url: `https://cdn.example/${id}.mp3`,
  scope: 'national',
  mimeType: 'audio/mpeg',
  durationSeconds,
  notes: null,
});

const kindsOf = (items: StationItemLike[]) => items.map((i) => (i.adClipId ? 'AD' : 'TRACK'));
const adCount = (items: StationItemLike[]) => items.filter((i) => i.adClipId).length;

describe('interleaveStationAds — cadence', () => {
  it('breaks once about every fifteen minutes of music, not every N tracks', () => {
    // 6 x 5min = 30 min, so one break falls due after track 3.
    const out = interleaveStationAds(tracks(6), [clip('mkt_a'), clip('mkt_b')]);
    expect(kindsOf(out)).toEqual([
      'TRACK', 'TRACK', 'TRACK', 'AD', 'AD',
      'TRACK', 'TRACK', 'TRACK',
    ]);
  });

  it('airs a couple of spots per break', () => {
    const out = interleaveStationAds(tracks(6), [clip('mkt_a'), clip('mkt_b')]);
    expect(adCount(out)).toBe(ADS_PER_BREAK);
  });

  it('measures real duration, so short tracks wait longer for a break', () => {
    // 6 x 90s = 9 min total: under the interval, so only the short-rotation
    // guarantee fires — one break, not one per three tracks.
    const out = interleaveStationAds(tracks(6, 90), [clip('mkt_a'), clip('mkt_b')]);
    expect(adCount(out)).toBe(ADS_PER_BREAK);
  });

  it('breaks repeatedly across a long rotation', () => {
    // 12 x 5min = 60 min → breaks after tracks 3, 6 and 9. Not after 12: last.
    const out = interleaveStationAds(tracks(12), [clip('mkt_a'), clip('mkt_b')]);
    expect(adCount(out)).toBe(3 * ADS_PER_BREAK);
  });
});

describe('interleaveStationAds — placement rules', () => {
  it('never opens on an ad', () => {
    const out = interleaveStationAds(tracks(12), [clip('mkt_a')]);
    expect(out[0]?.adClipId).toBeUndefined();
  });

  it('never ends on an ad, because the rotation loops back to the first track', () => {
    // A trailing break would run straight into the next pass's break.
    const out = interleaveStationAds(tracks(12), [clip('mkt_a')]);
    expect(out[out.length - 1]?.adClipId).toBeUndefined();
  });

  it('still airs a break when the whole rotation is shorter than the interval', () => {
    // Ad revenue is the only revenue: a thin catalogue must not mean an
    // unpaid station.
    const out = interleaveStationAds(tracks(2, 60), [clip('mkt_a')]);
    expect(adCount(out)).toBe(ADS_PER_BREAK);
    expect(kindsOf(out)).toEqual(['TRACK', 'AD', 'AD', 'TRACK']);
  });

  it('cannot place a break with only one track, since there is no interior slot', () => {
    const one = tracks(1);
    expect(interleaveStationAds(one, [clip('mkt_a')])).toEqual(one);
  });

  it('returns the rotation untouched when no spots are eligible', () => {
    const rotation = tracks(20);
    expect(interleaveStationAds(rotation, [])).toEqual(rotation);
  });

  it('cycles clips so one spot does not take every slot', () => {
    const out = interleaveStationAds(tracks(12), [clip('mkt_a'), clip('mkt_b')]);
    expect(out.filter((i) => i.adClipId).map((i) => i.adClipId))
      .toEqual(['mkt_a', 'mkt_b', 'mkt_a', 'mkt_b', 'mkt_a', 'mkt_b']);
  });
});

describe('interleaveStationAds — durations', () => {
  it('gives a spot a usable duration even when it stored none', () => {
    const out = interleaveStationAds(tracks(6), [clip('mkt_a')]);
    // Zero would make stationPositionAt skip straight past the break.
    expect(out.find((i) => i.adClipId)?.durationSecs).toBeGreaterThan(0);
  });

  it('uses the spot’s real duration when it has one', () => {
    const out = interleaveStationAds(tracks(6), [clip('mkt_a', 45)]);
    expect(out.find((i) => i.adClipId)?.durationSecs).toBe(45);
  });

  it('rejects nonsense settings rather than looping forever', () => {
    const rotation = tracks(20);
    expect(interleaveStationAds(rotation, [clip('mkt_a')], 0)).toEqual(rotation);
    expect(interleaveStationAds(rotation, [clip('mkt_a')], Number.NaN)).toEqual(rotation);
    expect(interleaveStationAds(rotation, [clip('mkt_a')], STATION_AD_INTERVAL_SECS, 0)).toEqual(rotation);
  });
});

describe('billing discrimination', () => {
  it('bills a marketplace spot', () => {
    expect(isBillableAd({ adClipId: 'mkt_abc123' })).toBe(true);
    expect(adIdFromClipId('mkt_abc123')).toBe('abc123');
  });

  it('does not bill a built-in placeholder', () => {
    // builtInAdClips use 0x… ids and are house filler, not purchased spots.
    expect(isBillableAd({ adClipId: '0xdeadbeef' })).toBe(false);
    expect(adIdFromClipId('0xdeadbeef')).toBeNull();
  });

  it('does not bill an ordinary track', () => {
    expect(isBillableAd({ adClipId: undefined })).toBe(false);
    expect(adIdFromClipId(undefined)).toBeNull();
  });

  it('does not treat a bare prefix as an ad id', () => {
    expect(adIdFromClipId('mkt_')).toBeNull();
  });
});

/**
 * The stated product rule, pinned: "Every 15 mins, or until past 15 minutes to
 * allow for song completion. This way ads aren't interrupting the music, but
 * are tucked in between song playback."
 */
describe('the fifteen-minute cadence never interrupts a song', () => {
  it('waits for the track that crosses the threshold to finish', () => {
    // A 14-minute track, then a 4-minute one. The break cannot land at 15:00,
    // because 15:00 falls inside track 2 — so it lands at 18:00, after the
    // track that carried the total past the interval.
    const rotation = [track(1, 14 * 60), track(2, 4 * 60), track(3), track(4)];
    const out = interleaveStationAds(rotation, [clip('mkt_a')], STATION_AD_INTERVAL_SECS, 1);
    expect(kindsOf(out)).toEqual(['TRACK', 'TRACK', 'AD', 'TRACK', 'TRACK']);
    // Stated the other way round: nothing sits between tracks 1 and 2, where
    // the raw fifteen-minute mark actually fell.
    expect(out[1].adClipId).toBeUndefined();
  });

  it('never opens or closes the rotation on an ad', () => {
    // The rotation loops, so a trailing break would run straight into the
    // leading one on the next pass.
    const out = interleaveStationAds(tracks(12), [clip('mkt_a'), clip('mkt_b')]);
    expect(out[0].adClipId).toBeUndefined();
    expect(out[out.length - 1].adClipId).toBeUndefined();
    // 60 minutes of music holds three interior breaks; the fourth would be
    // trailing and is refused.
    expect(adCount(out) / ADS_PER_BREAK).toBe(3);
  });
});
