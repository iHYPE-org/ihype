import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatCalendarDay, formatDate, formatNumber, formatRelativeAge, formatUsd, intlTag } from '@/lib/format-locale';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * Dates and figures reach the member in the member's language (DESIGN_SYNC
 * row 424).
 *
 * Two halves. The first pins `format-locale.ts` — above all that ENGLISH
 * OUTPUT IS BYTE-IDENTICAL to what the 65 `'en-US'` literals and 79 bare
 * `toLocaleString()` calls it replaced used to render, because English is
 * the locale every measurement here runs in and a changed English string
 * would read as a layout diff on every instrument downstream.
 *
 * The second is the gate: no member-facing file may format a date or a
 * number with a hardcoded tag, or with no tag at all. A bare
 * `toLocaleString()` is not "the default" — on the Worker it is en-US and in
 * a browser it is whatever the OS says, and neither is the language the
 * member chose. The allowlist is the set of surfaces that have NO member
 * locale to read (a recipient's email, a cron, a shared image, the admin
 * console), each with the reason, and every entry must still excuse
 * something or the entry is stale and the test says so.
 */

const ROOT = join(__dirname, '..', '..', '..');
const SCAN_ROOTS = ['src/app', 'src/components', 'src/lib'];

/** Path prefixes that have no member locale to format in, and why. */
const ALLOWED: { prefix: string; reason: string }[] = [
  { prefix: 'src/lib/format-locale.ts', reason: 'the locale → BCP-47 map itself' },
  { prefix: 'src/lib/zoned-time.ts', reason: 'formatToParts, read structurally — the tag never reaches a reader' },
  { prefix: 'src/app/admin/', reason: 'the operator console ships in English by decision' },
  { prefix: 'src/components/admin/', reason: 'the operator console ships in English by decision' },
  { prefix: 'src/components/AdminAdsClient.tsx', reason: 'the console in the wrong folder (row 388) — /admin/ads is its only mount' },
  { prefix: 'src/lib/admin-device.ts', reason: 'the admin device-registration email' },
  { prefix: 'src/lib/analytics-engine.ts', reason: 'formatMetricValue has one caller, /admin/analytics' },
  { prefix: 'src/lib/growth-util.ts', reason: 'weekendWindow labels are read by no page (tests only)' },
  { prefix: 'src/lib/email-digest.ts', reason: 'email — User carries no locale' },
  { prefix: 'src/lib/notification-jobs.ts', reason: 'email — User carries no locale' },
  { prefix: 'src/lib/show-reminders.ts', reason: 'the follower reminder email — User carries no locale' },
  { prefix: 'src/lib/integrity.ts', reason: 'the feed-integrity ledger is an English document' },
  { prefix: 'src/app/api/cron/', reason: 'cron-sent email — User carries no locale' },
  { prefix: 'src/app/api/tickets/[serializedId]/reassign/route.ts', reason: 'email to the new holder — no locale on file' },
  { prefix: 'src/app/api/shows/[showId]/route.ts', reason: 'the reschedule notice to ticket holders — User carries no locale' },
  { prefix: 'src/app/api/profile/[slug]/fan-mail/route.ts', reason: 'an English error sentence carries an English date' },
  { prefix: 'src/app/shows/[slug]/opengraph-image.tsx', reason: 'a shared image has no reader locale' },
  { prefix: 'src/app/shows/[slug]/poster/route.tsx', reason: 'a shared image has no reader locale' },
];

/* `formatDoorTime` and `formatShowTime` are counted too: they take the
   locale like every other formatter here, so pinning one to English is the
   same decision the rest of this rule is about. Without them the row-464
   conversion would have silently emptied six allowlist entries and the
   gate would have shrunk while reading green. */
