import { describe, expect, it } from 'vitest';
import {
  DOOR_MANIFEST_VERSION,
  MAX_OFFLINE_SCAN_AGE_MS,
  extractTicketCode,
  hashTicketCode,
  isUsableManifest,
  judgeOffline,
  resolveScanTimestamp,
  type DoorManifest,
  type LocalDoorScan,
} from '@/lib/door-manifest';
import { canWorkTheDoor } from '@/lib/door-access';
import type { Session } from 'next-auth';

const CODE = '0x0123456789abcdef01234567';

describe('extractTicketCode — what the camera read, reduced to a code', () => {
  it('reads the URL the ticket QR encodes', () => {
    expect(extractTicketCode(`https://ihype.org/tickets/${CODE}`)).toBe(CODE);
  });

  it('reads the shell URL and a trailing slash', () => {
    expect(extractTicketCode(`https://ihype.org/app/me/tickets/${CODE}/`)).toBe(CODE);
  });

  it('reads a bare code, trimmed, case preserved', () => {
    expect(extractTicketCode(`  ${CODE.toUpperCase()} `)).toBe(CODE.toUpperCase());
  });

  it('accepts every id shape the database holds — the minter\'s hex, the fixture\'s IHY- token', () => {
    const long = `0x${'ab12'.repeat(8)}`;
    expect(extractTicketCode(long)).toBe(long);
    expect(extractTicketCode('IHY-1A2B3C4D')).toBe('IHY-1A2B3C4D');
    expect(extractTicketCode(`https://ihype.org/tickets/${long}`)).toBe(long);
    expect(extractTicketCode('https://ihype.org/tickets/IHY-1A2B3C4D')).toBe('IHY-1A2B3C4D');
  });

  it('refuses anything that cannot be a code, rather than guessing', () => {
    expect(extractTicketCode('https://example.com/tickets/' + CODE)).toBe(CODE); // host is not the question — the show is checked server-side
    expect(extractTicketCode('WIFI:S:Venue;T:WPA;P:secret;;')).toBeNull();
    expect(extractTicketCode('https://ihype.org/shows/some-show')).toBeNull();
    expect(extractTicketCode('https://ihype.org/tickets/')).toBeNull();
    expect(extractTicketCode('two words')).toBeNull();
    expect(extractTicketCode('abc')).toBeNull(); // too short to be a code
    expect(extractTicketCode('')).toBeNull();
  });
});

