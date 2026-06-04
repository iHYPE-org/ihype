'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { View } from './types';

export const TAB_ICONS: Record<string, React.ReactNode> = {
  me: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>,
  seeds: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>,
  radio: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>,
  studio: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h1M8 6v4M11 7v2"/></svg>,
  tickets: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6a1.5 1.5 0 0 0 0 3v3h12V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M9 3v10" strokeDasharray="1.4 1.4"/></svg>,
  tour: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="4" cy="11" r="1.5"/><circle cx="12" cy="5" r="1.5"/><path d="M5.2 10.2 10.8 5.8"/><path d="M2 4h2.5M2 7h4M2 10h1.5"/></svg>,
  pagestudio: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/><circle cx="11.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/></svg>,
};

export const TABS: { k: View; label: string }[] = [
  { k: 'me',          label: 'Me' },
  { k: 'seeds',       label: 'Seeds' },
  { k: 'radio',       label: 'Radio' },
  { k: 'studio',      label: 'Studio' },
  { k: 'tickets',     label: 'Live Events' },
  { k: 'pagestudio',  label: 'Fan Page' },
];

export const ROLE_TABS: { k: View; label: string; role: string }[] = [
  { k: 'artistpage', label: 'Artist Page', role: 'ARTIST' },
  { k: 'venuepage',  label: 'Venue Page',  role: 'VENUE'  },
];

