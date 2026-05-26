'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

type Metric = { label: string; value: string | number };

type DashboardData = {
  metrics: {
    userCount: number;
    profileCount: number;
    pendingVerificationCount: number;
    openReportCount: number;
    openSupportCount: number;
    mediaCount: number;
    ticketOrderCount: number;
    revenueCents: number;
  };
  recentUsers: Array<{ email: string | null; username: string; role: string; createdAt: string }>;
  recentAudits: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actor: { email: string | null; username: string } | null;
  }>;
  recentReports: Array<{
    id: string;
    reason: string;
    status: string;
    targetType: string;
    targetId: string;
  }>;
  recentSupport: Array<{ id: string; subject: string; priority: string; status: string; email: string | null }>;
  pendingVerifications: Array<{
    id: string;
    name: string | null;
    type: string;
    contactInfo: string | null;
  }>;
  recentEmails: Array<{ id: string; type: string; status: string; recipient: string }>;
  recentShows: Array<{
    id: string;
    title: string;
    startsAt: string;
    venueProfile: { name: string } | null;
    _count: { tickets: number };
  }>;
  recentTicketOrders: Array<{
    id: string;
    status: string;
    buyerEmail: string;
    totalChargeCents: number;
    show: { title: string } | null;
  }>;
  featureFlags: Array<{ key: string; label: string; enabled: boolean }>;
  rateLimitMetrics: Array<{ bucket: string; hits: number }>;
  health: { status: string; latencyMs: number };
};

function MetricCard({ label, value }: Metric) {
  return (
    <div className="wb-admin-metric">
      <span className="wb-admin-metric-label">{label}</span>
      <strong className="wb-admin-metric-value">{value}</strong>
    </div>
  );
}

function Section({ title, children, link }: { title: string; children: ReactNode; link?: string }) {
  return (
    <div className="wb-admin-section">
      <div className="wb-admin-section-head">
        <h3 className="wb-admin-section-title">{title}</h3>
        {link && <Link href={link} className="wb-admin-section-link">View all →</Link>}
      </div>
      {children}
    </div>
  );
}

function Row({ primary, secondary, badge }: { primary: string; secondary?: string; badge?: string }) {
  return (
    <div className="wb-admin-row">
      <span className="wb-admin-row-primary">{primary}</span>
      {secondary && <span className="wb-admin-row-secondary">{secondary}</span>}
      {badge && <span className="wb-admin-row-badge">{badge}</span>}
    </div>
  );
}

