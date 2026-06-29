'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  hype: 'Hype',
  show: 'Shows',
  radio: 'Radio',
  payout: 'Payouts',
  security: 'Security',
  request: 'Requests',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/notifications?all=1')
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const allTypes = Array.from(new Set(notifications.map(n => n.type))).filter(Boolean);
  const visible = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !n.read).length;

  async function markAllRead() {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await fetch('/api/notifications', { method: 'POST' }).catch(() => null);
    setMarking(false);
  }

  async function markOneRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
  }

  async function deleteOne(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' }).catch(() => null);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 12,
    fontFamily: 'var(--font-mono)', letterSpacing: '.04em', border: 'none',
    background: active ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.06)',
    color: active ? '#fff' : 'rgba(240,235,229,.5)',
    transition: 'background 150ms, color 150ms',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 100px' }}>

      <div style={{ marginBottom: 24 }}>
        <Link href="/home" style={{ fontSize: 12, color: 'rgba(240,235,229,.4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
          ← HOME
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span style={{
                padding: '3px 10px', background: 'var(--accent, #ff5029)',
                borderRadius: 9999, fontSize: 11, fontFamily: 'var(--font-mono)',
                letterSpacing: '.06em', color: '#fff',
              }}>
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
                padding: '7px 14px', cursor: 'pointer', color: 'rgba(240,235,229,.55)',
                fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '.04em',
                transition: 'border-color 150ms, color 150ms',
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {allTypes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          <button style={tabStyle(filter === 'all')} onClick={() => setFilter('all')}>All</button>
          {allTypes.map(t => (
            <button key={t} style={tabStyle(filter === t)} onClick={() => setFilter(t)}>
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div className="ihype-empty-state">
          <div className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <h3>All clear</h3>
          <p>{filter === 'all' ? "You'll get notified about new shows, milestones, and journal posts." : `No ${TYPE_LABELS[filter] ?? filter} notifications.`}</p>
          {filter === 'all' && (
            <Link href="/discover" className="ihype-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Discover artists →
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map(n => {
            const date = new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            const inner = (
              <div
                onClick={() => !n.read && markOneRead(n.id)}
                style={{
                  padding: '16px 18px',
                  background: n.read ? 'var(--bg-2, #100d09)' : 'rgba(255,80,41,.06)',
                  borderLeft: `3px solid ${n.read ? 'transparent' : 'var(--accent, #ff5029)'}`,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.06)',
                  borderLeftWidth: 3,
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  transition: 'background 300ms',
                  cursor: n.link ? 'pointer' : (!n.read ? 'pointer' : 'default'),
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{n.body}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(240,235,229,.35)', fontFamily: 'var(--font-mono)' }}>{date}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--accent)', marginTop: 5 }} />
                  )}
                  <button
                    onClick={(e) => deleteOne(e, n.id)}
                    title="Dismiss"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(240,235,229,.2)', fontSize: 16, lineHeight: 1,
                      transition: 'color 150ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(240,235,229,.6)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,235,229,.2)')}
                  >
                    ×
                  </button>
                </div>
              </div>
            );

            return n.link ? (
              <Link key={n.id} href={n.link} style={{ textDecoration: 'none' }}>{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <Link href="/settings" className="ihype-btn-ghost">Notification settings →</Link>
      </div>
    </div>
  );
}
