import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getPromoterDashboard } from '@/lib/promoterDashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { PromoteShareButton } from '@/components/PromoteShareButton';
import { getBaseUrl } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Promoter Dashboard · iHYPE',
  description: 'Your HYPE Link, click stats, and 10% pool earnings.',
  robots: { index: false, follow: false },
};

function fmtDate(iso: string | null): string {
  if (!iso) return 'TBD';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function PromotePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/me/promote');
  }

  const d = await getPromoterDashboard(session.user.id);
  const baseUrl = getBaseUrl();

  return (
    <div className="promo-page">
      <div className="promo-page-header">
        <h1>Promoter Dashboard</h1>
        <p>Your HYPE Link, click stats, and 10% pool earnings</p>
      </div>

      <div className="promo-stats-grid">
        <div className="promo-stat-card">
          <div className="promo-stat-label">Total Earned</div>
          <div className="promo-stat-value">{formatCurrencyFromCents(d.earnedCents)}</div>
          <div className="promo-stat-sub">Pending settlement · {d.ordersDriven} order{d.ordersDriven === 1 ? '' : 's'}</div>
        </div>
        <div className="promo-stat-card">
          <div className="promo-stat-label">Gate Driven</div>
          <div className="promo-stat-value">{formatCurrencyFromCents(d.grossRevenueCents)}</div>
          <div className="promo-stat-sub">Total ticket revenue via your link</div>
        </div>
        <div className="promo-stat-card">
          <div className="promo-stat-label">HYPE Link Clicks</div>
          <div className="promo-stat-value">{d.clicks.toLocaleString()}</div>
          <div className="promo-stat-sub">Lifetime clicks</div>
        </div>
        <div className="promo-stat-card">
          <div className="promo-stat-label">Tickets Driven</div>
          <div className="promo-stat-value">{d.ticketsSold.toLocaleString()}</div>
          <div className="promo-stat-sub">Across all events</div>
        </div>
      </div>

      {d.refHexId ? (
        <div className="promo-referral-box">
          <div className="promo-referral-label">Your HYPE Link</div>
          <div className="promo-referral-url">{`${baseUrl}/h/${d.refHexId}`}</div>
          <PromoteShareButton link={`${baseUrl}/h/${d.refHexId}`} slug="referral" title="iHYPE" />
          <p className="promo-split-explainer">
            Your HYPE Link is your unique fan ID. When someone buys a ticket through it, you earn a proportional share of the 10% promoter pool — based on how much of the total gate your HYPE Link drove.
          </p>
        </div>
      ) : (
        <div className="promo-referral-box">
          <div className="promo-referral-label">Your HYPE Link</div>
          <p className="promo-split-explainer" style={{ margin: 0 }}>Create a page to get your HYPE Link.</p>
        </div>
      )}

      <div className="promo-section">
        <div className="promo-section-title">Shows you can promote</div>
        {d.shows.length === 0 ? (
          <div className="promo-empty">
            <p>No upcoming ticketed shows to promote right now.</p>
            <Link className="promo-cta" href="/discover">Browse the scene</Link>
          </div>
        ) : (
          d.shows.map((s) => (
            <div className="promo-event-row" key={s.slug}>
              <div>
                <h3><Link href={`/shows/${s.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{s.title}</Link></h3>
                <p>{fmtDate(s.startsAt)}{s.venueName ? ` · ${s.venueName}` : ''} · {s.promoterPayoutPercent}% pool</p>
              </div>
              <PromoteShareButton link={s.promoLink} slug={s.slug} title={s.title} />
            </div>
          ))
        )}
      </div>

      <p className="promo-foot">
        Earnings settle to your payout account once it&apos;s connected. Splits are locked at 45% artist / 45% venue / 10% promoters.
      </p>

      <style>{`
        .promo-page { max-width: 1000px; margin: 0 auto; padding: 32px 24px 100px; }
        .promo-page-header { margin-bottom: 40px; }
        .promo-page-header h1 { font-family: var(--font-display); font-size: 32px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 6px; color: var(--ink); }
        .promo-page-header p { font-size: 14px; color: var(--ink-a70); }
        .promo-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 20px; margin-bottom: 40px; }
        .promo-stat-card { border: 1px solid var(--line); border-radius: 10px; padding: 24px; background: var(--bg2); }
        .promo-stat-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a55); margin-bottom: 8px; }
        .promo-stat-value { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--role-promoter, #ff3e9a); }
        .promo-stat-sub { font-size: 12px; color: var(--ink-a50); margin-top: 4px; }
        .promo-referral-box { border: 1px solid rgba(255,62,154,.3); border-radius: 12px; padding: 28px; background: rgba(255,62,154,.06); margin-bottom: 32px; }
        .promo-referral-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--role-promoter, #ff3e9a); margin-bottom: 12px; }
        .promo-referral-url { font-family: var(--font-mono); font-size: 14px; color: var(--ink); background: var(--bg); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; word-break: break-all; }
        .promo-split-explainer { font-size: 13px; color: var(--ink-a60); margin-top: 12px; line-height: 1.6; }
        .promo-section { margin-bottom: 32px; }
        .promo-section-title { font-family: var(--font-display); font-size: 20px; font-weight: 800; margin-bottom: 20px; color: var(--ink); }
        .promo-event-row { border: 1px solid var(--line); border-radius: 10px; padding: 20px; background: var(--bg2); display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 12px; flex-wrap: wrap; }
        .promo-event-row h3 { font-family: var(--font-display); font-size: 15px; font-weight: 800; margin-bottom: 4px; color: var(--ink); }
        .promo-event-row p { font-size: 12px; color: var(--ink-a60); }
        .promo-cta { flex-shrink: 0; font-family: var(--font-body); font-weight: 600; font-size: 14px; padding: 10px 18px; border-radius: 9999px; border: none; cursor: pointer; background: linear-gradient(135deg, #ff5029, #ff3e6e); color: #fff; text-decoration: none; display: inline-block; }
        .promo-empty { text-align: center; padding: 24px; background: var(--bg2); border: 1px solid var(--line); border-radius: 10px; }
        .promo-empty p { color: var(--ink-a60); margin: 0 0 14px; }
        .promo-foot { font-size: 12px; color: var(--ink-a50); text-align: center; margin-top: 28px; line-height: 1.6; }
      `}</style>
    </div>
  );
}