export function ViewAdmin() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="wb-admin-loading">
        <span>Loading admin dashboard…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wb-admin-loading">
        <span style={{ color: 'var(--wb-accent-danger, #f87171)' }}>
          {error || 'Failed to load dashboard.'}
        </span>
      </div>
    );
  }

  const { metrics, featureFlags, health, rateLimitMetrics } = data;
  const revenueLabel = `$${(metrics.revenueCents / 100).toFixed(2)}`;
  const healthOk = health?.status === 'ok';

  const topMetrics: Metric[] = [
    { label: 'Revenue (captured)', value: revenueLabel },
    { label: 'Users', value: metrics.userCount },
    { label: 'Profiles', value: metrics.profileCount },
    { label: 'Pending verification', value: metrics.pendingVerificationCount },
    { label: 'Open reports', value: metrics.openReportCount },
    { label: 'Support requests', value: metrics.openSupportCount },
    { label: 'Media assets', value: metrics.mediaCount },
    { label: 'Ticket orders', value: metrics.ticketOrderCount },
  ];

  return (
    <div className="wb-admin">
      <div className="wb-admin-header">
        <div>
          <div className="wb-admin-badge">Admin console</div>
          <h2 className="wb-admin-title">Dashboard</h2>
        </div>
        <div className="wb-admin-header-actions">
          <Link href="/admin/users" className="wb-admin-btn">Users</Link>
          <Link href="/admin/verifications" className="wb-admin-btn">Verifications</Link>
          <Link href="/admin/broadcast" className="wb-admin-btn">Broadcast</Link>
          <Link href="/admin/audit" className="wb-admin-btn wb-admin-btn-secondary">Audit log</Link>
        </div>
      </div>

      <div className="wb-admin-metrics">
        {topMetrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>

      <div className="wb-admin-health">
        <span>DB health</span>
        <strong style={{ color: healthOk ? 'var(--wb-accent-success, #4ade80)' : 'var(--wb-accent-warn, #fb923c)' }}>
          {healthOk ? `ok · ${health.latencyMs}ms` : 'degraded'}
        </strong>
      </div>

      <div className="wb-admin-grid">
        <Section title="Feature flags">
          {featureFlags.map((f) => (
            <div key={f.key} className="wb-admin-row">
              <span className="wb-admin-row-primary">{f.label}</span>
              <span className="wb-admin-row-badge" style={{
                background: f.enabled ? 'var(--wb-accent-success-bg, rgba(74,222,128,.15))' : 'var(--wb-surface-2)',
                color: f.enabled ? 'var(--wb-accent-success, #4ade80)' : 'var(--wb-ink-3)',
              }}>
                {f.enabled ? 'On' : 'Off'}
              </span>
            </div>
          ))}
        </Section>

        <Section title="Recent users" link="/admin/users">
          {data.recentUsers.length ? data.recentUsers.map((u) => (
            <Row key={u.email ?? u.username} primary={u.username || u.email || '—'} badge={u.role} />
          )) : <p className="wb-admin-empty">No users yet.</p>}
        </Section>

        <Section title="Verification queue" link="/admin/verifications">
          {data.pendingVerifications.length ? data.pendingVerifications.map((v) => (
            <Row key={v.id} primary={v.name || '—'} secondary={v.contactInfo || undefined} badge={v.type === 'DJ' ? 'PROMOTER' : v.type} />
          )) : <p className="wb-admin-empty">No pending verifications.</p>}
        </Section>

        <Section title="Content reports" link="/admin/review">
          {data.recentReports.length ? data.recentReports.map((r) => (
            <Row key={r.id} primary={r.reason} secondary={`${r.targetType}:${r.targetId}`} badge={r.status} />
          )) : <p className="wb-admin-empty">No reports.</p>}
        </Section>

        <Section title="Support requests">
          {data.recentSupport.length ? data.recentSupport.map((r) => (
            <Row key={r.id} primary={r.subject} secondary={r.email || undefined} badge={r.priority} />
          )) : <p className="wb-admin-empty">No support requests.</p>}
        </Section>

        <Section title="Recent shows">
          {data.recentShows.length ? data.recentShows.map((s) => (
            <Row key={s.id} primary={s.title} secondary={s.venueProfile?.name} badge={`${s._count.tickets} tix`} />
          )) : <p className="wb-admin-empty">No shows yet.</p>}
        </Section>

        <Section title="Ticket orders">
          {data.recentTicketOrders.length ? data.recentTicketOrders.map((o) => (
            <Row key={o.id} primary={o.show?.title || '—'} secondary={o.buyerEmail} badge={o.status} />
          )) : <p className="wb-admin-empty">No ticket orders yet.</p>}
        </Section>

        <Section title="Audit log" link="/admin/audit">
          {data.recentAudits.length ? data.recentAudits.map((a) => (
            <Row key={a.id} primary={a.action} secondary={a.actor?.username ?? a.actor?.email ?? 'system'} badge={a.entityType} />
          )) : <p className="wb-admin-empty">No audit events yet.</p>}
        </Section>

        <Section title="Email delivery">
          {data.recentEmails.length ? data.recentEmails.map((e) => (
            <Row key={e.id} primary={e.type} secondary={e.recipient} badge={e.status} />
          )) : <p className="wb-admin-empty">No email records yet.</p>}
        </Section>

        {rateLimitMetrics.length > 0 && (
          <Section title="Rate limit hits (1h)">
            {rateLimitMetrics.map((r) => (
              <Row key={r.bucket} primary={r.bucket} badge={String(r.hits)} />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
