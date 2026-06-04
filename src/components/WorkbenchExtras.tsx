'use client';

import { useEffect, useState } from 'react';
import { RoadJournalWidget } from './RoadJournalWidget';

type Props = {
  activeProfileTypes: string[];
  profileId: string | null;
  profilePath: string | null;
  profileSlug: string | null;
  userEmail: string | null;
};

type ReferralStats = {
  clicks: number;
  signups: number;
  ticketSales: number;
  grossRevenueCents: number;
  estimatedCommissionCents: number;
};

const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--f-m, monospace)',
  fontSize: 10,
  letterSpacing: '.14em',
  color: 'var(--ink-3)',
  marginBottom: 6
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}


function ReferralEarningsCard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/referrals/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.clicks === 'number') setStats(j as ReferralStats);
        else setErr('Could not load referrals.');
      })
      .catch(() => setErr('Could not load referrals.'));
  }, []);
  return (
    <section className="wb-panel" style={{ marginTop: 16, padding: '14px 22px' }}>
      <div style={eyebrow}>● REFERRAL EARNINGS</div>
      {err ? (
        <p className="wb-page-sub" style={{ margin: 0, fontSize: 12 }}>{err}</p>
      ) : !stats ? (
        <p className="wb-page-sub" style={{ margin: 0, fontSize: 12 }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div>
            <div style={eyebrow}>CLICKS</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18 }}>{stats.clicks}</div>
          </div>
          <div>
            <div style={eyebrow}>SIGNUPS</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18 }}>{stats.signups}</div>
          </div>
          <div>
            <div style={eyebrow}>TICKETS</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18 }}>{stats.ticketSales}</div>
          </div>
          <div>
            <div style={eyebrow}>EST. COMMISSION</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18 }}>
              {dollars(stats.estimatedCommissionCents)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function JournalPostCard({ profileId }: { profileId: string }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, title, content })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Post failed.');
      setTitle('');
      setContent('');
      setStatus('Posted — visible on your public profile.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Post failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wb-panel" style={{ marginTop: 16, padding: '14px 22px' }}>
      <div style={eyebrow}>● POST AN UPDATE</div>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginTop: 6 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="Title"
          style={{
            padding: '8px 10px',
            background: 'var(--wb-bg-3, var(--bg-3))',
            border: '1px solid var(--wb-line-2, var(--line-2))',
            color: 'var(--wb-ink, var(--ink))',
            borderRadius: 6,
            fontFamily: 'var(--f-b)'
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          placeholder="What's new?"
          rows={3}
          style={{
            padding: '8px 10px',
            background: 'var(--wb-bg-3, var(--bg-3))',
            border: '1px solid var(--wb-line-2, var(--line-2))',
            color: 'var(--wb-ink, var(--ink))',
            borderRadius: 6,
            fontFamily: 'var(--f-b)'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="wb-btn-prime" type="submit" disabled={busy || !title.trim() || !content.trim()}>
            {busy ? 'Posting…' : 'Post update'}
          </button>
        </div>
        {status ? <p className="wb-page-sub" style={{ margin: 0, fontSize: 12 }}>{status}</p> : null}
      </form>
    </section>
  );
}

function PremiumInterestCard({ userEmail }: { userEmail: string | null }) {
  const [email, setEmail] = useState(userEmail ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/premium/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, note })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not register interest.');
      setStatus("Thanks — we'll be in touch as Premium evolves.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not register interest.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="wb-panel"
      style={{
        marginTop: 16,
        padding: '14px 22px',
        background: 'linear-gradient(135deg, rgba(255,80,41,0.07), rgba(255,62,154,0.05))',
        border: '1px solid rgba(255,80,41,0.25)'
      }}
    >
      <div style={eyebrow}>● PREMIUM (COMING SOON)</div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
        Go Premium
      </div>
      <p className="wb-page-sub" style={{ margin: '0 0 8px', fontSize: 12 }}>
        Early access, ad-free playback, deeper analytics, and direct artist support — leave your email if interested.
      </p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            padding: '8px 10px',
            background: 'var(--wb-bg-3, var(--bg-3))',
            border: '1px solid var(--wb-line-2, var(--line-2))',
            color: 'var(--wb-ink, var(--ink))',
            borderRadius: 6
          }}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="What would make Premium worth it for you? (optional)"
          style={{
            padding: '8px 10px',
            background: 'var(--wb-bg-3, var(--bg-3))',
            border: '1px solid var(--wb-line-2, var(--line-2))',
            color: 'var(--wb-ink, var(--ink))',
            borderRadius: 6
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="wb-btn-prime" type="submit" disabled={busy || !email.trim()}>
            {busy ? 'Saving…' : "I'm interested"}
          </button>
        </div>
        {status ? <p className="wb-page-sub" style={{ margin: 0, fontSize: 12 }}>{status}</p> : null}
      </form>
    </section>
  );
}

export function WorkbenchExtras({ activeProfileTypes, profileId, profilePath: _profilePath, profileSlug, userEmail }: Props) {
  const isArtist = activeProfileTypes.includes('ARTIST');
  const isFan = activeProfileTypes.length === 0 || activeProfileTypes.includes('LISTENER');
  return (
    <>
      {isArtist && profileId && profileSlug ? <RoadJournalWidget profileId={profileId} profileSlug={profileSlug} /> : null}
      <ReferralEarningsCard />
      {(isFan || activeProfileTypes.includes('LISTENER')) ? (
        <PremiumInterestCard userEmail={userEmail} />
      ) : null}
    </>
  );
}
