'use client';

import { useEffect, useRef, useState } from 'react';

type ProfileHit = { id: string; name: string; type: string };

/**
 * Get-updates-by-email form for POST /api/newsletter/subscribe. That route
 * subscribes to a *specific* profile's updates (double opt-in — it emails a
 * 24h confirm link, see src/app/api/newsletter/confirm/route.ts), not a
 * single sitewide list — there's no "iHYPE" platform profile row to target,
 * so the picker below lets a visitor choose the real artist/venue/DJ profile
 * they want updates from, reusing the same /api/search endpoint the event
 * creator's ProfilePicker (src/app/events/new/page.tsx) already queries.
 */
export function NewsletterSignup() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileHit[]>([]);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileHit | null>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=artist`);
        if (!res.ok) return;
        const data = await res.json() as { results?: Array<{ id: string; name: string; type: string }> };
        const filtered = (data.results ?? []).filter((p) => ['artist', 'venue', 'promoter'].includes(p.type));
        setResults(filtered.slice(0, 6));
        setOpen(true);
      } catch { /* ignore */ }
    }, 280);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!profile) { setError('Pick an artist, venue, or DJ first.'); return; }
    if (!email.trim()) { setError('Enter your email.'); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), profileId: profile.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not subscribe.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not subscribe.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={{ fontSize: 13, color: '#22e5d4', padding: '12px 16px', background: 'rgba(34,229,212,.08)', borderRadius: 8 }}>
        ✓ Check {email} for a confirm link — you&apos;re one click from updates on {profile?.name}.
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field" ref={containerRef} style={{ position: 'relative' }}>
        <span>Artist, venue, or DJ</span>
        {profile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,80,41,.07)', border: '1px solid rgba(255,80,41,.2)', borderRadius: 10 }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{profile.name}</div>
            <button onClick={() => setProfile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-a50)', fontSize: 18, lineHeight: 1, padding: '0 4px' }} type="button">×</button>
          </div>
        ) : (
          <input
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search for who you want updates from…"
            type="text"
            value={query}
          />
        )}
        {!profile && open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
            background: '#1a1510', border: '1px solid var(--hair-100)', borderRadius: 8,
            overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          }}>
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => { setProfile(p); setQuery(''); setOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--hair-50)' }}
                type="button"
              >
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-a50)', fontFamily: 'var(--font-mono)' }}>{p.type}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="field">
        <span>Email</span>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
      </label>

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Subscribing…' : 'Get Updates'}
      </button>
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </form>
  );
}
