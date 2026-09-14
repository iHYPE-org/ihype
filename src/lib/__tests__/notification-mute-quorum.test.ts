import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every switch that can keep marketing mail flowing must be one the member can see.
 *
 * `sendMarketingEmail` skips a member only when EVERY field in its quorum is
 * false. That makes the quorum a conjunction, so one field stuck `true` is
 * enough to defeat the whole Settings screen — and `journalPosts` was exactly
 * that: `@default(true)`, a row promising "new posts from creators you follow"
 * that no sender could ever produce (the journal model was dropped), and a
 * member of the quorum. Removing only the row would have left a member who
 * turned off all three remaining switches still receiving mail, with no
 * control anywhere that could stop it.
 *
 * So the rule is the pairing, not either half: a field in the mute quorum is
 * rendered in Settings, and a field that is not rendered is not in the quorum.
 * This reads both sides out of the real files rather than restating them,
 * because a restatement is what would go stale the next time a category is
 * retired.
 */
describe('the marketing mute quorum', () => {
  const mailer = readFileSync('src/lib/mailer.ts', 'utf8');
  const fanMail = readFileSync('src/app/api/profile/[slug]/fan-mail/route.ts', 'utf8');
  const settings = readFileSync('src/components/mmm/MmmSettings.tsx', 'utf8');

  /** The fields named in a `!prefs.x && !prefs.y && …` skip condition. */
  function quorumOf(source: string): string[] {
    const line = source.split('\n').find((l) => l.includes('!prefs.') && l.includes('&&'));
    expect(line, 'no mute condition found — has the idiom changed?').toBeTruthy();
    return [...line!.matchAll(/!prefs\.(\w+)/g)].map((m) => m[1]);
  }

  const mailerQuorum = quorumOf(mailer);

  it('reads a real quorum, so a rename cannot empty this into a pass', () => {
    expect(mailerQuorum.length).toBeGreaterThan(1);
  });

  it('is the same set in the mailer and in fan mail', () => {
    expect(quorumOf(fanMail).slice().sort()).toEqual(mailerQuorum.slice().sort());
  });

  it.each(mailerQuorum)('%s is a switch the member can reach in Settings', (field) => {
    expect(settings).toContain(`prefs.${field}`);
  });

  it('does not count journalPosts, which has no row and no sender', () => {
    expect(mailerQuorum).not.toContain('journalPosts');
    expect(settings).not.toContain('journalPosts');
  });
});
