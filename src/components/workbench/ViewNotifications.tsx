'use client';

import { useEffect, useState } from 'react';

type Notification = {
  id: string;
  body: string;
  link?: string;
  type: string;
  createdAt: string;
};

const KIND_ICON: Record<string, string> = {
  hype: '♥',
  show: '🎟️',
  radio: '📻',
  payout: '💸',
  request: '📩',
  security: '🔐',
};

const KIND_COLOR: Record<string, string> = {
  hype: '#ff3e9a',
  show: '#22e5d4',
  radio: '#b983ff',
  payout: '#ffb84a',
  request: '#ff5029',
  security: '#ff8080',
};

function fmtRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

export function ViewNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.notifications) setNotifications(data.notifications);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    setMarkingRead(true);
    try {
      await fetch('/api/notifications', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch {}
    finally { setMarkingRead(false); }
  }

  const unreadCount = notifications.filter((n) => (n as Notification & { unread?: boolean }).unread !== false).length;

  return (
    <div style={{ padding: '24px 32px 40px', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>
            ● NOTIFICATIONS{unreadCount > 0 ? ` · ${unreadCount} NEW` : ''}
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
            Inbox
          </h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5 }}>
            Hypes, show updates, payouts, and security alerts.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            disabled={markingRead}
            style={{
              padding: '9px 16px', border: '1px solid var(--line-2)', borderRadius: 8,
              background: 'none', color: 'var(--ink-2)',
              fontFamily: 'var(--f-m)', fontSize: 13, cursor: 'pointer',
            }}
          >
            {markingRead ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 72, borderRadius: 12,
              background: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s infinite',
            }} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 48 }}>🔔</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>All caught up</div>
          <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)', maxWidth: '30ch', lineHeight: 1.6 }}>
            When artists you follow drop new music, shows go on sale, or you receive a payout, it shows up here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map((n) => {
            const isUnread = (n as Notification & { unread?: boolean }).unread !== false;
            const color = KIND_COLOR[n.type] ?? '#ff5029';
            const icon = KIND_ICON[n.type] ?? '●';
            return (
              <div
                key={n.id}
                onClick={() => n.link && (window.location.href = n.link)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 16px', borderRadius: 12,
                  border: `1px solid ${isUnread ? `${color}33` : 'var(--line)'}`,
                  background: isUnread ? `${color}08` : 'var(--bg-2)',
                  cursor: n.link ? 'pointer' : 'default',
                  transition: 'background .15s',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: `${color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink)',
                    lineHeight: 1.4, marginBottom: 4,
                  }}>
                    {n.body}
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>
                    {fmtRelative(n.createdAt)}
                  </div>
                </div>
                {isUnread && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
