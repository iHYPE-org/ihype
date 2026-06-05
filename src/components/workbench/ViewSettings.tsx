'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkbenchData, WbPageEditor } from '@/types/workbench';
import { DEFAULT_PREFS } from './types';
import { IcLibrary, IcRadio, IcTicket, IcDisco, IcStudio, IcCheck } from './icons';
import { Toggle } from './Toggle';
import { Panel, TrackCard } from './primitives';

// ─────────────────────────────────────────────────────────────
// ViewLibrary (stub)
// ─────────────────────────────────────────────────────────────
export function ViewLibrary({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#b983ff', marginBottom: 10 }}>● YOUR SAVED TRACKS · {data.tracks.length} SONGS · 18 PLAYLISTS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Library</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Everything you&apos;ve HYPEd, saved from Discover seeds, or curated. Your library is yours.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { n: 'HYPEd tracks', c: '#ff3e9a', count: data.tracks.length },
          { n: 'Saved from seeds', c: '#ff5029', count: Math.floor(data.tracks.length * 0.4) },
          { n: 'Writing room', c: '#b983ff', count: 42 },
          { n: 'Tour van', c: '#22e5d4', count: 88 },
        ].map(p => (
          <div key={p.n} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', cursor: 'pointer' }}>
            <div style={{ aspectRatio: '1', borderRadius: 6, background: `linear-gradient(135deg, ${p.c}, ${p.c}80)`, marginBottom: 10 }} />
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.n}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{p.count} tracks</div>
          </div>
        ))}
      </div>
      <Panel title="Recent tracks">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, padding: '14px 16px' }}>
          {data.tracks.map((t, i) => <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />)}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewDiscover (stub)
// ─────────────────────────────────────────────────────────────
export function ViewDiscover({ data, onPickTrack, currentIdx }: { data: WorkbenchData; onPickTrack: (i: number) => void; currentIdx: number }) {
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● DISCOVER · SEEDS · NEW ARTISTS</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Discover</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>Swipe through 15–30 second seeds from new artists. Right to save, left to skip, up to HYPE.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {data.tracks.map((t, i) => <TrackCard key={t.id} track={t} active={i === currentIdx} onClick={() => onPickTrack(i)} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewSettings
// ─────────────────────────────────────────────────────────────
type EditorDraft = WbPageEditor;

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</span>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,80,41,.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,80,41,.1)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)'; e.currentTarget.style.boxShadow = 'none'; }}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, transition: 'border-color .15s, box-shadow .15s' }}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,80,41,.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,80,41,.1)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)'; e.currentTarget.style.boxShadow = 'none'; }}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, resize: 'vertical', lineHeight: 1.45, transition: 'border-color .15s, box-shadow .15s' }}
      />
    </label>
  );
}

function EditorPanel({ title, eyebrow, children, span = 1 }: { title: string; eyebrow?: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <section style={{ border: '1px solid var(--line-2)', borderRadius: 14, boxShadow: '0 2px 16px rgba(0,0,0,.25)', background: 'var(--bg-2)', padding: '18px 20px', gridColumn: span === 2 ? '1 / -1' : undefined }}>
      {eyebrow ? <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.16em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</div> : null}
      <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, letterSpacing: '-.015em', color: 'var(--ink)', margin: '0 0 14px' }}>{title}</h2>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </section>
  );
}

