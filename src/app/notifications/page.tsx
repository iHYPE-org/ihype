'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
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

const ICON_FOR_TYPE: Record<string, { color: string; bg: string; icon: (c: string) => ReactElement }> = {
  hype: {
    color: '#ff5029', bg: 'rgba(255,80,41,.15)',
    icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill={c} stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
  },
  show: {
    color: '#22e5d4', bg: 'rgba(34,229,212,.12)',
    icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" /><path d="M13 5v2M13 11v2M13 17v2" /></svg>,
  },
  payout: {
    color: '#ff3e9a', bg: 'rgba(255,62,154,.12)',
    icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
  radio: {
    color: '#b983ff', bg: 'rgba(185,131,255,.12)',
    icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></svg>,
  },
  security: {
    color: 'rgba(240,235,229,.7)', bg: 'rgba(255,255,255,.08)',
    icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>,
  },
  request: {
    color: 'rgba(240,235,229,.7)', bg: 'rgba(255,255,255,.08)',
    icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>,
  },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications?all=1')
      .then((r) => r.json())
      .then((d) => {
        setNotifs(d.notifications ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;
  const filtered = tab === 'unread' ? notifs.filter((n) => !n.read) : notifs;

  async function markAllRead() {
    setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
    await fetch('/api/notifications', { method: 'POST' }).catch(() => null);
  }

  async function markRead(id: string) {
    setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
  }

  return (
    <div className="notif-page">
      <div className="notif-page-header">
        <div>
          <h1>Notifications</h1>
          {unreadCount > 0 && <div className="notif-unread-count">{unreadCount} unread</div>}
        </div>
        {unreadCount > 0 && (
          <button className="notif-mark-all" onClick={markAllRead} type="button">Mark all read</button>
        )}
      </div>

      <div className="notif-tab-row">
        <div className={`notif-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>All</div>
        <div className={`notif-tab${tab === 'unread' ? ' active' : ''}`} onClick={() => setTab('unread')}>
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,229,.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </div>
          <p>No notifications here.</p>
        </div>
      ) : (
        filtered.map((n) => {
          const spec = ICON_FOR_TYPE[n.type] ?? ICON_FOR_TYPE.security;
          const inner = (
            <div className={`notif-item${!n.read ? ' unread' : ''}`} onClick={() => !n.read && markRead(n.id)}>
              <div className="notif-icon" style={{ background: spec.bg }}>{spec.icon(spec.color)}</div>
              <div className="notif-body">
                <div className="notif-text">{n.body}</div>
                <div className="notif-time">{timeAgo(n.createdAt)}</div>
              </div>
              {!n.read && <div className="unread-dot" />}
            </div>
          );
          return n.link ? (
            <Link href={n.link} key={n.id} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })
      )}

      <style>{`
        .notif-page { max-width: 720px; margin: 0 auto; padding: 32px 24px 100px; }
        .notif-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .notif-page-header h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); margin: 0; }
        .notif-unread-count { font-size: 13px; color: rgba(240,235,229,.6); margin-top: 4px; }
        .notif-mark-all { background: none; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 7px 14px; cursor: pointer; color: rgba(240,235,229,.55); font-size: 12px; font-family: var(--font-mono); letter-spacing: .04em; }
        .notif-mark-all:hover { color: var(--ink); }
        .notif-tab-row { display: flex; gap: 24px; border-bottom: 1px solid rgba(255,255,255,.06); margin-bottom: 24px; }
        .notif-tab { padding: 10px 0; border-bottom: 2px solid transparent; cursor: pointer; font-size: 14px; font-weight: 600; color: rgba(240,235,229,.55); transition: all 150ms; }
        .notif-tab.active { color: var(--ink); border-color: var(--accent); }
        .notif-item { display: flex; gap: 16px; align-items: flex-start; padding: 18px 0; border-bottom: 1px solid rgba(255,255,255,.06); cursor: pointer; transition: all 150ms; }
        .notif-item:hover { opacity: .85; }
        .notif-item.unread { background: rgba(255,80,41,.03); }
        .notif-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .notif-body { flex: 1; }
        .notif-text { font-size: 14px; line-height: 1.5; color: rgba(240,235,229,.9); margin-bottom: 4px; }
        .notif-time { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: rgba(240,235,229,.5); }
        .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 6px; }
        .notif-empty { text-align: center; padding: 60px 24px; color: rgba(240,235,229,.5); }
        .notif-empty-icon { font-size: 40px; margin-bottom: 12px; }
      `}</style>
    </div>
  );
}
