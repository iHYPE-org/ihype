import Link from 'next/link';
import { getLocale, getT } from '@/lib/i18n/server';

type ShowRow = { id: string; slug: string; title: string; status: string; startsAt: Date; isTicketed: boolean };

/**
 * "This show" tab — DESIGN_SYNC row 245's real translation choice: rather
 * than duplicate `/payout/[id]`'s per-event breakdown inline (it needs a
 * specific show id the hub itself has no way to know without a link),
 * this lists the real shows the user created and links each into the
 * existing, unchanged `/payout/[id]` page for the full breakdown.
 */
export async function PayoutShowsPanel({ shows }: { shows: ShowRow[] }) {
  const t = getT(await getLocale());

  if (shows.length === 0) {
    return <p className="meta">{t('payoutShowsPanel.noShowsYet', "You haven't created any shows yet.")}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="meta" style={{ marginBottom: 8 }}>{t('payoutShowsPanel.pickShowPrompt', 'Pick a show to see its full 70/20/10 payout breakdown.')}</p>
      {shows.map((s) => (
        <Link
          className="panel"
          href={`/payout/${s.slug}`}
          key={s.id}
          style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{s.title}</div>
            <div className="meta">{new Date(s.startsAt).toLocaleDateString()} · {s.status}{!s.isTicketed ? ` · ${t('payoutShowsPanel.notTicketed', 'not ticketed')}` : ''}</div>
          </div>
          <div className="meta">{t('payoutShowsPanel.view', 'View →')}</div>
        </Link>
      ))}
    </div>
  );
}
