import Link from 'next/link';
import { AdminReportActions, AdminVerificationActions } from '@/components/AdminModerationActions';
import { AdminFeatureFlags } from '@/components/AdminFeatureFlags';
import { FeatureToggle } from '@/components/admin/FeatureToggle';

interface FeatureFlag {
  key: string;
  label: string;
  enabled: boolean;
}

interface Props {
  featureFlags: FeatureFlag[];
  recentTicketOrders: Array<{
    id: string;
    status: string;
    buyerEmail: string;
    totalChargeCents: number;
    show: { title: string } | null;
  }>;
  recentShows: Array<{
    id: string;
    title: string;
    featured: boolean;
    startsAt: Date;
    venueProfile: { name: string } | null;
    _count: { tickets: number };
  }>;
  recentUsers: Array<{ email: string | null; username: string; role: string; createdAt: Date }>;
  recentReports: Array<{
    id: string;
    reason: string;
    status: string;
    targetType: string;
    targetId: string;
    reporter: { email: string | null; username: string | null } | null;
  }>;
  recentSupport: Array<{
    id: string;
    subject: string;
    priority: string;
    type: string;
    status: string;
    email: string | null;
    name: string | null;
  }>;
  pendingVerifications: Array<{
    id: string;
    name: string | null;
    type: string;
    contactInfo: string | null;
    verificationNotes: string | null;
  }>;
  recentEmails: Array<{
    id: string;
    type: string;
    status: string;
    recipient: string;
  }>;
  recentAudits: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actor: { email: string | null; username: string | null } | null;
  }>;
  revenueCents: number;
  revenueLabel: string;
}

export function TabDashboardGrid({
  featureFlags,
  recentTicketOrders,
  recentShows,
  recentUsers,
  recentReports,
  recentSupport,
  pendingVerifications,
  recentEmails,
  recentAudits,
  revenueCents: _revenueCents,
  revenueLabel,
}: Props) {
  return (
    <>
      <section className="admin-metric-grid">
        <article className="card admin-metric-card">
          <span>Revenue (captured)</span>
          <strong>{revenueLabel}</strong>
        </article>
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
          <AdminFeatureFlags initialFlags={featureFlags} />
        </article>

        <article className="panel admin-console-panel">
          <h2>Ticket orders</h2>
          <div className="admin-list">
            {recentTicketOrders.length ? (
              recentTicketOrders.map((order) => (
                <div className="admin-list-row" key={order.id}>
                  <span>{order.show?.title ?? 'Unknown show'}</span>
                  <strong>{order.status}</strong>
                  <small>{order.buyerEmail} · ${(order.totalChargeCents / 100).toFixed(2)}</small>
                </div>
              ))
            ) : (
              <div className="empty">No ticket orders yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Recent shows</h2>
          <div className="admin-list">
            {recentShows.length ? (
              recentShows.map((show) => (
                <div className="admin-list-row" key={show.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1 }}>{show.title}</span>
                  <small>{show.venueProfile?.name ?? '—'}</small>
                  <small>{show.startsAt.toISOString().slice(0, 10)}</small>
                  <small>{show._count.tickets} tix</small>
                  <FeatureToggle showId={show.id} initialFeatured={show.featured} />
                </div>
              ))
            ) : (
              <div className="empty">No shows yet.</div>
            )}
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
    </>
  );
}
