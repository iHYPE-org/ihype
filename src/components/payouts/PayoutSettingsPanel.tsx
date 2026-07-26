import Link from 'next/link';
import { getProfilePathForType } from '@/lib/profile-paths';
import { PayoutConnectButton } from '@/components/PayoutConnectButton';

type SettingsProfile = {
  id: string;
  slug: string;
  type: string;
  name: string;
  stripeConnectAccountId: string | null;
  stripeConnectOnboarded: boolean;
};

function roleLabel(type: string) {
  if (type === 'DJ') return 'Promoter/DJ';
  if (type === 'VENUE') return 'Venue';
  return 'Artist';
}

/** Extracted verbatim from the former standalone `/me/payout-settings` page (DESIGN_SYNC row 245), now reused from the `/payouts` tabbed hub. Its "deliberately omitted" notes (multi-account, payout schedule, email toggle) still apply — see the original page's history in DESIGN_SYNC.md. */
export function PayoutSettingsPanel({ profiles, stripeReady }: { profiles: SettingsProfile[]; stripeReady: boolean }) {
  return (
    <div className="pset-panel">
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

      <style>{`
        .pset-panel { max-width: 640px; }
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
        .pset-note { padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--bg2); margin-bottom: 0; }
        .pset-note-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 4px; }
        .pset-note p { font-size: 12.5px; color: var(--ink-a60); line-height: 1.6; margin: 0; }
      `}</style>
    </div>
  );
}