const HARDCODED_TAG = /toLocale(?:Date|Time|)String\(\s*['"]en(?:-US)?['"]|Intl\.(?:DateTimeFormat|NumberFormat|RelativeTimeFormat)\(\s*['"]en(?:-US)?['"]|\bformat(?:Date|Number|Usd|DoorTime)\(\s*'en'|\bformatShowTime\([^,)]+,\s*'en'|,\s*'en'\)/;
const NO_TAG = /toLocale(?:Date|Time|)String\(\s*(?:\)|undefined\b)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = SCAN_ROOTS.flatMap((root) => walk(join(ROOT, root))).map((f) => relative(ROOT, f).split('\\').join('/'));

function allowance(file: string) {
  return ALLOWED.find((entry) => file.startsWith(entry.prefix));
}

describe('format-locale', () => {
  const instant = new Date(Date.UTC(2026, 8, 14, 20, 0, 0));
  const UTC = { timeZone: 'UTC' as const };

  it('renders English exactly as the en-US literals it replaced did', () => {
    expect(formatDate('en', instant, { weekday: 'short', month: 'short', day: 'numeric', ...UTC })).toBe('Mon, Sep 14');
    expect(formatDate('en', instant, { timeStyle: 'short', ...UTC })).toBe('8:00 PM');
    expect(formatDate('en', instant, { dateStyle: 'medium', timeStyle: 'short', ...UTC })).toBe('Sep 14, 2026, 8:00 PM');
    expect(formatDate('en', instant, { year: 'numeric', month: 'numeric', day: 'numeric', ...UTC })).toBe('9/14/2026');
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
    expect(formatUsd('en', 123456)).toBe('$1,234.56');
    expect(formatUsd('en', 123456, 0)).toBe('$1,235');
    expect(formatUsd('en', 1800, 'auto')).toBe('$18');
    expect(formatUsd('en', 1850, 'auto')).toBe('$18.50');
    expect(formatUsd('en', 0)).toBe('$0.00');
  });

  it('ages a notification the way the old timeAgo() did in English, and in the member language otherwise', () => {
    const now = Date.UTC(2026, 8, 14, 20, 0, 0);
    const ago = (ms: number) => new Date(now - ms).toISOString();
    expect(formatRelativeAge('en', ago(10_000), now)).toBe('now');
    expect(formatRelativeAge('en', ago(5 * 60_000), now)).toBe('5m ago');
    expect(formatRelativeAge('en', ago(3 * 3_600_000), now)).toBe('3h ago');
    expect(formatRelativeAge('en', ago(2 * 86_400_000), now)).toBe('2d ago');
    expect(formatRelativeAge('en', ago(21 * 86_400_000), now)).toBe('3w ago');
    expect(formatRelativeAge('es', ago(5 * 60_000), now)).not.toBe('5m ago');
    expect(formatRelativeAge('en', 'not a date', now)).toBe('');
  });

  it('renders another locale differently, so the tag really reaches Intl', () => {
    expect(formatDate('de', instant, { weekday: 'short', month: 'short', day: 'numeric', ...UTC })).not.toBe('Mon, Sep 14');
    expect(formatNumber('de', 1234567)).toBe('1.234.567');
    expect(formatUsd('de', 123456)).not.toBe('$1,234.56');
    expect(intlTag('pt')).toBe('pt-BR');
  });

  it('never throws on an unknown or absent locale — a formatter must not take a page down', () => {
    expect(intlTag(undefined)).toBe('en-US');
    expect(intlTag('xx')).toBe('en-US');
    expect(formatNumber(null, 1000)).toBe('1,000');
    expect(formatDate('', '2026-09-14T20:00:00Z', { month: 'short', ...UTC })).toBe('Sep');
  });
});

describe('formatCalendarDay — a day with no time of day', () => {
  /* `AvailabilityDate.date` is stored at UTC midnight: the artist picks
     15 March and the row holds 2026-03-15T00:00:00Z. Read in any zone west
     of Greenwich that instant falls on the 14th (DESIGN_SYNC row 460). */
  const stored = new Date('2026-03-15T00:00:00.000Z');

  it('reads as the day the artist picked, where a plain format reads the day before', () => {
    // The defect, stated: one instant, one locale, one option apart.
    expect(
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(stored),
    ).toBe('Mar 14');
    expect(formatCalendarDay('en', stored, { month: 'short', day: 'numeric' })).toBe('Mar 15');
  });

  it('holds the day whatever options it is given, because the zone is not one of them', () => {
    expect(formatCalendarDay('en', stored)).toBe('Mar 15, 2026');
    expect(formatCalendarDay('en', stored, { weekday: 'long' })).toBe('Sunday');
  });

  it("takes the string the row's JSON carries, like formatDate", () => {
    expect(formatCalendarDay('en', '2026-03-15T00:00:00.000Z', { month: 'short', day: 'numeric' })).toBe('Mar 15');
  });

  it('formats in the member locale, like every other figure here', () => {
    expect(formatCalendarDay('es', stored, { month: 'long', day: 'numeric' })).toBe('15 de marzo');
  });
});

describe('every member-facing date and figure is formatted in the member locale', () => {
  it('scans a plausible number of files', () => {
    expect(FILES.length).toBeGreaterThan(400);
  });

  it('no member-facing file hardcodes an English tag', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (allowance(file)) continue;
      const src = maskComments(readFileSync(join(ROOT, file), 'utf8'));
      src.split('\n').forEach((line, i) => {
        if (HARDCODED_TAG.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('no member-facing file formats with no locale at all', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (allowance(file)) continue;
      const src = maskComments(readFileSync(join(ROOT, file), 'utf8'));
      src.split('\n').forEach((line, i) => {
        if (NO_TAG.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('every allowlist entry still excuses something — a stale entry is a hole', () => {
    const stale: string[] = [];
    for (const entry of ALLOWED) {
      const files = FILES.filter((f) => f.startsWith(entry.prefix));
      if (files.length === 0) { stale.push(`${entry.prefix} (no such file)`); continue; }
      const hit = files.some((f) => {
        const src = maskComments(readFileSync(join(ROOT, f), 'utf8'));
        return HARDCODED_TAG.test(src) || NO_TAG.test(src) || f === 'src/lib/format-locale.ts';
      });
      if (!hit) stale.push(`${entry.prefix} (excuses nothing now — remove it)`);
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });
});
