'use client';

import { useState } from 'react';
import { useApp } from './context';
import { UserPrefs } from '@/lib/data';
import { track } from '@/lib/analytics';

const ROLES = [
  { id: 'fan', label: 'Fan', icon: '🎶', desc: 'Discover events, hype artists, earn on referrals.' },
  { id: 'dj', label: 'DJ', icon: '📻', desc: 'Build your crate, host radio shows, earn promoter cuts.' },
  { id: 'artist', label: 'Artist', icon: '🎸', desc: 'Sell tickets direct. Keep 45%. No agents, no fees.' },
  { id: 'venue', label: 'Venue', icon: '🏟', desc: 'Book from the demand radar. 45% guaranteed.' },
] as const;

const CITIES = ['Los Angeles', 'New York', 'Chicago', 'Austin', 'Nashville', 'Portland', 'Seattle'];
const GENRES = ['dream-pop', 'shoegaze', 'lo-fi', 'r&b', 'jazz', 'hip-hop', 'punk', 'electronic', 'folk', 'indie-rock'];

function MeshBlob({ x, y, color, size, dur }: { x: string; y: string; color: string; size: string; dur: string }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: size, height: size,
      borderRadius: '50%', background: color, filter: 'blur(60px)', opacity: .35,
      animation: `meshMove ${dur} ease-in-out infinite alternate`, pointerEvents: 'none',
    }} />
  );
}

export function Onboarding() {
  const { setOnboarded } = useApp();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string>('');
  const [city, setCity] = useState('');
  const [genres, setGenres] = useState<string[]>([]);

  const next = () => setStep(s => s + 1);
  const prog = [0.25, 0.5, 0.75, 1][step];

  const quickStart = () => {
    const prefs: UserPrefs = { role: 'fan', city: 'Los Angeles', genres: ['dream-pop', 'lo-fi', 'electronic'] };
    track('onboarding_skip');
    setOnboarded(prefs);
  };

  const finish = () => {
    const prefs: UserPrefs = { role: role as any, city, genres };
    track('onboarding_complete', { role, city, genres: genres.length });
    setOnboarded(prefs);
  };

  const toggleGenre = (g: string) => setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', padding: '1.5rem 1.25rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
      <MeshBlob x="-10%" y="-5%" color="#ff5029" size="55%" dur="4s" />
      <MeshBlob x="60%" y="20%" color="#b983ff" size="45%" dur="5.5s" />
      <MeshBlob x="10%" y="65%" color="#22e5d4" size="40%" dur="3.8s" />

      <div style={{ height: 3, borderRadius: 999, background: 'var(--bg-raised)', marginBottom: 24, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ height: '100%', width: `${prog * 100}%`, background: 'var(--accent)', borderRadius: 999, transition: 'width .4s ease' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {step === 0 && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 6 }}>Who are you?</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>Pick your role. You can add more later.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {ROLES.map(r => {
                const on = role === r.id;
                return (
                  <div key={r.id} onClick={() => setRole(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.08)' : 'var(--bg-surface)', cursor: 'pointer', transition: 'all .15s' }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem' }}>{r.label}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 2 }}>{r.desc}</div>
                    </div>
                    {on && <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="1.5,6 4.5,9.5 10.5,2.5" /></svg>
                    </div>}
                  </div>
                );
              })}
            </div>
            <button onClick={next} disabled={!role} style={{ marginTop: 20, width: '100%', padding: '13px', borderRadius: 999, background: role ? 'var(--accent)' : 'var(--bg-raised)', color: role ? '#fff' : 'var(--ink-3)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', border: 'none', cursor: role ? 'pointer' : 'default' }}>Continue →</button>
            <button onClick={quickStart} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 999, background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: '.78rem', border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>Skip — explore the demo →</button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 16 }}>Your scene?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, alignContent: 'start' }}>
              {CITIES.map(c => {
                const on = city === c;
                return <button key={c} onClick={() => setCity(c)} style={{ padding: '11px 10px', borderRadius: 12, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.08)' : 'var(--bg-surface)', color: on ? 'var(--accent)' : 'var(--ink-1)', fontFamily: 'var(--font-body)', fontWeight: on ? 700 : 500, fontSize: '.85rem', cursor: 'pointer', textAlign: 'left' }}>{c}</button>;
              })}
            </div>
            <button onClick={next} disabled={!city} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 999, background: city ? 'var(--accent)' : 'var(--bg-raised)', color: city ? '#fff' : 'var(--ink-3)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', border: 'none', cursor: city ? 'pointer' : 'default' }}>Continue →</button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 6 }}>What do you love?</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>Pick at least one genre.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, alignContent: 'start' }}>
              {GENRES.map(g => {
                const on = genres.includes(g);
                return <button key={g} onClick={() => toggleGenre(g)} style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.1)' : 'var(--bg-surface)', color: on ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: '.78rem', fontWeight: on ? 700 : 500, cursor: 'pointer', letterSpacing: '.04em' }}>{g}</button>;
              })}
            </div>
            <button onClick={next} disabled={genres.length === 0} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 999, background: genres.length ? 'var(--accent)' : 'var(--bg-raised)', color: genres.length ? '#fff' : 'var(--ink-3)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', border: 'none', cursor: genres.length ? 'pointer' : 'default' }}>Continue →</button>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 6 }}>Create your account</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
              Your data, your terms. <strong style={{ color: 'var(--color-success)' }}>$0 PII sold.</strong> Identity detached after 24h.
            </p>
            <input placeholder="Email address" type="email" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <input placeholder="Password" type="password" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 }}>
              By continuing you agree to the <span style={{ color: 'var(--ink-2)', textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span> and <span style={{ color: 'var(--ink-2)', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>. Ticket purchases are simulated — no real money moves in beta.
            </div>
            <button onClick={finish} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,80,41,.25)' }}>Join iHYPE →</button>
          </>
        )}
      </div>
    </div>
  );
}
