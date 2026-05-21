'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Notif = {
  id: string;
  type: string;
  body: string;
  link: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const d = (await res.json()) as { notifications: Notif[] };
      setNotifications(d.notifications ?? []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function markRead() {
    try {
      await fetch('/api/notifications', { method: 'POST' });
      setNotifications([]);
    } catch {
      // ignore
    }
  }

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && notifications.length > 0) {
      void markRead();
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="button small secondary"
        onClick={handleOpen}
        type="button"
        aria-label="Notifications"
        style={{ position: 'relative' }}
      >
        🔔
        {notifications.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: '50%',
              fontSize: 10,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px'
            }}
          >
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="panel"
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 6,
            width: 300,
            maxHeight: 360,
            overflowY: 'auto',
            zIndex: 200,
            padding: '10px 0'
          }}
        >
          {notifications.length === 0 ? (
            <p className="meta" style={{ padding: '8px 14px', margin: 0 }}>
              No new notifications.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {notifications.map((n) => (
                <li key={n.id} style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
                  {n.link ? (
                    <Link href={n.link} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                      <span style={{ fontSize: 13 }}>{n.body}</span>
                    </Link>
                  ) : (
                    <span style={{ fontSize: 13 }}>{n.body}</span>
                  )}
                  <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
