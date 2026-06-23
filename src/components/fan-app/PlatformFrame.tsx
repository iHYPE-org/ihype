'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppProvider } from './context';
import { AppShell } from './Shell';

type Platform = 'ios' | 'android' | 'mobile' | 'desktop';

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'ios', label: 'iOS' },
  { id: 'android', label: 'Android' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'desktop', label: 'Desktop' },
];

function PlatformPicker({ value, onChange }: { value: Platform; onChange: (p: Platform) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {PLATFORMS.map(p => {
        const on = p.id === value;
        return (
          <button key={p.id} onClick={() => onChange(p.id)} style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.72rem', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: on ? 700 : 500 }}>{p.label}</button>
        );
      })}
    </div>
  );
}

// iOS device frame with Dynamic Island
function IOSFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: 375, height: 812, borderRadius: 54, background: '#0a0805', border: '8px solid #1a1612', boxShadow: '0 40px 80px rgba(0,0,0,.6), 0 0 0 1px #2a2218, inset 0 0 0 1px #2a2218', overflow: 'hidden', flexShrink: 0 }}>
      {/* Dynamic Island */}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 120, height: 36, borderRadius: 999, background: '#000', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1a1612' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2a2218' }} />
      </div>
      {/* Status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 58, zIndex: 99, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 28px 8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', fontWeight: 700, color: 'var(--ink-1)' }}>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="var(--ink-1)"><rect x="0" y="4" width="3" height="8" rx="1"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="1"/><rect x="9" y="0.5" width="3" height="11.5" rx="1"/><rect x="13.5" y="0" width="2" height="12" rx="1" opacity=".3"/></svg>
          <svg width="15" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-1)" strokeWidth="2"><path d="M1.5 8.5a13 13 0 0 1 21 0"/><path d="M5 12a9 9 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="var(--ink-1)"/></svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0" y="1" width="21" height="10" rx="2" stroke="var(--ink-1)" strokeWidth="1.5"/><rect x="1.5" y="2.5" width="16" height="7" rx="1" fill="var(--ink-1)"/><path d="M22.5 4v4" stroke="var(--ink-1)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      </div>
      {/* Content with top padding for notch */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 58, paddingBottom: 34, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {/* Home indicator */}
      <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, borderRadius: 999, background: 'rgba(240,235,229,.3)' }} />
    </div>
  );
}

// Android frame with punch-hole camera
function AndroidFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: 375, height: 812, borderRadius: 44, background: '#0a0805', border: '6px solid #1a1612', boxShadow: '0 40px 80px rgba(0,0,0,.6), 0 0 0 1px #2a2218', overflow: 'hidden', flexShrink: 0 }}>
      {/* Punch-hole camera */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: '#0a0805', border: '2px solid #2a2218', zIndex: 100 }} />
      {/* Status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 36, zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', fontWeight: 700, color: 'var(--ink-1)' }}>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="11" viewBox="0 0 15 11" fill="var(--ink-1)"><path d="M0 8h2V11H0zM3.5 5h2v6h-2zM7 2h2v9H7zM10.5 0h2v11h-2z"/></svg>
          <svg width="15" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-1)" strokeWidth="2"><path d="M5 12a9 9 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="var(--ink-1)"/></svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-1)' }}>95%</span>
        </div>
      </div>
      {/* Content */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 36, paddingBottom: 16, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {/* Gesture bar */}
      <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 100, height: 4, borderRadius: 999, background: 'rgba(240,235,229,.25)' }} />
    </div>
  );
}

// Mobile browser frame
function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: 375, height: 812, borderRadius: 36, background: '#0a0805', border: '6px solid #1a1612', boxShadow: '0 40px 80px rgba(0,0,0,.6)', overflow: 'hidden', flexShrink: 0 }}>
      {/* Browser chrome */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, background: 'var(--bg-surface)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, zIndex: 99 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: 'var(--bg-raised)', border: '1px solid var(--line)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-3)' }}>ihype.app</span>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
      </div>
      {/* Content */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 52, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// Desktop shell
function DesktopView({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: 1100, height: 700, borderRadius: 20, background: '#0a0805', border: '1px solid var(--line)', boxShadow: '0 40px 80px rgba(0,0,0,.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Title bar */}
      <div style={{ height: 38, background: 'var(--bg-surface)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ff5f56', '#ffbd2e', '#27c93f'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--line)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-3)' }}>ihype.app</span>
          </div>
        </div>
      </div>
      {/* Content with sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// Desktop layout wrapper — injects sidebar nav
function DesktopAppShell() {
  const { tab, setTab, nowPlaying, playing, togglePlay, hypeBudget, openSheet, notifsRead } = require('./context').useApp();
  const navItems = [
    { id: 'listen', label: 'Listen', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg> },
    { id: 'events', label: 'Events', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" /></svg> },
    { id: 'pages', label: 'Pages', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg> },
  ];
  return (
    <>
      {/* Sidebar */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', padding: '1.25rem 1rem 1rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.3rem', letterSpacing: '-.04em', marginBottom: '1.5rem', color: 'var(--accent)' }}>iHYPE</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(n => {
            const on = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id as any)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--font-body)', fontWeight: on ? 700 : 500, fontSize: '.9rem', cursor: 'pointer', textAlign: 'left' }}>
                {n.icon}{n.label}
              </button>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#ff5029,#ff3e9a)', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.85rem' }}>Robin Vega</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)' }}>@robinv</div>
            </div>
          </div>
          <button onClick={() => openSheet('settings')} style={{ width: '100%', padding: '6px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.72rem', cursor: 'pointer' }}>Settings</button>
        </div>
      </div>
      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppShell />
      </div>
    </>
  );
}

export function PlatformFrame() {
  const [platform, setPlatform] = useState<Platform>('ios');

  const content = (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );

  const desktopContent = (
    <AppProvider>
      <DesktopAppShell />
    </AppProvider>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '40px 20px', background: 'var(--bg-base)' }}>
      {/* Logo + back link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1100, marginBottom: 8 }}>
        <Link href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', textDecoration: 'none' }}>← ihype.org</Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/register" style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.08em', padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(255,80,41,.4)', background: 'rgba(255,80,41,.08)', color: 'var(--accent)', textDecoration: 'none' }}>Sign up free</Link>
          <Link href="/login" style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.08em', padding: '5px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', textDecoration: 'none' }}>Log in</Link>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.8rem', letterSpacing: '-.04em', color: 'var(--accent)', marginBottom: 8 }}>iHYPE</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 32 }}>Fan App Demo · Closed Beta</div>

      <PlatformPicker value={platform} onChange={setPlatform} />

      {/* Device frames */}
      {platform === 'ios' && <IOSFrame>{content}</IOSFrame>}
      {platform === 'android' && <AndroidFrame>{content}</AndroidFrame>}
      {platform === 'mobile' && <MobileFrame>{content}</MobileFrame>}
      {platform === 'desktop' && (
        <DesktopView>{desktopContent}</DesktopView>
      )}

      {/* Footer */}
      <div style={{ marginTop: 32, fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', textAlign: 'center' }}>
        iHYPE v0.1.0-beta.5 · Simulated — no real transactions · Nonprofit pending
      </div>
    </div>
  );
}
