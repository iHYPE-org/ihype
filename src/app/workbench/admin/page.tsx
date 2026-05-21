import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { getHealthSnapshot } from '@/lib/health';
import { checkCronHealth } from '@/lib/cron-health';

export const metadata: Metadata = {
  title: 'Admin Console · iHYPE',
  robots: { index: false, follow: false }
};
export const dynamic = 'force-dynamic';

const CRON_JOBS = [
  'digest', 'show-reminders', 'db-health', 'new-to-scene',
  'onboarding', 'feature-shows', 'stripe-connect-health',
  'artist-onboarding', 'show-payouts', 'close-stale-bookings',
  'weekly-picks', 'follow-digest', 'audit-log-rotate',
];

function Dot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#22c55e' : '#ef4444', flexShrink: 0
    }} />
  );
}

function StatCard({ label, value, href, warn }: { label: string; value: number | string; href?: string; warn?: boolean }) {
  const content = (
    <div className="panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: warn && Number(value) > 0 ? '#ef4444' : 'inherit', lineHeight: 1 }}>
        {value}
      </div>
      <div className="meta" style={{ fontSize: '0.75rem' }}>{label}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link> : content;
}

export default async function AdminWorkbenchPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect('/auth/landing');

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    health,
    cronHealth,
    userCount,
    profileCount,
    mediaCount,
    ticketOrderCount,
    newUsers7d,
    usersByRole,
    recentUsers,
    recentAudits,
    recentEmails,
    pendingAds,
    openFeedback,
  ] = await Promise.all([
    getHealthSnapshot(),
    checkCronHealth(),
    db.user.count(),
    db.profile.count(),
    db.artistMediaAsset.count(),
    db.ticketOrder.count(),
    db.user.count({ where: { createdAt: { gte: since7d } } }),
    db.user.groupBy({ by: ['role'], _count: { _all: true } }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { email: true, username: true, role: true, createdAt: true }
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { email: true, username: true } } }
    }),
    db.emailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, type: true, status: true, createdAt: true, recipient: true }
    }),
    db.adSubmission.count({ where: { status: 'pending' } }),
    db.supportRequest.count({ where: { status: 'OPEN' } }),
  ]);

  const roleMap = Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all]));
  const ops = health.status === 'ok' ? health.operations : null;
  const integrations = health.status === 'ok' ? health.integrations : null;
  const safety = health.status === 'ok' ? health.safety : null;
  const latency = health.latencyMs;

  const quickLinks = [
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/verifications', label: 'Verifications' },
    { href: '/admin/moderation', label: 'Moderation' },
    { href: '/admin/audit', label: 'Audit Log' },
    { href: '/admin/broadcast', label: 'Broadcast' },
    { href: '/admin/flagged', label: 'Flagged' },
    { href: '/admin/feedback', label: 'Feedback' },
    { href: '/admin/ads', label: 'Ads' },
    { href: '/admin/journal', label: 'Journal' },
    { href: '/admin/playlists', label: 'Playlists' },
    { href: '/admin/review', label: 'Reviews' },
    { href: '/admin/rate-limits', label: 'Rate Limits' },
  ];

  return (
    <div className="wb-main" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Admin Console</h1>
          <p className="meta" style={{ margin: 0, fontSize: '0.75rem', marginTop: 2 }}>
            {new Date().toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC
            {latency !== undefined && <> · DB {latency}ms</>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Dot ok={health.status === 'ok'} />
          <span className="meta" style={{ fontSize: '0.8rem' }}>
            {health.status === 'ok' ? 'System healthy' : 'System degraded'}
          </span>
        </div>
      </div>

      {/* Ops Queue */}
      <section>
        <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>Operations Queue</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          <StatCard label="Open Reports" value={ops?.openReports ?? '—'} href="/admin/moderation" warn />
          <StatCard label="Support Requests" value={ops?.openSupportRequests ?? openFeedback} href="/admin/feedback" warn />
          <StatCard label="Failed Emails 24h" value={ops?.failedEmails24h ?? '—'} warn />
          <StatCard label="Pending Verifications" value={ops?.pendingVerifications ?? '—'} href="/admin/verifications" warn />
          <StatCard label="Reserved Tickets" value={ops?.reservedTicketOrders ?? '—'} warn />
          <StatCard label="Pending Ads" value={pendingAds} href="/admin/ads" warn />
        </div>
      </section>

      {/* Stats row */}
      <section>
        <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>Platform Stats</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
          <StatCard label="Total Users" value={userCount} href="/admin/users" />
          <StatCard label="New (7d)" value={newUsers7d} href="/admin/users" />
          <StatCard label="Profiles" value={profileCount} />
          <StatCard label="Media Assets" value={mediaCount} />
          <StatCard label="Ticket Orders" value={ticketOrderCount} />
          <StatCard label="Fans" value={roleMap['FAN'] ?? 0} />
          <StatCard label="Artists" value={roleMap['ARTIST'] ?? 0} />
          <StatCard label="DJs" value={roleMap['DJ'] ?? 0} />
          <StatCard label="Venues" value={roleMap['VENUE'] ?? 0} />
        </div>
      </section>

      {/* Cron Health + Integrations + Safety */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>

        {/* Cron Health */}
        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>
            Cron Health
            {cronHealth.stale.length > 0 && (
              <span style={{ marginLeft: 6, color: '#ef4444', fontWeight: 700 }}>{cronHealth.stale.length} stale</span>
            )}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {CRON_JOBS.map((job) => {
              const stale = cronHealth.stale.includes(job);
              return (
                <div key={job} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Dot ok={!stale} />
                  <span style={{ fontSize: '0.8rem', opacity: stale ? 1 : 0.75, color: stale ? '#ef4444' : 'inherit' }}>{job}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Integrations */}
        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>Integrations</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { label: 'Email Delivery', ok: integrations?.emailDelivery ?? false },
              { label: 'SMTP Email', ok: integrations?.smtpEmail ?? false },
              { label: 'Blob Media Storage', ok: integrations?.blobMediaStorage ?? false },
              { label: 'Ticket Payment Capture', ok: integrations?.ticketPaymentCapture ?? false },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dot ok={ok} />
                <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{label}</span>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '1rem 0 0.75rem', opacity: 0.5 }}>Safety Flags</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { label: 'Invite-only signup', ok: safety?.inviteOnlySignup ?? false },
              { label: 'Demo content hidden', ok: safety?.demoContentHidden ?? false },
              { label: 'Demo logins disabled', ok: !(safety?.demoLogins ?? true) },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dot ok={ok} />
                <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{label}</span>
              </div>
            ))}
          </div>

          {health.status === 'ok' && !health.launchReadiness.ready && (
            <>
              <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '1rem 0 0.5rem', opacity: 0.5, color: '#f59e0b' }}>Launch Blockers</h2>
              <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {health.launchReadiness.blockers.map((b) => (
                  <li key={b} style={{ fontSize: '0.75rem', color: '#f59e0b' }}>{b}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Quick Links */}
        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>Quick Links</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {quickLinks.map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: '0.8rem', padding: '5px 8px', background: 'var(--surface-2, rgba(255,255,255,0.05))', borderRadius: 4, textDecoration: 'none', color: 'inherit', opacity: 0.8 }}>
                {label}
              </Link>
            ))}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Link href="/admin" style={{ fontSize: '0.75rem', opacity: 0.5, textDecoration: 'underline', color: 'inherit' }}>
              Legacy admin page →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Users + Emails */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>

        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>Recent Signups</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentUsers.map((u) => (
              <div key={u.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{u.username}</span>
                  {u.email && <span className="meta" style={{ marginLeft: 6, fontSize: '0.7rem' }}>{u.email}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="meta" style={{ fontSize: '0.65rem', background: 'var(--surface-2, rgba(255,255,255,0.07))', padding: '1px 5px', borderRadius: 3 }}>{u.role}</span>
                  <span className="meta" style={{ fontSize: '0.65rem' }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/admin/users" style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.75rem', opacity: 0.5, textDecoration: 'underline', color: 'inherit' }}>View all →</Link>
        </div>

        <div className="panel" style={{ padding: '1rem 1.25rem' }}>
          <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>Recent Emails</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentEmails.map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{e.type}</span>
                  {e.recipient && <span className="meta" style={{ marginLeft: 6, fontSize: '0.7rem' }}>{e.recipient}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Dot ok={e.status !== 'FAILED'} />
                  <span className="meta" style={{ fontSize: '0.65rem' }}>{new Date(e.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {recentEmails.length === 0 && <div className="empty" style={{ fontSize: '0.8rem' }}>No emails logged.</div>}
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="panel" style={{ padding: '1rem 1.25rem' }}>
        <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem', opacity: 0.5 }}>Recent Audit Log</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {recentAudits.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ fontWeight: 500, flexShrink: 0 }}>{a.action}</span>
                {a.entityId && <span className="meta" style={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.entityType} {a.entityId.slice(0, 8)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {a.actor && <span className="meta" style={{ fontSize: '0.65rem' }}>{a.actor.username ?? a.actor.email}</span>}
                <span className="meta" style={{ fontSize: '0.65rem' }}>{new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
        <Link href="/admin/audit" style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.75rem', opacity: 0.5, textDecoration: 'underline', color: 'inherit' }}>View all →</Link>
      </div>

    </div>
  );
}
