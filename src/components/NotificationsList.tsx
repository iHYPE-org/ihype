'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { timeAgo } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

const ICON_COMMON = {
  fill: 'none' as const,
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function iconForType(type: string, color: string) {
  const t = type.toUpperCase();
  if (t.includes('HYPE') || t.includes('EARLY_BELIEVER')) {
    return <svg {...ICON_COMMON} fill={color} stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
  }
  if (t.includes('REFERRAL')) {
    return <svg {...ICON_COMMON} stroke={color}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
  }
  if (t.includes('RADIO') || t.includes('LIVE')) {
    return <svg {...ICON_COMMON} stroke={color}><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></svg>;
  }
  if (t.includes('SHOW') || t.includes('RSVP') || t.includes('TICKET') || t.includes('POST-SHOW')) {
    return <svg {...ICON_COMMON} stroke={color}><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" /><path d="M13 5v2M13 11v2M13 17v2" /></svg>;
  }
  return <svg {...ICON_COMMON} stroke={color}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}

function colorForType(type: string) {
  const t = type.toUpperCase();
  if (t.includes('HYPE') || t.includes('EARLY_BELIEVER')) return '#ff5029';
  if (t.includes('REFERRAL')) return '#ff3e9a';
  if (t.includes('RADIO') || t.includes('LIVE')) return '#b983ff';
  if (t.includes('SHOW') || t.includes('RSVP') || t.includes('TICKET') || t.includes('POST-SHOW')) return '#22e5d4';
  return 'var(--ink-a65)';
}

export function NotificationsList({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const router = useRouter();

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const filtered = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  async function markRead(ids: string[]) {
    setNotifications((ns) => ns.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    try {
      await fetch('/api/me/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // Optimistic update stays even if the network call fails — worst case
      // the row re-appears as unread on next visit, not a broken UI now.
    }
  }

  async function markAllRead() {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/me/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Same as above.
    }
  }

  function handleClick(n: Notification) {
    if (!n.read) void markRead([n.id]);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          {unreadCount > 0 && <div className="notifications-unread-sub">{unreadCount} unread</div>}
        </div>
        {unreadCount > 0 && (
          <button className="button ghost small" onClick={markAllRead} type="button">Mark all read</button>
        )}
      </div>

      <div className="notifications-tabs">
        <button
          className={`notifications-tab${tab === 'all' ? ' active' : ''}`}
          onClick={() => setTab('all')}
          type="button"
        >
          All
        </button>
        <button
          className={`notifications-tab${tab === 'unread' ? ' active' : ''}`}
          onClick={() => setTab('unread')}
          type="button"
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="notifications-empty">
          <svg fill="none" height="40" stroke="var(--ink-a30)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="40">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p>{tab === 'unread' ? "You're all caught up." : 'No notifications yet.'}</p>
        </div>
      ) : (
        filtered.map((n) => {
          const color = colorForType(n.type);
          return (
            <div
              className={`notifications-item${!n.read ? ' unread' : ''}`}
              key={n.id}
              onClick={() => handleClick(n)}
              role={n.link ? 'link' : undefined}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleClick(n); }}
            >
              <div className="notifications-icon" style={{ background: `${color}26` }}>{iconForType(n.type, color)}</div>
              <div className="notifications-body">
                <div className="notifications-text">{n.body}</div>
                <div className="notifications-time">{timeAgo(n.createdAt)}</div>
              </div>
              {!n.read && <div className="notifications-unread-dot" />}
            </div>
          );
        })
      )}

      <style>{`
        .notifications-page { max-width: 720px; margin: 0 auto; padding: 32px 24px 100px; }
        .notifications-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; gap: 12px; }
        .notifications-header h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
        .notifications-unread-sub { font-size: 13px; color: var(--ink-a60); margin-top: 4px; }
        .notifications-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--line); margin-bottom: 24px; }
        .notifications-tab { padding: 10px 0; border: none; background: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--ink-a55); transition: all 150ms; font-family: inherit; }
        .notifications-tab.active { color: var(--ink); border-color: var(--accent); }
        .notifications-item { display: flex; gap: 16px; align-items: flex-start; padding: 18px 0; border-bottom: 1px solid var(--line); cursor: pointer; transition: opacity 150ms; }
        .notifications-item:hover { opacity: .85; }
        .notifications-item.unread { background: rgba(255,80,41,.03); }
        .notifications-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .notifications-body { flex: 1; min-width: 0; }
        .notifications-text { font-size: 14px; line-height: 1.5; color: var(--ink-a90, var(--ink)); margin-bottom: 4px; }
        .notifications-time { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-a50); }
        .notifications-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 6px; }
        .notifications-empty { text-align: center; padding: 60px 24px; color: var(--ink-a50); }
        .notifications-empty svg { margin-bottom: 12px; }
      `}</style>
    </div>
  );
}