export function AppTopbar({ view, setView, listeningNow, initials, userName, activeProfileTypes, onSettings, onSearch, onShortcuts, badges, notifCount, notifications }: {
  view: View; setView: (v: View) => void;
  listeningNow: number; initials: string; userName: string;
  activeProfileTypes: string[]; onSettings: () => void;
  onSearch?: () => void;
  onShortcuts?: () => void;
  badges: Record<string, string | undefined>;
  notifCount: number;
  notifications?: Array<{ id: string; body: string; link?: string; type: string; createdAt: string }>;
}) {
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const kbShortcut = isMac ? '⌘K' : 'Ctrl+K';

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (_e: MouseEvent) => {
      setNotifOpen(false);
    };
    const t = setTimeout(() => window.addEventListener('click', handler), 100);
    return () => { clearTimeout(t); window.removeEventListener('click', handler); };
  }, [notifOpen]);

  return (
    <header style={{
      height: 'var(--top-h)', borderBottom: '1px solid var(--line)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center',
      gap: 24, padding: '0 22px',
      background: 'rgba(16,13,9,0.9)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      position: 'relative', zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', userSelect: 'none' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), #ff3e9a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 14, color: '#0a0805',
          position: 'relative',
        }}>
          iH
          <span style={{ position: 'absolute', top: 5, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--ink)', display: 'flex', alignItems: 'baseline', gap: 1 }}>
            iHYPE<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', transform: 'translateY(-9px)', marginLeft: 1 }} />
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: 3 }}>workbench</div>
        </div>
      </div>

      {/* Tabs */}
      <nav role="navigation" aria-label="Main navigation" style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
        {TABS.filter(t => t.k !== 'pagestudio').map(tab => {
          const active = view === tab.k;
          return (
            <button key={tab.k} onClick={() => setView(tab.k)} aria-current={active ? 'page' : undefined} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
              borderRadius: 8, cursor: 'pointer',
              border: active ? '1px solid rgba(255,80,41,.22)' : '1px solid transparent',
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              background: active ? 'rgba(255,80,41,.1)' : 'transparent',
              fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, letterSpacing: '-.005em',
              position: 'relative', transition: 'color .15s, background .15s, border-color .15s',
              boxShadow: active ? '0 0 18px rgba(255,80,41,.12), inset 0 1px 0 rgba(255,255,255,.06)' : 'none',
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#f0ebe5'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)'; } }}
            >
              {TAB_ICONS[tab.k]}
              {tab.label}
              {badges[tab.k] && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99,
                  background: active ? 'rgba(255,80,41,.22)' : 'rgba(255,255,255,.06)',
                  fontFamily: 'var(--f-m)', fontSize: 11,
                  color: active ? 'var(--accent)' : 'var(--ink-3)', fontWeight: 700, letterSpacing: '.04em',
                }}>{badges[tab.k]}</span>
              )}
            </button>
          );
        })}
        {/* Separator + role-specific pages + Fan Page */}
        <span style={{ width: 1, height: 20, background: 'var(--line-2)', margin: '0 6px', flexShrink: 0 }} />
        {ROLE_TABS.filter(rt => activeProfileTypes.includes(rt.role)).map(tab => {
          const active = view === tab.k;
          return (
            <button key={tab.k} onClick={() => setView(tab.k)} aria-current={active ? 'page' : undefined} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
              borderRadius: 8, cursor: 'pointer',
              border: active ? '1px solid rgba(185,131,255,.22)' : '1px solid transparent',
              color: active ? '#b983ff' : 'var(--ink-2)',
              background: active ? 'rgba(185,131,255,.1)' : 'transparent',
              fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, letterSpacing: '-.005em',
              position: 'relative', transition: 'color .15s, background .15s, border-color .15s',
              boxShadow: active ? '0 0 18px rgba(185,131,255,.12), inset 0 1px 0 rgba(255,255,255,.06)' : 'none',
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#f0ebe5'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)'; } }}
            >
              {TAB_ICONS['pagestudio']}
              {tab.label}
            </button>
          );
        })}
        {(() => {
          const tab = TABS.find(t => t.k === 'pagestudio')!;
          const active = view === 'pagestudio';
          return (
            <button key="pagestudio" onClick={() => setView('pagestudio')} aria-current={active ? 'page' : undefined} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
              borderRadius: 8, cursor: 'pointer',
              border: active ? '1px solid rgba(255,80,41,.22)' : '1px solid transparent',
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              background: active ? 'rgba(255,80,41,.1)' : 'transparent',
              fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13, letterSpacing: '-.005em',
              position: 'relative', transition: 'color .15s, background .15s, border-color .15s',
              boxShadow: active ? '0 0 18px rgba(255,80,41,.12), inset 0 1px 0 rgba(255,255,255,.06)' : 'none',
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#f0ebe5'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)'; } }}
            >
              {TAB_ICONS['pagestudio']}
              {tab.label}
            </button>
          );
        })()}
      </nav>

      {/* Right: listening + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onSearch && (
          <button
            aria-label={`Search (${kbShortcut})`}
            onClick={onSearch}
            title={`Search (${kbShortcut})`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
              borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--bg-3)',
              color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 13,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            Search
            <kbd style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-4)', border: '1px solid var(--line-2)', borderRadius: 4, padding: '1px 5px' }}>{kbShortcut}</kbd>
          </button>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', paddingRight: 14, borderRight: '1px solid var(--line)', marginRight: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22e5d4', boxShadow: '0 0 8px #22e5d4', animation: 'pulse 1.8s infinite', display: 'inline-block' }} />
          {listeningNow.toLocaleString()} listening
        </span>
        <div style={{ position: 'relative' }}>
          <button aria-label="Notifications" aria-expanded={notifOpen} onClick={() => setNotifOpen(o => !o)} style={{
            position: 'relative', width: 32, height: 32, borderRadius: 7,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)',
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                minWidth: 14, height: 14, borderRadius: 99, padding: '0 3px',
                background: '#ff3e9a', color: '#fff',
                fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{notifCount > 9 ? '9+' : String(notifCount)}</span>
            )}
          </button>
          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100,
              width: 320, maxHeight: 400, overflowY: 'auto',
              background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Notifications</span>
                <button
                  onClick={async () => {
                    await fetch('/api/notifications', { method: 'POST' });
                    setNotifOpen(false);
                  }}
                  style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}
                >Mark all read</button>
              </div>
              {(!notifications || notifications.length === 0) ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)' }}>
                  All caught up ✓
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id}
                    onClick={() => { if (n.link) router.push(n.link); setNotifOpen(false); }}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--line)', cursor: n.link ? 'pointer' : 'default',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>{n.body}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{n.type}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px 5px 5px',
          borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--line-2)',
          userSelect: 'none',
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff3e9a, var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 13, color: '#0a0805',
          }}>{initials}</span>
          <div>
            <div style={{ fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 12, color: 'var(--ink)', lineHeight: 1 }}>{userName}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.08em', marginTop: 2 }}>{activeProfileTypes.slice(0, 2).join(' + ')}</div>
          </div>
          <span style={{ padding: '3px 7px', borderRadius: 99, background: 'rgba(255,184,74,.12)', color: '#ffb84a', fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', border: '1px solid rgba(255,184,74,.28)' }}>LVL 14</span>
        </div>
        <button onClick={onSettings} aria-label="Open settings" title="Settings" style={{
          width: 32, height: 32, borderRadius: 7, background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-3)',
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
