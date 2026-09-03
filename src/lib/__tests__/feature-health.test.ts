import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  JOURNEYS,
  exitCodeFor,
  itemKey,
  orphanKeys,
  renderBoard,
  rollUp,
  unknownKeys,
  type ItemResult,
} from '../feature-health';

const WALK = path.join(process.cwd(), 'scripts/alpha-acceptance-walk.mts');

/**
 * Item names as the walk itself declares them.
 *
 * Read from the source rather than restated here: a second copy of the list is
 * a second thing to forget to update, and the whole point of these two tests is
 * that the mapping cannot drift away from the walk silently.
 */
function walkItemNames(): string[] {
  const source = readFileSync(WALK, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return [...source.matchAll(/await item\('([^']+)'/g)].map((m) => m[1]);
}

describe('itemKey', () => {
  it('takes the leading token, not the prose', () => {
    expect(itemKey('1b. A second member with the same display name can sign up')).toBe('1b');
    expect(itemKey('16 + 31. Sell a ticket (with a HYPE-link promoter attached)')).toBe('16 + 31');
    expect(itemKey('Replay: the same Stripe event twice issues one ticket')).toBe('Replay');
    expect(itemKey('H3. A referral rewards the referrer once')).toBe('H3');
  });

  it('survives an item being reworded but not renumbered', () => {
    expect(itemKey('7. Upload song (real 4.7 MB m4a)')).toBe(itemKey('7. Upload a song, any format'));
  });
});

describe('the mapping matches the walk, in both directions', () => {
  /*
   * Direction 1. A new walk item that nobody attributed is INVISIBLE on the
   * board — it runs, it can fail, and the health summary never mentions the
   * experience it belongs to. That is the same shape as a component with a
   * live route and no page rendering it, which is why `audit:mounts` exists.
   */
  it('every walk item belongs to at least one journey', () => {
    const names = walkItemNames();
    expect(names.length).toBeGreaterThan(30);

    const results: ItemResult[] = names.map((item) => ({ item, status: 'PASS', detail: '' }));
    expect(orphanKeys(results)).toEqual([]);
  });

  /*
   * Direction 2. A journey naming an item that no longer exists claims
   * coverage it does not have, and reads as HEALTHY on an empty set — the
   * worst possible failure for a board whose job is to be believed.
   */
  it('every mapped key names a real walk item', () => {
    expect(unknownKeys(walkItemNames())).toEqual([]);
  });

  it('journey ids are unique', () => {
    const ids = JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a journey with no items explains what would prove it', () => {
    for (const journey of JOURNEYS.filter((j) => j.keys.length === 0)) {
      expect(
        Boolean(journey.toProve) || Boolean(journey.provenElsewhere),
        `journey "${journey.id}" has no items and says nothing about how to get some`,
      ).toBe(true);
    }
  });
});

describe('rollUp', () => {
  const results = (rows: Array<[string, ItemResult['status']]>): ItemResult[] =>
    rows.map(([item, status]) => ({ item, status, detail: status === 'FAIL' ? 'boom' : '' }));

  const stateOf = (health: ReturnType<typeof rollUp>, id: string) =>
    health.find((h) => h.journey.id === id)?.state;

  it('all passing is HEALTHY', () => {
    const health = rollUp(results([
      ['1. Create a user', 'PASS'],
      ['1b. Dup name', 'PASS'],
      ['1c. Accents', 'PASS'],
      ['3. Login', 'PASS'],
    ]));
    expect(stateOf(health, 'join')).toBe('HEALTHY');
  });

  it('one failure is BROKEN even when the rest passed', () => {
    const health = rollUp(results([
      ['1. Create a user', 'PASS'],
      ['3. Login', 'FAIL'],
    ]));
    expect(stateOf(health, 'join')).toBe('BROKEN');
    expect(exitCodeFor(health)).toBe(1);
  });

  /* The nightly's standing condition with no Stripe key. It must not read as
     healthy, and it must not fail the build. */
  it('everything blocked is UNPROVEN, and does not fail the build', () => {
    const health = rollUp(results([
      ['16 + 31. Sell a ticket', 'BLOCKED'],
      ['19. Scan the ticket QR', 'BLOCKED'],
      ['Replay: one event twice', 'BLOCKED'],
      ['22b. A closed sale is refused', 'BLOCKED'],
    ]));
    expect(stateOf(health, 'ticketing')).toBe('UNPROVEN');
    expect(exitCodeFor(health)).toBe(0);
  });

  it('a journey with no items at all is UNCOVERED, never HEALTHY', () => {
    const health = rollUp([]);
    expect(stateOf(health, 'search')).toBe('UNCOVERED');
    expect(stateOf(health, 'offline-ticket')).toBe('UNCOVERED');
    /* An empty run must not paint a covered journey green either. */
    expect(stateOf(health, 'join')).toBe('UNPROVEN');
    expect(exitCodeFor(health)).toBe(0);
  });

  it('one item can speak for two journeys', () => {
    const health = rollUp(results([['16 + 31. Sell a ticket', 'FAIL']]));
    expect(stateOf(health, 'ticketing')).toBe('BROKEN');
    expect(stateOf(health, 'payouts')).toBe('BROKEN');
  });

  /*
   * The bug the first draft shipped with. Advertising passed the two items
   * that read, and blocked the four that authorize, air and settle a paid
   * spot — so the board said OK while nobody could actually buy one.
   */
  it('a half-run journey is PARTIAL, never HEALTHY', () => {
    const health = rollUp(results([
      ['20. Create an advertising campaign', 'PASS'],
      ['22. Listen to an ad', 'PASS'],
      ['20b. The hold authorizes', 'BLOCKED'],
      ['20c. The spot reaches a listener', 'BLOCKED'],
      ['20d. Settlement captures the spend', 'BLOCKED'],
      ['33. A paid spot airs on the station', 'BLOCKED'],
    ]));
    const ads = health.find((h) => h.journey.id === 'advertising');
    expect(ads?.state).toBe('PARTIAL');
    expect(exitCodeFor(health)).toBe(0);
  });

  it('an item the run never reported counts as unproven, not as a pass', () => {
    /* join names four items; report only one. */
    const health = rollUp(results([['1. Create a user', 'PASS']]));
    const join = health.find((h) => h.journey.id === 'join');
    expect(join?.state).toBe('PARTIAL');
    expect(join?.missing).toEqual(['1b', '1c', '3']);
  });

  it('HEALTHY requires every item to have run', () => {
    const health = rollUp(results([
      ['1. Create a user', 'PASS'],
      ['1b. Dup name', 'PASS'],
      ['1c. Accents', 'PASS'],
      ['3. Login', 'PASS'],
    ]));
    expect(health.find((h) => h.journey.id === 'join')?.state).toBe('HEALTHY');
  });
});

describe('renderBoard', () => {
  it('names the broken experience and the failing item', () => {
    const board = renderBoard(rollUp([
      { item: '3. Login', status: 'FAIL', detail: 'answered 401' },
    ]));
    expect(board).toContain('Sign up and get in');
    expect(board).toContain('answered 401');
    expect(board).toContain('BROKEN — a member could do this and now cannot');
  });

  it('says what would prove an unproven journey, and names what did not run', () => {
    const board = renderBoard(rollUp([
      { item: '28. Update payment method', status: 'BLOCKED', detail: 'no key' },
    ]));
    expect(board).toContain('STRIPE_TEST_SECRET_KEY');
    expect(board).toContain('unproven: 28. Update payment method');
  });

  it('lists the uncovered journeys rather than omitting them', () => {
    const board = renderBoard(rollUp([]));
    expect(board).toContain('UNCOVERED');
    expect(board).toContain('A ticket opens at the door with no signal');
    /* Covered elsewhere is reported as such, not as a gap. */
    expect(board).toContain('e2e/passkey.spec.ts');
  });
});
