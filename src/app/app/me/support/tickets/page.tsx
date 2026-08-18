import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SupportTicketComposer } from '@/components/SupportTicketComposer';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Tickets · Support · iHYPE',
  robots: { index: false, follow: false },
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'var(--warning-text)',
  PENDING: 'var(--success)',
  RESOLVED: 'var(--ink-a50)',
  CLOSED: 'var(--ink-a50)',
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? 'var(--ink-a50)';
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * A signed-in user's own support requests — real SupportRequest rows scoped
 * to requesterUserId, newest first. Distinct from the admin-facing review
 * queue (support-ticket-detail design template assumes a reviewer reading
 * someone else's ticket + a reply thread; there is no reply/message model in
 * this schema, so this page and its detail page only show the single
 * submitted ticket and its status).
 */
export default async function SupportTicketsPage() {
  const tr = await getServerT();
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/app/me/support/tickets');
  }

  const tickets = await db.supportRequest.findMany({
    where: { requesterUserId: session.user.id },
    select: { id: true, subject: true, status: true, priority: true, type: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 100px' }}>
      <Link
        href="/support"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
          fontSize: '0.625rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)',
          textDecoration: 'none', marginBottom: 18,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {tr('supportTicketsPage.backToSupport', 'Back to Support')}
      </Link>

      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', textTransform: 'uppercase',
        letterSpacing: '.14em', color: 'var(--role-venue)', border: '1px solid rgba(var(--role-venue-rgb),.3)',
        background: 'rgba(var(--role-venue-rgb),.07)', borderRadius: 999, padding: '5px 13px', marginBottom: 14,
      }}>
        {tr('supportTicketsPage.badge', 'Support')}
      </span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.02em', margin: '18px 0 8px', color: 'var(--ink)' }}>
        {tr('supportTicketsPage.title', 'My tickets')}
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--ink-a65)', marginBottom: 32 }}>
        {tr('supportTicketsPage.intro', "Every support request you've sent us, and where it stands.")}
      </p>

      <SupportTicketComposer />

      {tickets.length === 0 ? (
        <div style={{
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)',
          padding: '30px 24px', textAlign: 'center', color: 'var(--ink-a65)', fontSize: '0.8438rem',
        }}>
          {tr('supportTicketsPage.emptyState', "You haven't sent us anything yet.")}{' '}
          <Link href="/support" style={{ color: 'var(--role-venue)' }}>{tr('supportTicketsPage.contactSupport', 'Contact support')}</Link>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/app/me/support/tickets/${t.id}`}
              style={{
                display: 'block', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg2)', padding: '16px 18px', textDecoration: 'none', color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-.01em', color: 'var(--ink)' }}>
                  {t.subject}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)',
                  fontSize: '0.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: statusColor(t.status),
                  border: `1px solid ${statusColor(t.status)}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(t.status), display: 'inline-block' }} />
                  {t.status}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6562rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>
                {t.type} · {t.priority} {tr('supportTicketsPage.priorityLabel', 'priority')} · {tr('supportTicketsPage.openedLabel', 'Opened')} {fmtDate(t.createdAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