function ShowMiniList({ title, shows }: { title: string; shows: WbPageEditor['upcomingShows'] }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-3)' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{title}</div>
      {shows.length ? shows.slice(0, 4).map((show) => (
        <div key={show.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{show.name}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{show.venue} · {show.date}</div>
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>{show.hype} HYPE</div>
        </div>
      )) : <div style={{ padding: '12px', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>No shows yet.</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewSettings — public page editor
// ─────────────────────────────────────────────────────────────
function PasskeyPanel() {
  type PasskeyRow = { id: string; deviceType: string | null; createdAt: string; backedUp: boolean; name: string | null };
  const [passkeys, setPasskeys] = React.useState<PasskeyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [registering, setRegistering] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    fetch('/api/auth/passkey/list')
      .then(r => r.ok ? r.json() : { passkeys: [] })
      .then(d => setPasskeys(d.passkeys ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addPasskey() {
    setRegistering(true);
    setStatus('');
    try {
      const optRes = await fetch('/api/auth/passkey/register');
      if (!optRes.ok) throw new Error('Could not start passkey registration.');
      const options = await optRes.json();
      const { startRegistration } = await import('@simplewebauthn/browser');
      const attestation = await startRegistration(options);
      const verRes = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      if (!verRes.ok) throw new Error('Passkey registration failed.');
      const result = await verRes.json();
      setPasskeys(prev => [...prev, result.passkey]);
      setStatus('Passkey added successfully.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not add passkey.');
    } finally {
      setRegistering(false);
    }
  }

  async function removePasskey(id: string) {
    if (!confirm('Remove this passkey? You won\'t be able to use it to sign in.')) return;
    setDeleting(id);
    setStatus('');
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove passkey.');
      setPasskeys(prev => prev.filter(pk => pk.id !== id));
      setStatus('Passkey removed.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not remove passkey.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <EditorPanel title="Passkeys" eyebrow="Security">
      <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Passkeys let you sign in with Face ID, Touch ID, or a hardware key — no password needed.
      </p>
      {loading ? (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>
      ) : passkeys.length > 0 ? (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {passkeys.map(pk => (
            <div key={pk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-3)' }}>
              <span style={{ fontSize: 18 }}>🔑</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{pk.name || pk.deviceType || 'Passkey'}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  Added {new Date(pk.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {pk.backedUp ? ' · Synced' : ''}
                </div>
              </div>
              <button
                onClick={() => void removePasskey(pk.id)}
                disabled={deleting === pk.id}
                aria-label="Remove passkey"
                style={{ padding: '6px 10px', border: '1px solid rgba(255,80,80,.3)', borderRadius: 6, background: 'none', color: '#ff8080', fontFamily: 'var(--f-m)', fontSize: 11, cursor: deleting === pk.id ? 'wait' : 'pointer', flexShrink: 0 }}
              >
                {deleting === pk.id ? '…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>No passkeys yet.</div>
      )}
      <button
        onClick={() => void addPasskey()}
        disabled={registering}
        style={{ padding: '10px 16px', border: 'none', borderRadius: 7, background: 'linear-gradient(135deg, var(--accent), #ff3e9a)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 800, cursor: registering ? 'wait' : 'pointer' }}
      >
        {registering ? 'Setting up…' : 'Add a passkey'}
      </button>
      {status ? <p style={{ marginTop: 8, fontFamily: 'var(--f-m)', fontSize: 12, color: status.includes('success') || status.includes('removed') ? '#22e5d4' : '#ffb4a7' }}>{status}</p> : null}
    </EditorPanel>
  );
}

function StripeConnectPanel({ data }: { data: WorkbenchData }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const profileType = data.profileType ?? '';
  const isEligible = profileType === 'ARTIST' || profileType === 'DJ' || profileType === 'VENUE';
  const isOnboarded = data.stripeConnectOnboarded ?? false;

  if (!isEligible || !data.profileId) return null;

  async function startOnboarding() {
    setConnecting(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: data.profileId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not start payout setup.');
      window.location.href = payload.onboardingUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payout setup.');
      setConnecting(false);
    }
  }

  return (
    <EditorPanel title="Payout account" eyebrow="Revenue">
      {isOnboarded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Stripe connected</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>Your 45% share from ticket sales will be paid out to your connected bank account.</div>
          </div>
          <button
            onClick={() => void startOnboarding()}
            disabled={connecting}
            style={{ marginLeft: 'auto', padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: 6, background: 'none', color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 12, cursor: 'pointer' }}
          >
            {connecting ? 'Opening…' : 'Update account'}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
            Connect a bank account to receive your 45% share of ticket revenue. iHYPE uses Stripe to handle payouts securely.
          </p>
          <button
            onClick={() => void startOnboarding()}
            disabled={connecting}
            style={{ padding: '10px 16px', border: 'none', borderRadius: 7, background: 'linear-gradient(135deg, #635bff, #7c74ff)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 800, cursor: connecting ? 'wait' : 'pointer' }}
          >
            {connecting ? 'Opening Stripe…' : 'Connect payout account'}
          </button>
          {error ? <p style={{ marginTop: 8, fontFamily: 'var(--f-m)', fontSize: 12, color: '#ffb4a7' }}>{error}</p> : null}
        </div>
      )}
    </EditorPanel>
  );
}

export function ViewSettings({ prefs, setPref, data, onBack }: {
  prefs: typeof DEFAULT_PREFS;
  setPref: (k: string, v: unknown) => void;
  data: WorkbenchData;
  onBack?: () => void;
}) {
  const router = useRouter();
  const editor = data.pageEditor;
  const [draft, setDraft] = useState<EditorDraft | undefined>(editor);
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => setDraft(editor), [editor]);

  // Debounced autosave — fires 1.5 s after the last change, skips the initial load
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!draft) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      setAutoSaveState('saving');
      void (async () => {
        try {
          const response = await fetch('/api/profile-editor', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft),
          });
          if (!response.ok) throw new Error('autosave failed');
          setAutoSaveState('saved');
        } catch {
          setAutoSaveState('idle');
        }
      })();
    }, 1500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (!draft) {
    return (
      <div style={{ padding: '24px 32px 32px', maxWidth: 900 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● PAGE EDITOR</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Create your page</h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 620, lineHeight: 1.5 }}>Create a listener, artist, promoter, or venue profile to unlock page editing.</p>
        <div style={{ marginTop: 24 }}><StripeConnectPanel data={data} /></div>
        <div style={{ marginTop: 14 }}><PasskeyPanel /></div>
      </div>
    );
  }

  const currentDraft = draft;
  const role = currentDraft.type;
  const isArtist = role === 'ARTIST' || role === 'DJ';
  const isVenue = role === 'VENUE';
  const publicPath = role === 'VENUE' ? `/venues/${draft.slug}` : role === 'ARTIST' ? `/artists/${draft.slug}` : role === 'DJ' ? `/promoters/${draft.slug}` : `/fans/${draft.slug}`;
  const roleLabel = isArtist ? 'artist page' : isVenue ? 'venue page' : 'listener page';
  const patch = <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) => setDraft(prev => prev ? { ...prev, [key]: value } : prev);

  async function savePage() {
    if (!draft) return;
    setSaving(true);
    setStatus('Saving page…');
    try {
      const response = await fetch('/api/profile-editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not save page.');
      setStatus('Page saved. Public profile updated.');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save page.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadSong(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isArtist) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('profileId', currentDraft.profileId);
    setUploading(true);
    setStatus('Uploading song…');
    try {
      const response = await fetch('/api/artist-media', { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not upload song.');
      const asset = payload.asset as { hexId: string; title: string; notes?: string | null; freeUseEnabled?: boolean };
      patch('songs', [{ hexId: asset.hexId, title: asset.title, notes: asset.notes ?? null, freeUseEnabled: Boolean(asset.freeUseEnabled) }, ...currentDraft.songs]);
      form.reset();
      setStatus('Song uploaded. You can publish it as a seed below.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not upload song.');
    } finally {
      setUploading(false);
    }
  }

  async function toggleSeed(hexId: string, freeUseEnabled: boolean) {
    setStatus(freeUseEnabled ? 'Publishing seed…' : 'Removing seed…');
    const nextSongs = currentDraft.songs.map(song => song.hexId === hexId ? { ...song, freeUseEnabled } : song);
    patch('songs', nextSongs);
    try {
      const response = await fetch(`/api/artist-media/${hexId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeUseEnabled })
      });
      if (!response.ok) throw new Error('Could not update seed status.');
      setStatus(freeUseEnabled ? 'Seed is live in discovery.' : 'Seed removed from discovery.');
    } catch (error) {
      patch('songs', currentDraft.songs);
      setStatus(error instanceof Error ? error.message : 'Could not update seed status.');
    }
  }

  return (
    <div style={{ padding: '24px 32px 32px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 10 }}>● PAGE EDITOR · {roleLabel.toUpperCase()}</div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Edit your public page</h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 680, lineHeight: 1.5 }}>Control what fans, artists, promoters, and venues see: layout, background, media, top 5, songs, links, shows, ticketing, merch, and venue details.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {onBack && <button onClick={onBack} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.04em', background: 'none', cursor: 'pointer' }}>← Back</button>}
          <a href={publicPath} target="_blank" rel="noreferrer" style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.04em', textDecoration: 'none' }}>View page</a>
          {autoSaveState !== 'idle' && (
            <span style={{
              padding: '5px 10px',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 11,
              letterSpacing: '.04em',
              background: autoSaveState === 'saving' ? 'rgba(255,184,74,.12)' : 'rgba(34,229,212,.12)',
              color: autoSaveState === 'saving' ? '#ffb84a' : '#22e5d4',
              border: `1px solid ${autoSaveState === 'saving' ? 'rgba(255,184,74,.3)' : 'rgba(34,229,212,.3)'}`,
              transition: 'opacity .3s',
              whiteSpace: 'nowrap',
            }}>
              {autoSaveState === 'saving' ? 'saving…' : '✓ saved'}
            </span>
          )}
          <button onClick={() => void savePage()} disabled={saving} style={{ padding: '10px 16px', border: 'none', borderRadius: 7, fontFamily: 'var(--f-m)', fontSize: 13, color: '#fff', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: `linear-gradient(135deg, ${prefs.accent}, #ff3e9a)`, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving…' : 'Save page'}</button>
        </div>
      </div>

      {status ? <div style={{ marginBottom: 14, padding: '11px 14px', border: '1px solid rgba(255,80,41,.2)', borderRadius: 10, background: status.includes('Could not') ? 'rgba(255,80,80,.08)' : 'rgba(255,80,41,.06)', color: status.includes('Could not') ? '#ffb4a7' : 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 13 }}>{status}</div> : null}

      {data.profileCompletion && data.profileCompletion.percent < 100 && (
        <div style={{ marginBottom: 14, padding: '14px 16px', border: '1px solid rgba(255,184,74,.2)', borderRadius: 10, background: 'rgba(255,184,74,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#ffb84a', letterSpacing: '.08em' }}>PROFILE {data.profileCompletion.percent}% COMPLETE</span>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>{data.profileCompletion.missing.length} field{data.profileCompletion.missing.length !== 1 ? 's' : ''} missing</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${data.profileCompletion.percent}%`, background: 'linear-gradient(90deg, #ffb84a, #ff5029)', borderRadius: 3, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.profileCompletion.missing.map(field => (
              <span key={field} style={{ padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(255,184,74,.3)', fontFamily: 'var(--f-m)', fontSize: 11, color: '#ffb84a' }}>{field}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 14 }}>
        <EditorPanel title="Identity + layout" eyebrow="Who you are" span={2}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Display name" value={draft.name} onChange={(value) => patch('name', value)} />
            <Field label="Headline" value={draft.headline} onChange={(value) => patch('headline', value)} placeholder="One-line hook for your page" />
            <TextArea label="Bio" value={draft.bio} onChange={(value) => patch('bio', value)} placeholder="Short intro shown near the top of the page" />
            <TextArea label="About section" value={draft.aboutContent} onChange={(value) => patch('aboutContent', value)} placeholder="Longer story, page context, or booking notes" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <TextArea label="Top 5" value={draft.topFiveContent} onChange={(value) => patch('topFiveContent', value)} placeholder="Top 5 artists, records, shows, or moments" rows={5} />
            <TextArea label="Songs I'm listening to / now playing" value={draft.nowPlaying} onChange={(value) => patch('nowPlaying', value)} placeholder="What is in rotation right now?" rows={5} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)' }}>
            <Toggle on={draft.fanShareEnabled} onChange={(value) => patch('fanShareEnabled', value)} small /> Make this custom page visible publicly
          </label>
        </EditorPanel>

        <EditorPanel title="Background, graphics + media" eyebrow="Visual system">
          <Field label="Hero/background image URL" value={draft.heroImage} onChange={(value) => patch('heroImage', value)} placeholder="https://…" />
          <Field label="Avatar / portrait URL" value={draft.avatarImage} onChange={(value) => patch('avatarImage', value)} placeholder="https://…" />
          <Field label="Logo image URL" value={draft.logoImage} onChange={(value) => patch('logoImage', value)} placeholder="https://…" />
          <Field label="Gallery / feature image URL" value={draft.galleryImage} onChange={(value) => patch('galleryImage', value)} placeholder="https://…" />
          <Field label="Feature video URL" value={draft.featureVideoUrl} onChange={(value) => patch('featureVideoUrl', value)} placeholder="https://…" />
          <TextArea label="Media section copy" value={draft.mediaContent} onChange={(value) => patch('mediaContent', value)} placeholder="Describe videos, photos, press shots, or listening assets" />
        </EditorPanel>

        <EditorPanel title="Live preview" eyebrow="Public card">
          <div style={{ border: '1px solid var(--line-2)', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-3), var(--bg))' }}>
            <div style={{ height: 120, background: draft.heroImage ? `url(${draft.heroImage}) center/cover` : `linear-gradient(135deg, ${prefs.accent}, #ff3e9a, #b983ff)` }} />
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 58, height: 58, borderRadius: 12, background: draft.avatarImage ? `url(${draft.avatarImage}) center/cover` : `linear-gradient(135deg, ${prefs.accent}, #b983ff)`, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{draft.name || data.userName}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', color: 'var(--accent)', textTransform: 'uppercase' }}>{roleLabel}</div>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--f-b)', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.45 }}>{draft.headline || 'Add a headline to frame your page.'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-2)' }}><strong style={{ color: 'var(--ink)' }}>Top 5</strong><br/><span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{draft.topFiveContent ? draft.topFiveContent.split('\n')[0] : 'Add your first pick'}</span></div>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-2)' }}><strong style={{ color: 'var(--ink)' }}>Now</strong><br/><span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{draft.nowPlaying || 'Listening notes'}</span></div>
              </div>
            </div>
          </div>
        </EditorPanel>

        {isArtist ? (
          <EditorPanel title="Songs, seeds, merch + touring" eyebrow="Artist tools" span={2}>
            <form onSubmit={(event) => void uploadSong(event)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end', border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--bg-3)' }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>Song title</span>
                <input name="title" aria-label="Song title" placeholder="Optional title" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13 }} />
              </label>
              <label style={{ display: 'block' }}><span style={{ display: 'block', fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>Audio file</span><input name="file" type="file" accept="audio/*" required style={{ color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 12 }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)' }}><input name="freeUseEnabled" value="true" type="checkbox" /> Publish as seed</label>
              <button disabled={uploading} style={{ padding: '10px 14px', borderRadius: 7, border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-m)', fontWeight: 800, cursor: uploading ? 'wait' : 'pointer' }}>{uploading ? 'Uploading…' : 'Upload song'}</button>
            </form>
            <div style={{ display: 'grid', gap: 8 }}>
              {currentDraft.songs.length ? currentDraft.songs.map(song => (
                <div key={song.hexId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-3)' }}>
                  <div style={{ flex: 1 }}><div style={{ color: 'var(--ink)', fontFamily: 'var(--f-d)', fontWeight: 700 }}>{song.title}</div><div style={{ color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 11 }}>{song.notes || 'No notes yet'}</div></div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 12 }}><Toggle small on={song.freeUseEnabled} onChange={(value) => void toggleSeed(song.hexId, value)} /> Seed</label>
                </div>
              )) : <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 12 }}>Upload songs to build seeds from your catalog.</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Website / links" value={draft.links} onChange={(value) => patch('links', value)} placeholder="Website, socials, press links" />
              <Field label="Merch URL" value={draft.merchUrl} onChange={(value) => patch('merchUrl', value)} placeholder="https://…" />
              <TextArea label="Merch section" value={draft.merchContent} onChange={(value) => patch('merchContent', value)} />
              <TextArea label="Tour / ticketing info" value={draft.tourContent} onChange={(value) => patch('tourContent', value)} placeholder="Dates, routing, ticket notes, booking context" />
            </div>
            <ShowMiniList title="Upcoming shows connected to this page" shows={draft.upcomingShows} />
          </EditorPanel>
        ) : null}

        {isVenue ? (
          <EditorPanel title="Venue details, shows + local guidance" eyebrow="Venue tools" span={2}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Address" value={draft.addressLine1} onChange={(value) => patch('addressLine1', value)} />
              <Field label="Hours" value={draft.hoursText} onChange={(value) => patch('hoursText', value)} placeholder="Tue–Sun · 5PM–1AM" />
              <Field label="City" value={draft.city} onChange={(value) => patch('city', value)} />
              <Field label="State / region" value={draft.stateRegion} onChange={(value) => patch('stateRegion', value)} />
              <TextArea label="Parking details" value={draft.parkingDetails} onChange={(value) => patch('parkingDetails', value)} />
              <TextArea label="Stay recommendations" value={draft.stayRecommendations} onChange={(value) => patch('stayRecommendations', value)} />
              <TextArea label="Upcoming shows intro" value={draft.upcomingContent} onChange={(value) => patch('upcomingContent', value)} />
              <TextArea label="Previous show highlights" value={draft.previousShowHighlights} onChange={(value) => patch('previousShowHighlights', value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ShowMiniList title="Upcoming shows" shows={draft.upcomingShows} />
              <ShowMiniList title="Previous shows" shows={draft.previousShows} />
            </div>
          </EditorPanel>
        ) : null}

        {!isArtist && !isVenue ? (
          <EditorPanel title="Listener page sections" eyebrow="Fan page" span={2}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <TextArea label="Top 5 artists / records / moments" value={draft.topFiveContent} onChange={(value) => patch('topFiveContent', value)} rows={6} />
              <TextArea label="Songs I'm listening to" value={draft.nowPlaying} onChange={(value) => patch('nowPlaying', value)} rows={6} />
              <TextArea label="Media / playlists / notes" value={draft.mediaContent} onChange={(value) => patch('mediaContent', value)} />
              <TextArea label="Links" value={draft.links} onChange={(value) => patch('links', value)} placeholder="Playlist links, socials, recommendation forms" />
            </div>
          </EditorPanel>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}><StripeConnectPanel data={data} /></div>

      <div style={{ marginTop: 14 }}><PasskeyPanel /></div>

      <div style={{ marginTop: 20, padding: '14px 18px', border: '1px dashed var(--line-2)', borderRadius: 8, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', letterSpacing: '.02em' }}>
        This editor changes your public page, not your browsing experience. Use it to curate the layout, background, media, songs, top 5, links, shows, merch, ticketing, and venue info visitors see.
      </div>
    </div>
  );
}
