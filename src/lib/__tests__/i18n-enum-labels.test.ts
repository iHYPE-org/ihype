import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as labels from '@/lib/i18n-enum-labels';

/**
 * Two things hold the enumeration labels together. Every helper, given the
 * identity translator, hands back the English it was given — so a case cannot
 * silently rename a label. And no member-facing file may reach for a template
 * or variable key again: `t(\`ns.${id}\`)` and `t(row.labelKey, …)` are keys
 * the extractor cannot see and the applier will refuse forever, which is how
 * 29 families came to be English in every locale (DESIGN_SYNC row 422).
 */

const identity = (_key: string, fallback?: string) => fallback ?? _key;

const SAMPLES: Array<[keyof typeof labels, string[]]> = [
  ['joinRoleLabel', ['Fan', 'Artist', 'Venue', 'Advertiser']],
  ['joinRoleHelp', ['Discover, hype, and buy tickets fee-free.', '70% of every ticket, your own page and shows.']],
  ['launchCohortTitle', ['Artists', 'Venues', 'Partners & media']],
  ['launchSprintDay', ['Day 1', 'Day 7']],
  ['infoTabLabel', ['Trust & Safety', 'Transparency', 'Privacy Policy', 'Terms of Service', 'The Charter', 'DMCA']],
  ['payoutTabLabel', ['History', 'Settings', 'This show']],
  ['showTrailLabel', ['On stage now', 'On sale', 'Tickets soon']],
  ['ticketPriceLabel', ['Free']],
  ['meActivityFallbackTitle', ['Ticket order', 'Show payout', 'Show settlement']],
  ['cancellationReasonLabel', ['Artist can no longer perform', 'Venue issue / closure', 'Low ticket sales', 'Other']],
  ['analyticsRangeLabel', ['7 Days', '30 Days', 'YTD']],
  ['askStatusLabel', ['Pending', 'Booked', 'Passed']],
  ['trustCategoryLabel', ['Track uploads', 'Profiles', 'Profile images', 'Shows', 'Comments', 'Ad audio spots']],
  ['pagesTabLabel', ['Search', 'My Page', 'Network', 'Creator']],
  ['profileTypeLabel', ['Artist', 'Venue', 'Fan']],
  ['netFilterLabel', ['All', 'Artists', 'Venues', 'Fans']],
  ['editorSectionLabel', ['About', 'Media', 'Press kit', 'Stats', 'Event Info', 'Contact']],
  ['statOptionLabel', ['Total Hypes', 'Followers', 'Monthly Listeners', 'Asks Booked']],
  ['statBoardLabel', ['Listens', 'Completed listens', 'Booking requests']],
  ['statBoardHint', ['Fans following this profile.', 'Fans following this venue.']],
  ['verifyProofLine', ['Business license or permits for the venue']],
  ['showTabLabel', ['About', 'Lineup', 'Venue']],
  ['supportCategoryLabel', ['Ticket issue', 'Payment / Payout', 'Other']],
];

describe('enumeration labels', () => {
  it('reproduce their English under an identity translator', () => {
    for (const [name, english] of SAMPLES) {
      const fn = labels[name] as (t: labels.Translate, english: string) => string;
      for (const value of english) expect(fn(identity, value), `${name}(${value})`).toBe(value);
    }
  });

  it('hand an unknown value straight back, so a new enumeration entry renders before it has a case', () => {
    expect(labels.payoutTabLabel(identity, 'Brand new tab')).toBe('Brand new tab');
    expect(labels.themeLabel(identity, 'console')).toBe('Light');
    expect(labels.themeLabel(identity, 'neon')).toBe('Neon');
  });

  it('every case is a literal t() call the extractor can see', () => {
    // Comments stripped first: the module's own docstring quotes the template
    // shape it exists to replace, and a scanner that reads its own prose as
    // code is this repository's oldest trap (mask-comments.mjs exists for it).
    const source = readFileSync('src/lib/i18n-enum-labels.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    const calls = [...source.matchAll(/\bt\(([^)]*)\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(100);
    for (const args of calls) expect(args, args).toMatch(/^'[a-zA-Z0-9_.]+',\s*'/);
  });

  it('no member-facing file reaches for a template or variable key', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return /\/(admin|__tests__)$/.test(path) ? [] : walk(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
      });
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    const offenders: string[] = [];
    for (const file of [...walk('src/app'), ...walk('src/components'), ...walk('src/lib')]) {
      strip(readFileSync(file, 'utf8')).split('\n').forEach((line, index) => {
        if (/\bt\(\s*`[^`]*\$\{/.test(line) || /\bt\(\s*[a-zA-Z_$][\w$.]*\s*,/.test(line)) offenders.push(`${file}:${index + 1}`);
      });
    }
    expect(offenders, 'a key the extractor cannot see is a key no translation can reach — write a literal t() case in i18n-enum-labels.ts').toEqual([]);
  });
});
