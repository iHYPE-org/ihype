/**
 * No query includes a whole Profile row through a relation (2026-09-24,
 * DESIGN_SYNC row 513).
 *
 * A Profile carries about forty text columns, among them
 * `verificationProofUrl`, the identity document `/api/verify` stores inline as
 * base64 up to 8 MB large. The public ticket page, the door ticket page, the
 * fan page and the reassign route each included the venue (and on the ticket
 * page the headliner and promoter) as `venueProfile: true`, and read that
 * document on every view to draw a name and a city. The relation must name
 * its fields; the admin proof route reads the column on purpose, by name.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROFILE_RELATIONS = [
  'profile', 'venueProfile', 'headlinerProfile', 'promoterProfile', 'artistProfile',
  'affiliatePromoterProfile', 'targetProfile', 'requesterProfile',
];
const WHOLE_ROW = new RegExp(`\\b(${PROFILE_RELATIONS.join('|')})\\s*:\\s*true\\b`);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe('profile relations', () => {
  it('are selected by field, never included as whole rows', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (WHOLE_ROW.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
