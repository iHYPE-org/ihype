'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Prefs {
  newShows: boolean;
  journalPosts: boolean;
  milestones: boolean;
  weeklyDigest: boolean;
}

const ROLE_COLOR: Record<string, string> = { ARTIST: '#ff5029', DJ: '#ff3e9a', VENUE: '#22e5d4' };

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <input checked={checked} onChange={(e) => onChange(e.target.checked)} type="checkbox" />
      <div className="settings-toggle-track" />
      <div className="settings-toggle-thumb" />
    </label>
  );
}

function Row({ label, detail, action }: { label: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-detail">{detail}</div>
      </div>
      {action}
    </div>
  );
}

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('FAN');
  const [prefs, setPrefs] = useState<Prefs>({ newShows: true, journalPosts: true, milestones: true, weeklyDigest: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? '');
        setEmail(data.email ?? '');
        setRole(data.role ?? 'FAN');
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
        router.refresh();
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function detachIdentity() {
    if (!confirm('Detach your identity from activity history now?')) return;
    setDetaching(true);
    try {
      await fetch('/api/privacy/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'detach' }),
      });
      alert('Identity detached. Your email is no longer linked to your activity log.');
    } finally {
      setDetaching(false);
    }
  }

  async function downloadExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/privacy/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ihype-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed — try again or contact support.');
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    const typed = prompt('Type DELETE to confirm account deletion:');
    if (typed !== 'DELETE') return;
    const res = await fetch('/api/settings/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    if (res.ok) {
      alert('Account deletion scheduled. You will receive a confirmation email.');
      window.location.href = '/api/auth/signout';
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Could not delete account.');
    }
  }

  const isCreator = role === 'ARTIST' || role === 'DJ' || role === 'VENUE';
  const roleColor = ROLE_COLOR[role] ?? '#b983ff';

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {loading ? (
        <p style={{ color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</p>
      ) : (
        <>
          {/* Payout / Payment (role-aware) */}
          <div className="settings-section">
            <div className="settings-section-title">{isCreator ? 'Payout destination' : 'Payment methods'}</div>
            <div className="settings-group">
              {isCreator ? (
                <>
                  <div className="settings-row settings-payout-card">
                    <div className="settings-payout-ic">
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={roleColor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="settings-row-label">No payout destination connected yet</div>
                      <div className="settings-row-detail">Payouts land within 2 business days of a show closing</div>
                      <div className="settings-split-mini">
                        <span style={{ color: roleColor }}>45% you</span>
                        <span style={{ color: 'rgba(240,235,229,.5)' }}>45% {role === 'VENUE' ? 'artist' : 'venue'}</span>
                        <span style={{ color: 'rgba(240,235,229,.5)' }}>10% promoters</span>
                      </div>
                    </div>
                    <Link className="settings-btn settings-btn-ghost" href="/me/promote">Connect</Link>
                  </div>
                  <Row action={<Link className="settings-btn settings-btn-ghost" href="/me/promote">View</Link>} detail="Every payout receipt, itemized 45/45/10" label="Payout history" />
                </>
              ) : (
                <div className="settings-row settings-payout-card">
                  <div className="settings-payout-ic">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b983ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="settings-row-label">No payment method on file</div>
                    <div className="settings-row-detail">Used for ticket purchases — face value + $0 fees</div>
                  </div>
                  <Link className="settings-btn settings-btn-ghost" href="/me/tickets">Add</Link>
                </div>
              )}
            </div>
          </div>

          {/* Profile */}
          <div className="settings-section">
            <div className="settings-section-title">Profile</div>
            <div className="settings-group">
              <Row
                action={<input className="settings-input-inline" onChange={(e) => setName(e.target.value)} value={name} />}
                detail="Shown on your profile"
                label="Display name"
              />
              <Row action={<span className="settings-row-detail">Contact admin@ihype.org to change</span>} detail={email} label="Email" />
              <Row
                action={<Link className="settings-btn settings-btn-ghost" href="/verify">Manage</Link>}
                detail={role.charAt(0) + role.slice(1).toLowerCase()}
                label="Role"
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="settings-section">
            <div className="settings-section-title">Notifications</div>
            <div className="settings-group">
              <Row action={<Toggle checked={prefs.newShows} onChange={(v) => setPrefs((p) => ({ ...p, newShows: v }))} />} detail="When artists you follow announce shows" label="Ticket drops" />
              <Row action={<Toggle checked={prefs.milestones} onChange={(v) => setPrefs((p) => ({ ...p, milestones: v }))} />} detail="When your tracks hit hype thresholds" label="Hype milestones" />
              <Row action={<Toggle checked={prefs.journalPosts} onChange={(v) => setPrefs((p) => ({ ...p, journalPosts: v }))} />} detail="New posts from creators you follow" label="Journal posts" />
              <Row action={<Toggle checked={prefs.weeklyDigest} onChange={(v) => setPrefs((p) => ({ ...p, weeklyDigest: v }))} />} detail="A weekly summary of upcoming shows and activity" label="Weekly digest" />
            </div>
          </div>

          {/* Security */}
          <div className="settings-section">
            <div className="settings-section-title">Security</div>
            <div className="settings-group">
              <Row action={<Link className="settings-btn settings-btn-ghost" href="/forgot">Change</Link>} detail="Reset your password by email" label="Password" />
            </div>
          </div>

          {/* Privacy */}
          <div className="settings-section">
            <div className="settings-section-title">Privacy</div>
            <div className="settings-group">
              <Row
                action={<button className="settings-btn settings-btn-ghost" disabled={detaching} onClick={detachIdentity} type="button">{detaching ? 'Detaching…' : 'Detach now'}</button>}
                detail="Detach email from activity log now (default: 24h)"
                label="Early identity detachment"
              />
              <Row
                action={<button className="settings-btn settings-btn-ghost" disabled={exporting} onClick={downloadExport} type="button">{exporting ? 'Preparing…' : 'Request export'}</button>}
                detail="Get a copy of everything we hold"
                label="Download my data"
              />
            </div>
          </div>

          {/* Danger zone */}
          <div className="settings-section">
            <div className="settings-section-title">Danger Zone</div>
            <div className="settings-group settings-danger-zone">
              <Row action={<Link className="settings-btn settings-btn-danger" href="/api/auth/signout">Sign out</Link>} detail="Sign out of iHYPE on this device" label="Sign out" />
              <Row action={<button className="settings-btn settings-btn-danger" onClick={deleteAccount} type="button">Delete</button>} detail="Permanent. All data removed within 30 days." label="Delete account" />
            </div>
          </div>

          {error && <p style={{ color: '#ff5029', fontSize: 13 }}>{error}</p>}
          {saved && <p style={{ color: '#22e5d4', fontSize: 13, fontFamily: 'var(--font-mono)' }}>✓ Saved</p>}

          <button className="settings-btn settings-btn-accent" disabled={saving} onClick={save} style={{ width: '100%' }} type="button">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </>
      )}

      <style>{`
        .settings-page { max-width: 720px; margin: 0 auto; padding: 32px 24px 100px; }
        .settings-page h1 { font-family: var(--font-display); font-size: 32px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 40px; color: var(--ink); }
        .settings-section { margin-bottom: 40px; }
        .settings-section-title { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: rgba(240,235,229,.5); margin-bottom: 16px; }
        .settings-group { border: 1px solid rgba(255,255,255,.06); border-radius: 12px; overflow: hidden; background: var(--bg2); }
        .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,.06); gap: 16px; }
        .settings-row:last-child { border-bottom: none; }
        .settings-row-label { font-size: 14px; font-weight: 500; color: var(--ink); }
        .settings-row-detail { font-size: 12px; color: rgba(240,235,229,.5); margin-top: 3px; }
        .settings-toggle { position: relative; width: 44px; height: 26px; flex-shrink: 0; display: block; }
        .settings-toggle input { opacity: 0; width: 0; height: 0; }
        .settings-toggle-track { position: absolute; inset: 0; border-radius: 13px; background: rgba(255,255,255,.12); cursor: pointer; transition: background 200ms; }
        .settings-toggle input:checked + .settings-toggle-track { background: var(--accent); }
        .settings-toggle-thumb { position: absolute; width: 20px; height: 20px; top: 3px; left: 3px; border-radius: 50%; background: #fff; transition: transform 200ms cubic-bezier(.2,.7,.3,1); pointer-events: none; }
        .settings-toggle input:checked ~ .settings-toggle-thumb { transform: translateX(18px); }
        .settings-btn { padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 150ms; border: none; text-decoration: none; display: inline-block; }
        .settings-btn-ghost { background: rgba(255,255,255,.06); color: var(--ink); }
        .settings-btn-ghost:hover { background: rgba(255,255,255,.1); }
        .settings-btn-danger { background: rgba(239,68,68,.12); color: #ef4444; }
        .settings-btn-danger:hover { background: rgba(239,68,68,.22); }
        .settings-btn-accent { background: var(--accent); color: #fff; }
        .settings-btn-accent:hover { opacity: .9; }
        .settings-input-inline { padding: 8px 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: var(--bg); color: var(--ink); font-size: 14px; }
        .settings-input-inline:focus { outline: none; border-color: var(--accent); }
        .settings-danger-zone { border: 1px solid rgba(239,68,68,.2); }
        .settings-danger-zone .settings-row { border-color: rgba(239,68,68,.1); }
        .settings-payout-card { align-items: center; gap: 14px; }
        .settings-payout-ic { width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .settings-split-mini { display: flex; gap: 10px; margin-top: 10px; }
        .settings-split-mini span { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,.05); }
      `}</style>
    </div>
  );
}
