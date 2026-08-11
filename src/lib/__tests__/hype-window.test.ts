import { describe, expect, it } from 'vitest';
import {
  canHype, formatHypeWait, HYPE_WINDOW_MS, hypeWaitMs, nextHypeAt,
} from '@/lib/hype-window';

const T0 = new Date('2026-08-11T12:00:00.000Z');
const at = (msFromT0: number) => new Date(T0.getTime() + msFromT0);

describe('hype window', () => {
  it('lets a member who has never hyped a target hype it', () => {
    for (const empty of [null, undefined, '']) {
      expect(canHype(empty, T0), String(empty)).toBe(true);
      expect(hypeWaitMs(empty, T0)).toBe(0);
      expect(nextHypeAt(empty)).toBeNull();
    }
  });

  it('refuses a second hype inside the window and allows one after it', () => {
    expect(canHype(T0, at(0))).toBe(false);
    expect(canHype(T0, at(HYPE_WINDOW_MS - 1))).toBe(false);
    // Exactly 24h later the hype is spendable again — the boundary belongs to
    // the member, not the platform.
    expect(canHype(T0, at(HYPE_WINDOW_MS))).toBe(true);
    expect(canHype(T0, at(HYPE_WINDOW_MS + 1))).toBe(true);
  });

  it('reports the remaining wait, and never a negative one', () => {
    expect(hypeWaitMs(T0, at(0))).toBe(HYPE_WINDOW_MS);
    expect(hypeWaitMs(T0, at(HYPE_WINDOW_MS / 2))).toBe(HYPE_WINDOW_MS / 2);
    expect(hypeWaitMs(T0, at(HYPE_WINDOW_MS * 3))).toBe(0);
  });

  it('accepts an ISO string as well as a Date, and ignores an unparseable one', () => {
    expect(hypeWaitMs(T0.toISOString(), at(0))).toBe(HYPE_WINDOW_MS);
    // A garbage timestamp must not lock a member out forever — it reads as
    // "never hyped", which at worst grants one extra hype.
    expect(canHype('not-a-date', T0)).toBe(true);
  });

  it('states the wait coarse to the minute', () => {
    expect(formatHypeWait(0)).toBe('');
    expect(formatHypeWait(-5)).toBe('');
    expect(formatHypeWait(1_000)).toBe('1m'); // under a minute still reads 1m
    expect(formatHypeWait(60_000)).toBe('1m');
    expect(formatHypeWait(40 * 60_000)).toBe('40m');
    expect(formatHypeWait(60 * 60_000)).toBe('1h');
    expect(formatHypeWait((17 * 60 + 40) * 60_000)).toBe('17h 40m');
    expect(formatHypeWait(HYPE_WINDOW_MS)).toBe('24h');
  });

  it('never says 0m while still refusing the tap', () => {
    // A control that reads zero and does nothing looks broken.
    for (const ms of [1, 500, 59_999]) {
      expect(formatHypeWait(ms), String(ms)).not.toBe('0m');
      expect(hypeWaitMs(new Date(Date.now() - HYPE_WINDOW_MS + ms))).toBeGreaterThan(0);
    }
  });

  it('puts nextHypeAt exactly one window after the hype', () => {
    expect(nextHypeAt(T0)?.getTime()).toBe(T0.getTime() + HYPE_WINDOW_MS);
  });
});
