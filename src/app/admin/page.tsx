import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminReportActions, AdminVerificationActions } from '@/components/AdminModerationActions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getHealthSnapshot } from '@/lib/health';
import { isR2MediaStorageConfigured } from '@/lib/media-storage';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { isAdminSession } from '@/lib/permissions';
import { areDemoLoginsEnabled, isInviteCodeRequired, shouldHideDemoContent } from '@/lib/runtime-flags';

export const metadata: Metadata = {
  title: 'Admin Beta Console | iHYPE.org',
  robots: { index: false, follow: false }
};

function statusLabel(value: boolean) {
  return value ? 'Enabled' : 'Off';
}

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (!isAdminSession(session)) {
    redirect('/auth/landing');
  }

  const [
    userCount,
    profileCount,
    pendingVerificationCount,
    openReportCount,
    openSupportCount,
    mediaCount,
    ticketOrderCount,
    recentReports,
    recentSupport,
    pendingVerifications,
    recentEmails,
    recentAudits,
    recentUsers,
    health
  ] = await Promise.all([
    db.user.count(),
    db.profile.count(),
    db.profile.count({ where: { verificationStatus: 'PENDING' } }),
    db.contentReport.count({ where: { status: 'OPEN' } }),
    db.supportRequest.count({ where: { status: 'OPEN' } }),
    db.artistMediaAsset.count(),
    db.ticketOrder.count(),
    db.contentReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { reporter: { select: { email: true, username: true } } }
    }),
    db.supportRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    db.profile.findMany({
      where: { verificationStatus: 'PENDING' },
      orderBy: { verificationSubmittedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        type: true,
        contactInfo: true,
        verificationNotes: true,
        verificationSubmittedAt: true
      }
    }),
    db.emailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { actor: { select: { email: true, username: true } } }
    }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { email: true, username: true, role: true, createdAt: true }
    }),
    getHealthSnapshot()
  ]);

  const featureFlags = [
    ['Demo logins', areDemoLoginsEnabled()],
    ['Invite-only signup', isInviteCodeRequired()],
    ['Hide demo content', shouldHideDemoContent()],
    ['R2 media storage', isR2MediaStorageConfigured()],
    ['Ticket payment capture', isPaymentProcessingConfigured()]
  ] as const;
  const healthOperations = health.status === 'ok' ? health.operations : null;
  const healthIntegrations = health.status === 'ok' ? health.integrations : null;

  return (
    <main className="container section admin-console">
      <section className="panel admin-console-hero">
        <div>
          <div className="badge">Admin beta console</div>
          <h1>Trust, launch, and support signals</h1>
          <p className="subtitle">
            One place to watch account growth, verification, email/MFA delivery, reports, tickets, media, and audit
            events during beta.
          </p>
        </div>
        <div className="cta-row">
          <Link className="button secondary" href="/transparency">
            Transparency
          </Link>
          <Link className="button secondary" href="/about">
            About iHYPE
          </Link>
        </div>
      </section>

      <section className="admin-metric-grid">
        {[
          ['Users', userCount],
          ['Profiles', profileCount],
          ['Pending verification', pendingVerificationCount],
          ['Open reports', openReportCount],
          ['Support requests', openSupportCount],
          ['Media assets', mediaCount],
          ['Ticket orders', ticketOrderCount]
        ].map(([label, value]) => (
          <article className="card admin-metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>QA role perspectives</h2>
            <p className="meta">
              Switch from the header or open a role lane directly to verify the signed-in experience.
            </p>
          </div>
        </div>
        <div className="admin-export-row" aria-label="Admin QA role views">
          <Link className="button small secondary" href="/fans?module=tool-hub">
            Fan QA
          </Link>
          <Link className="button small secondary" href="/artists?module=tool-hub">
            Artist QA
          </Link>
          <Link className="button small secondary" href="/promoters?module=tool-hub">
            Promoter QA
          </Link>
          <Link className="button small secondary" href="/venues?module=tool-hub">
            Venue QA
          </Link>
        </div>
      </section>

      <section className="panel admin-console-panel admin-health-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Launch health</h2>
            <p className="meta">
              Public uptime endpoint: <Link className="text-link" href="/api/health">/api/health</Link>
            </p>
          </div>
          <strong className={health.status === 'ok' ? 'admin-health-status ok' : 'admin-health-status warn'}>
            {health.status}
          </strong>
        </div>
        <div className="admin-health-grid">
          <div className="admin-health-card">
            <span>DB latency</span>
            <strong>{health.latencyMs}ms</strong>
          </div>
          <div className="admin-health-card">
            <span>Failed email 24h</span>
            <strong>{healthOperations ? healthOperations.failedEmails24h : 'n/a'}</strong>
          </div>
          <div className="admin-health-card">
            <span>Reserved tickets</span>
            <strong>{healthOperations ? healthOperations.reservedTicketOrders : 'n/a'}</strong>
          </div>
          <div className="admin-health-card">
            <span>Payment capture</span>
            <strong>{healthIntegrations?.ticketPaymentCapture ? 'Ready' : 'Blocked'}</strong>
          </div>
        </div>
      </section>

      <section className="grid grid-2 admin-console-grid">
        <article className="panel admin-console-panel">
          <h2>Feature flags</h2>
          <div className="admin-export-row" aria-label="Admin CSV exports">
            {(['reports', 'support', 'verifications', 'tickets', 'audits'] as const).map((kind) => (
              <Link className="button small secondary" href={`/api/admin/export/${kind}`} key={kind}>
                Export {kind}
              </Link>
            ))}
          </div>
          <div className="admin-list">
            {featureFlags.map(([label, value]) => (
              <div className="admin-list-row" key={label}>
                <span>{label}</span>
                <strong>{statusLabel(value)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Recent users</h2>
          <div className="admin-list">
            {recentUsers.map((user) => (
              <div className="admin-list-row" key={user.email}>
                <span>{user.username || user.email}</span>
                <strong>{user.role}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Content reports</h2>
          <div className="admin-list">
            {recentReports.length ? (
              recentReports.map((report) => (
                <div className="admin-list-row" key={report.id}>
                  <span>{report.reason}</span>
                  <strong>{report.status}</strong>
                  <small>
                    {report.targetType}:{report.targetId} by {report.reporter?.username ?? report.reporter?.email ?? 'unknown'}
                  </small>
                  <AdminReportActions reportId={report.id} />
                </div>
              ))
            ) : (
              <div className="empty">No reports yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Support requests</h2>
          <div className="admin-list">
            {recentSupport.length ? (
              recentSupport.map((request) => (
                <div className="admin-list-row" key={request.id}>
                  <span>{request.subject}</span>
                  <strong>{request.priority}</strong>
                  <small>
                    {request.type} | {request.status} | {request.email ?? request.name ?? 'anonymous'}
                  </small>
                </div>
              ))
            ) : (
              <div className="empty">No support requests yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Verification queue</h2>
          <div className="admin-list">
            {pendingVerifications.length ? (
              pendingVerifications.map((profile) => (
                <div className="admin-list-row" key={profile.id}>
                  <span>{profile.name}</span>
                  <strong>{profile.type === 'DJ' ? 'PROMOTER' : profile.type}</strong>
                  <small>{profile.contactInfo || profile.verificationNotes || 'No details provided'}</small>
                  <AdminVerificationActions profileId={profile.id} />
                </div>
              ))
            ) : (
              <div className="empty">No pending verification requests.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Email/MFA delivery</h2>
          <div className="admin-list">
            {recentEmails.length ? (
              recentEmails.map((email) => (
                <div className="admin-list-row" key={email.id}>
                  <span>{email.type}</span>
                  <strong>{email.status}</strong>
                  <small>{email.recipient}</small>
                </div>
              ))
            ) : (
              <div className="empty">No email delivery records yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel admin-console-panel-wide">
          <h2>Audit log</h2>
          <div className="admin-list">
            {recentAudits.length ? (
              recentAudits.map((audit) => (
                <div className="admin-list-row" key={audit.id}>
                  <span>{audit.action}</span>
                  <strong>{audit.entityType}</strong>
                  <small>{audit.actor?.username ?? audit.actor?.email ?? 'system'} | {audit.entityId ?? 'no id'}</small>
                </div>
              ))
            ) : (
              <div className="empty">No audit events yet.</div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
