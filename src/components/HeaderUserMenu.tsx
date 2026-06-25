'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';

export function HeaderUserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (status === 'loading' || !session?.user) return null;

  const name = session.user.name ?? session.user.email ?? 'Account';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      <Link
        href="/notifications"
        aria-label="Notifications"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8,
          color: 'rgba(240,235,229,.5)',
          textDecoration: 'none', fontSize: 16,
          transition: 'color 150ms',
        }}
      >
        🔔
      </Link>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: 15,
          background: 'linear-gradient(135deg, var(--accent, #ff5029), #b983ff)',
          color: '#fff', fontWeight: 700, fontSize: 13,
          border: 'none', cursor: 'pointer', flexShrink: 0,
          fontFamily: 'var(--font-body)',
        }}
        title={name}
      >
        {initial}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          background: 'var(--bg-2, #100d09)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 10, padding: '6px 0',
          minWidth: 160, zIndex: 200,
          boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        }}>
          <div style={{ padding: '8px 14px 8px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          </div>
          {[
            { href: '/home', label: 'My feed' },
            { href: '/notifications', label: 'Notifications' },
            { href: '/tickets', label: 'My tickets' },
            { href: '/settings', label: 'Settings' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block', padding: '9px 14px',
                fontSize: 13, color: 'rgba(240,235,229,.7)',
                textDecoration: 'none',
                transition: 'background 100ms, color 100ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.05)'; (e.currentTarget as HTMLElement).style.color = 'var(--ink)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(240,235,229,.7)'; }}
            >
              {item.label}
            </Link>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 4, paddingTop: 4 }}>
            <Link
              href="/api/auth/signout"
              style={{
                display: 'block', padding: '9px 14px',
                fontSize: 13, color: 'rgba(240,235,229,.4)',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ink)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,235,229,.4)'; }}
            >
              Sign out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