describe('hashTicketCode — the manifest never carries a redeemable code', () => {
  it('is deterministic and case-insensitive on the code', async () => {
    const a = await hashTicketCode('show_1', CODE);
    const b = await hashTicketCode('show_1', CODE.toUpperCase());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is domain-separated by the show, so one night\'s list says nothing about another', async () => {
    const a = await hashTicketCode('show_1', CODE);
    const b = await hashTicketCode('show_2', CODE);
    expect(a).not.toBe(b);
  });

  it('does not contain the code', async () => {
    expect((await hashTicketCode('show_1', CODE)).includes(CODE.slice(2))).toBe(false);
  });
});

describe('judgeOffline — the door with no signal', () => {
  const manifest: DoorManifest = {
    v: DOOR_MANIFEST_VERSION,
    showId: 'show_1',
    showSlug: 'night',
    title: 'Night',
    startsAt: '2026-10-01T02:00:00.000Z',
    fetchedAt: '2026-10-01T00:00:00.000Z',
    valid: [{ h: 'aaa', name: 'Ada' }, { h: 'bbb', name: 'Ben' }],
    scanned: ['ccc'],
  };

  it('admits a ticket on the list, by name', () => {
    expect(judgeOffline(manifest, [], 'aaa')).toEqual({ kind: 'admit', name: 'Ada' });
  });

  it('refuses a ticket already scanned when the list was built', () => {
    expect(judgeOffline(manifest, [], 'ccc')).toEqual({ kind: 'already-scanned' });
  });

  it('calls a code this phone already admitted a duplicate, with when', () => {
    const scans: LocalDoorScan[] = [{ code: CODE, hash: 'aaa', name: 'Ada', at: '2026-10-01T01:00:00.000Z', sync: 'pending' }];
    expect(judgeOffline(manifest, scans, 'aaa')).toEqual({ kind: 'duplicate', name: 'Ada', at: '2026-10-01T01:00:00.000Z' });
  });

  it('does not count a scan the server refused as a prior admission', () => {
    const scans: LocalDoorScan[] = [{ code: CODE, hash: 'aaa', name: null, at: '2026-10-01T01:00:00.000Z', sync: 'refused' }];
    expect(judgeOffline(manifest, scans, 'aaa')).toEqual({ kind: 'admit', name: 'Ada' });
  });

  it('is "unknown", not "invalid", for a code the list has never seen — a ticket may have been bought since', () => {
    expect(judgeOffline(manifest, [], 'zzz')).toEqual({ kind: 'unknown' });
    expect(judgeOffline(null, [], 'aaa')).toEqual({ kind: 'unknown' });
  });
});

describe('resolveScanTimestamp — when an offline scan is recorded as', () => {
  const now = new Date('2026-10-01T03:00:00.000Z');

  it('honours a plausible claim from the door phone', () => {
    expect(resolveScanTimestamp('2026-10-01T02:30:00.000Z', now).toISOString()).toBe('2026-10-01T02:30:00.000Z');
  });

  it('never records an arrival in the future', () => {
    expect(resolveScanTimestamp('2026-10-01T03:00:01.000Z', now)).toEqual(now);
  });

  it('falls back to the server clock past the window, on garbage, and on no claim', () => {
    const tooOld = new Date(now.getTime() - MAX_OFFLINE_SCAN_AGE_MS - 1).toISOString();
    expect(resolveScanTimestamp(tooOld, now)).toEqual(now);
    expect(resolveScanTimestamp('yesterday-ish', now)).toEqual(now);
    expect(resolveScanTimestamp(12345, now)).toEqual(now);
    expect(resolveScanTimestamp(undefined, now)).toEqual(now);
  });
});

describe('isUsableManifest — a stale copy on a phone is discarded, not misread', () => {
  const good = { v: DOOR_MANIFEST_VERSION, showId: 'show_1', valid: [], scanned: [] };
  it('accepts this version for this show', () => expect(isUsableManifest(good, 'show_1')).toBe(true));
  it('refuses another show, another version, and junk', () => {
    expect(isUsableManifest(good, 'show_2')).toBe(false);
    expect(isUsableManifest({ ...good, v: 99 }, 'show_1')).toBe(false);
    expect(isUsableManifest('{}', 'show_1')).toBe(false);
    expect(isUsableManifest(null, 'show_1')).toBe(false);
  });
});

describe('canWorkTheDoor — the same four people as the cancel route', () => {
  const session = (id: string, role = 'LISTENER'): Session =>
    ({ user: { id, email: `${id}@example.com`, role }, expires: '' } as unknown as Session);
  const show = { creatorId: 'creator', venueProfile: { ownerId: 'venue' }, headlinerProfile: { ownerId: 'act' } };

  it('admits the venue owner, the headliner owner and the creator', () => {
    expect(canWorkTheDoor(session('venue'), show)).toBe(true);
    expect(canWorkTheDoor(session('act'), show)).toBe(true);
    expect(canWorkTheDoor(session('creator'), show)).toBe(true);
  });

  it('refuses a fan, a stranger and nobody', () => {
    expect(canWorkTheDoor(session('fan'), show)).toBe(false);
    expect(canWorkTheDoor(null, show)).toBe(false);
    expect(canWorkTheDoor(session('fan'), { creatorId: null, venueProfile: null, headlinerProfile: null })).toBe(false);
  });
});
