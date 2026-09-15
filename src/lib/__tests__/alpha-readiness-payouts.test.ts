import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';
import { buildAlphaBlockers } from '@/lib/alpha-readiness';

/*
 * THE READINESS GATE HAD NO PAYOUT CONDITION AT ALL — not blocking, not
 * reported — on a product whose charter promise is that 70% of a ticket
 * reaches the act. The payload could read fully ready with every payee
 * unreachable.
 *
 * It is REPORTED, and `alphaReadiness.content` is the precedent rather than an
 * analogy: the playable-track count sits there for exactly this reason after
 * the owner ruled that the doors do not wait for uploads. A blocking condition
 * here would be red from the first day at an invite-only alpha where no venue
 * has finished onboarding — a reason nobody can clear today — and this
 * repository has twice recorded what a permanently-red check does to the
 * instruments behind it.
 *
 * So the guard is stated as the pair: health reports the figure, and
 * `buildAlphaBlockers` never sees it.
 */

const health = maskComments(fs.readFileSync(path.join(process.cwd(), 'src/lib/health.ts'), 'utf8'));
const readiness = maskComments(fs.readFileSync(path.join(process.cwd(), 'src/lib/alpha-readiness.ts'), 'utf8'));

describe('payout reachability is reported in alphaReadiness and never gates it', () => {
  it('health reads the figure and puts it in the readiness payload', () => {
    expect(health).toContain('getUnpayableBalance');
    const at = health.indexOf('alphaReadiness: {');
    expect(at, 'alphaReadiness payload not found').toBeGreaterThan(0);
    expect(health.slice(at, at + 900)).toContain('payouts');
  });

  it('buildAlphaBlockers cannot see it, so it can never become a blocker', () => {
    /* Masked, because the comment above the call explains why this input is
       withheld and names it — a scanner that reads its own documentation is
       the failure this repository has now shipped four times. */
    expect(readiness).not.toContain('unpayable');
    expect(readiness).not.toContain('getUnpayableBalance');
    expect(readiness).not.toContain('stripeConnect');
  });

  it('an unreachable payee is still not a blocker at the function level', () => {
    /* The strongest form of the rule: even called with everything else ready,
       nothing about payouts can appear in the list, because the parameter
       does not exist. */
    const blockers = buildAlphaBlockers({
      administrators: 2,
      discoverableArtists: 99,
      discoverableVenues: 99,
      upcomingEvents: 99,
      inviteOnlySignup: true,
      restoreDrillReady: true,
    });
    expect(blockers.join(' ').toLowerCase()).not.toContain('payout');
  });
});
