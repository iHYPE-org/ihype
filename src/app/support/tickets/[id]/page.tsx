import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Ticket · Support · iHYPE',
    robots: { index: false, follow: false },
  };
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'var(--role-promoter, #ffb84a)',
  PENDING: '#22e5d4',
  RESOLVED: 'var(--ink-a50)',
  CLOSED: 'var(--ink-a50)',
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? 'var(--ink-a50)';
}

function fmtDateTime(d: Date) {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * A single support ticket, owner-only. The approved design template
 * (templates/support-ticket-detail/SupportTicketDetail.dc.html) depicts an
 * admin reviewing a ticket with a reply thread and composer — this schema
 * has no message/reply model on SupportRequest, so this page shows only the
 * real fields that exist: subject, details, status, priority, and
 * created/updated timestamps. Layout/typography borrowed from that template
 * (back link, subject + status pill, mono meta line, message card).
 */
export default async function SupportTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/support/tickets/${id}`);
  }

  const ticket = await db.supportRequest.findUnique({
    where: { id },
    select: {
      id: true, requesterUserId: true, type: true, subject: true, details: true,
      status: true, priority: true, createdAt: true, updatedAt: true,
    },
  });

  if (!ticket || ticket.requesterUserId !== session.user.id) {
    return notFound();
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 100px' }}>
      <Link
        href="/support/tickets"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
          fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)',
          textDecoration: 'none', marginBottom: 18,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to My Tickets
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', margin: 0, color: 'var(--ink)' }}>
          {ticket.subject}
        </h1>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)',
          fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: statusColor(ticket.status),
          border: `1px solid ${statusColor(ticket.status)}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(ticket.status), display: 'inline-block' }} />
          {ticket.status}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'var(--ink-a50)', marginBottom: 28,
      }}>
        {ticket.type} · {ticket.priority} priority · Opened {fmtDateTime(ticket.createdAt)}
      </div>

      <div style={{
        border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', background: 'var(--bg2)',
        padding: '16px 18px', marginBottom: 20,
      }}>
        <p style={{ fontSize: 13.5, color: 'var(--ink-a85)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
          {ticket.details}
        </p>
      </div>

      <div style={{
        padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg2)',
        border: '1px solid var(--line)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-a50)' }}>
          Last updated {fmtDateTime(ticket.updatedAt)}. We reply within 24h.
        </div>
      </div>
    </div>
  );
}
