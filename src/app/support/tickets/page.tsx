import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Tickets · Support · iHYPE',
  robots: { index: false, follow: false },
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'var(--role-promoter, #ffb84a)',
  PENDING: '#22e5d4',
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
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/support/tickets');
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
          fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)',
          textDecoration: 'none', marginBottom: 18,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Support
      </Link>

      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase',
        letterSpacing: '.14em', color: '#22e5d4', border: '1px solid rgba(34,229,212,.3)',
        background: 'rgba(34,229,212,.07)', borderRadius: 999, padding: '5px 13px', marginBottom: 14,
      }}>
        Support
      </span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-.02em', margin: '18px 0 8px', color: 'var(--ink)' }}>
        My tickets
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ink-a65)', marginBottom: 32 }}>
        Every support request you&apos;ve sent us, and where it stands.
      </p>

      {tickets.length === 0 ? (
        <div style={{
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)',
          padding: '30px 24px', textAlign: 'center', color: 'var(--ink-a65)', fontSize: 13.5,
        }}>
          You haven&apos;t sent us anything yet.{' '}
          <Link href="/support" style={{ color: '#22e5d4' }}>Contact support</Link>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/tickets/${t.id}`}
              style={{
                display: 'block', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg2)', padding: '16px 18px', textDecoration: 'none', color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: '-.01em', color: 'var(--ink)' }}>
                  {t.subject}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)',
                  fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: statusColor(t.status),
                  border: `1px solid ${statusColor(t.status)}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(t.status), display: 'inline-block' }} />
                  {t.status}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>
                {t.type} · {t.priority} priority · Opened {fmtDate(t.createdAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
