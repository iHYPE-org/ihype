'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Prefs {
  newShows: boolean;
  journalPosts: boolean;
  milestones: boolean;
  weeklyDigest: boolean;
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div>
        <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'rgba(240,235,229,.4)', marginTop: 2 }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: checked ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.1)',
          position: 'relative', transition: 'background .2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18,
          borderRadius: 9, background: '#fff', transition: 'left .2s', display: 'block',
        }} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<Prefs>({ newShows: true, journalPosts: true, milestones: true, weeklyDigest: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => {
        setName(data.name ?? '');
        setEmail(data.email ?? '');
        if (data.notificationPreference) setPrefs(data.notificationPreference);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), notificationPreference: prefs }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to save');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const sectionLabel = {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(240,235,229,.45)',
    marginBottom: 16,
    display: 'block',
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px 100px' }}>

      <div style={{ marginBottom: 32 }}>
        <Link href="/home" style={{ fontSize: 12, color: 'rgba(240,235,229,.4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
          ← HOME
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 0' }}>
          Settings
        </h1>
      </div>

      {loading ? (
        <p style={{ color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* Account */}
          <section style={{ padding: '20px 22px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, background: 'var(--bg-2, #100d09)' }}>
            <span style={sectionLabel}>Account</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ ...sectionLabel, marginBottom: 6 }}>Display name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="ihype-input"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label style={{ ...sectionLabel, marginBottom: 6 }}>Email</label>
                <input
                  value={email}
                  readOnly
                  className="ihype-input"
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)' }}>
                  To change your email contact admin@ihype.org
                </p>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section style={{ padding: '20px 22px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, background: 'var(--bg-2, #100d09)' }}>
            <span style={sectionLabel}>Notifications</span>
            <Toggle checked={prefs.newShows} onChange={v => setPrefs(p => ({ ...p, newShows: v }))} label="New shows" description="Artists and venues you follow announce a new show" />
            <Toggle checked={prefs.journalPosts} onChange={v => setPrefs(p => ({ ...p, journalPosts: v }))} label="Journal posts" description="New posts from creators you follow" />
            <Toggle checked={prefs.milestones} onChange={v => setPrefs(p => ({ ...p, milestones: v }))} label="Milestones" description="Hype counts, sold-out shows, and chart entries" />
            <Toggle checked={prefs.weeklyDigest} onChange={v => setPrefs(p => ({ ...p, weeklyDigest: v }))} label="Weekly digest" description="A weekly summary of upcoming shows and activity" />
          </section>

          {error && <p style={{ color: '#ff5029', fontSize: 13, margin: 0 }}>{error}</p>}
          {saved && <p style={{ color: '#22e5d4', fontSize: 13, margin: 0, fontFamily: 'var(--font-mono)' }}>✓ Saved</p>}

          <button
            onClick={save}
            disabled={saving}
            className="ihype-btn-primary"
            style={{ width: '100%' }}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>

          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <Link href="/api/auth/signout" className="ihype-btn-ghost">Sign out →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
