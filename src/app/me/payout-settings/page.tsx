import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isStripeConfigured } from '@/lib/stripe';
import { getProfilePathForType } from '@/lib/profile-paths';
import { PayoutConnectButton } from '@/components/PayoutConnectButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payout Settings · iHYPE',
  robots: { index: false, follow: false },
};

function roleLabel(type: string) {
  if (type === 'DJ') return 'Promoter/DJ';
  if (type === 'VENUE') return 'Venue';
  return 'Artist';
}

/**
 * Real Payout Settings page — per owned creator profile (a user can own more
 * than one, e.g. both an ARTIST and a DJ profile), shows the real
 * Profile.stripeConnectAccountId (masked/truncated) and the real
 * Profile.stripeConnectOnboarded boolean, with a Connect/Reconnect button
 * that drives the actual Stripe Connect Express onboarding flow
 * (POST /api/stripe/connect/onboard -> real onboardingUrl).
 *
 * Deliberately omitted vs. the design mock (no real backing in this codebase
 * — see CLAUDE.md/task instructions, not fabricated here):
 *  - "Add another account" (multiple bank accounts per profile) — Stripe
 *    Connect wiring here is one Connect account per profile, no multi-account
 *    support exists anywhere in schema or API.
 *  - "Payout Schedule" (automatic vs. weekly-batch) — payouts already run
 *    automatically via the real triggerShowPayouts cron (src/lib/show-payouts.ts)
 *    with no batching option; a schedule selector would be decorative.
 *  - "Email me on payout" toggle — the payout cron already unconditionally
 *    emails the recipient on every real transfer; there is no per-user toggle
 *    for this today, and wiring one is out of scope for this page.
 */
export default async function PayoutSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/me/payout-settings');
  }

  const profiles = await db.profile.findMany({
    where: { ownerId: session.user.id, type: { in: ['ARTIST', 'DJ', 'VENUE'] } },
    select: {
      id: true,
      slug: true,
      type: true,
      name: true,
      stripeConnectAccountId: true,
      stripeConnectOnboarded: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const stripeReady = isStripeConfigured();

  return (
    <div className="pset-page">
      <h1 className="pset-title">Payout Settings</h1>
      <p className="pset-sub">Your share is paid out automatically after each show, split 70% artist / 20% venue / 10% promoters per the charter.</p>

      {!stripeReady && (
        <div className="pset-warn">Payments are not configured on this server right now — connecting accounts is temporarily unavailable.</div>
      )}

      {profiles.length === 0 ? (
        <div className="pset-empty">
          <p>You don&apos;t have an artist, DJ, or venue profile yet — payout accounts connect to those profile types.</p>
          <Link href="/pages">Create a profile →</Link>
        </div>
      ) : (
        <div className="pset-list">
          {profiles.map((p) => (
            <div className="pset-card" key={p.id}>
              <div className="pset-card-top">
                <div>
                  <div className="pset-name">{p.name}</div>
                  <div className="pset-role">{roleLabel(p.type)} · <Link href={getProfilePathForType(p.type, p.slug)}>view profile</Link></div>
                </div>
                <span className={`pset-pill ${p.stripeConnectOnboarded ? 'pset-pill-on' : 'pset-pill-off'}`}>
                  {p.stripeConnectOnboarded ? 'Verified' : 'Not yet connected'}
                </span>
              </div>

              <div className="pset-account-row">
                <div className="pset-account-icon" aria-hidden>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                </div>
                <div className="pset-account-info">
                  {p.stripeConnectAccountId ? (
                    <>
                      <div className="pset-account-label">Connected via Stripe Connect</div>
                      <div className="pset-account-id">{p.stripeConnectAccountId.slice(0, 9)}···{p.stripeConnectAccountId.slice(-4)}</div>
                    </>
                  ) : (
                    <div className="pset-account-label">No payout account connected yet</div>
                  )}
                </div>
                {stripeReady && (
                  <PayoutConnectButton
                    profileId={p.id}
                    label={p.stripeConnectOnboarded ? 'Reconnect' : p.stripeConnectAccountId ? 'Finish setup' : 'Connect'}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pset-note">
        <div className="pset-note-label">Payment processing (Stripe) — iHYPE&apos;s only fee</div>
        <p>2.9% + $0.30 per ticket (3.5% + $0.30 for Amex), charged by Stripe — not by iHYPE. iHYPE still takes 0% of the ticket price itself.</p>
      </div>

      <p className="pset-foot"><Link href="/me/payouts">View payout history →</Link></p>

      <style>{`
        .pset-page { max-width: 640px; margin: 0 auto; padding: 32px 24px 100px; }
        .pset-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 8px; color: var(--ink); }
        .pset-sub { font-size: 14px; color: var(--ink-a55); margin: 0 0 28px; }
        .pset-warn { padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--bg2); color: var(--ink-a70); font-size: 13px; margin-bottom: 24px; }
        .pset-empty { text-align: center; padding: 60px 24px; color: var(--ink-a50); }
        .pset-empty a { color: var(--ink-a70); }
        .pset-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; }
        .pset-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 18px 20px; }
        .pset-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
        .pset-name { font-family: var(--font-display); font-weight: 800; font-size: 15px; color: var(--ink); }
        .pset-role { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .pset-role a { color: var(--ink-a55); }
        .pset-pill { flex-shrink: 0; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; padding: 5px 10px; border-radius: var(--radius-pill); }
        .pset-pill-on { background: rgba(34,229,212,.15); color: var(--role-venue, #22e5d4); }
        .pset-pill-off { background: var(--ink-a10, rgba(120,120,120,.15)); color: var(--ink-a55); }
        .pset-account-row { display: flex; align-items: center; gap: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
        .pset-account-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(34,229,212,.12); color: var(--role-venue, #22e5d4); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pset-account-info { flex: 1; min-width: 0; }
        .pset-account-label { font-size: 14px; font-weight: 500; color: var(--ink); }
        .pset-account-id { font-family: var(--font-mono); font-size: 12px; color: var(--ink-a55); margin-top: 3px; }
        .pset-note { padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--bg2); margin-bottom: 20px; }
        .pset-note-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 4px; }
        .pset-note p { font-size: 12.5px; color: var(--ink-a60); line-height: 1.6; margin: 0; }
        .pset-foot { font-size: 13px; }
        .pset-foot a { color: var(--ink-a60); text-decoration: none; }
        .pset-foot a:hover { color: var(--ink); text-decoration: underline; }
      `}</style>
    </div>
  );
}
