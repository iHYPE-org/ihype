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
    /* The sub-page header is `.mmm-document` — a chevron-and-word back link,
       a mono eyebrow, an h1 (2026-09-11, owner: the support bubble "doesn't
       fit design scheme here … see #2 for standard"). This page had written
       its own out of ~30 inline properties, ending in a teal pill that read
       SUPPORT beside the back link: a status treatment used as a breadcrumb,
       in the one role colour that means VENUE. The eyebrow is where a
       breadcrumb goes, and it costs no new class. */
    <article className="mmm-document">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ {tr('mmmLegal.backToInfo', 'Info')}</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{tr('supportTicketsPage.crumb', 'Me · Info · Support')}</p>
        <h1>{tr('supportTicketsPage.title', 'My tickets')}</h1>
        <p>{tr('supportTicketsPage.intro', "Every support request you've sent us, and where it stands.")}</p>
      </header>

      <SupportTicketComposer />

      {tickets.length === 0 ? (
        <div style={{
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', background: 'var(--bg2)',
          padding: '30px 24px', textAlign: 'center', color: 'var(--ink-a65)', fontSize: '0.9375rem',
        }}>
          {/* The composer is directly above, so this said "Contact support" and
              linked out of the shell to the legacy /support page — a one-way
              door out of MMM to reach a form already on this screen. */}
          {tr('supportTicketsPage.emptyState', "You haven't sent us anything yet. Use the form above and it will appear here.")}
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
                  fontSize: '0.9375rem', letterSpacing: '.08em', textTransform: 'uppercase', color: statusColor(t.status),
                  border: `1px solid ${statusColor(t.status)}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(t.status), display: 'inline-block' }} />
                  {t.status}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a65)' }}>
                {t.type} · {t.priority} {tr('supportTicketsPage.priorityLabel', 'priority')} · {tr('supportTicketsPage.openedLabel', 'Opened')} {fmtDate(t.createdAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
