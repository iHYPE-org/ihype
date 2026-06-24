'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
// CSSProperties used by labelStyle
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 1 | 2 | 3;

function fmt$(dollars: number) {
  return `$${dollars.toFixed(2)}`;
}

const GENRE_OPTIONS = [
  'Electronic', 'Hip-Hop', 'Indie', 'Jazz', 'R&B', 'Rock',
  'Deep House', 'Tech House', 'Ambient', 'Experimental', 'Other',
];

// inputs use className="ihype-input" from globals.css
const inputStyle: CSSProperties = {};

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
  fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
  color: 'rgba(240,235,229,.45)', marginBottom: 6,
};

export default function EventsNewPage() {
  const router = useRouter();

  // Step 1 — basics
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [datetime, setDatetime] = useState('');
  const [city, setCity] = useState('');

  // Step 2 — ticketing
  const [isTicketed, setIsTicketed] = useState(true);
  const [price, setPrice] = useState('25');
  const [capacity, setCapacity] = useState('200');
  const [description, setDescription] = useState('');

  // Step 3 — review + submit
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceDollars = parseFloat(price || '0');
  const cap = parseInt(capacity, 10) || 200;
  const artistCut = fmt$(priceDollars * 0.45);
  const venueCut = fmt$(priceDollars * 0.45);
  const promoterCut = fmt$(priceDollars * 0.10);

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'New Show',
          description: description.trim() || undefined,
          status: 'SCHEDULED',
          startsAt: datetime
            ? new Date(datetime).toISOString()
            : new Date(Date.now() + 7 * 86400000).toISOString(),
          isTicketed: isTicketed && priceDollars > 0,
          ticketPriceCents: Math.round(priceDollars * 100),
          ticketCapacity: cap,
          venuePayoutPercent: 45,
          artistPayoutPercent: 45,
          promoterPayoutPercent: 10,
          tags: genre ? [genre.toLowerCase().replace(/\s+/g, '-')] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create show');
        setSubmitting(false);
        return;
      }
      router.push(`/shows/${data.slug}`);
    } catch {
      setError('Network error — please try again');
      setSubmitting(false);
    }
  }

  const STEPS = ['Details', 'Ticketing', 'Review'];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link href="/studio" style={{ fontSize: 12, color: 'rgba(240,235,229,.4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
          ← STUDIO
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 0' }}>
          New show
        </h1>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 36, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
        {STEPS.map((s, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <button
              key={s}
              onClick={() => done && setStep(n)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: done ? 'pointer' : 'default',
                background: active ? 'rgba(255,80,41,.15)' : done ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.02)',
                color: active ? 'var(--accent, #ff5029)' : done ? 'rgba(240,235,229,.7)' : 'rgba(240,235,229,.3)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
                borderRight: i < 2 ? '1px solid rgba(255,255,255,.08)' : 'none',
              }}
            >
              {done ? '✓ ' : `${n}. `}{s}
            </button>
          );
        })}
      </div>

      {/* Step 1 — Details */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Show title *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Late Night Frequencies Vol. 3"
              className="ihype-input"
            />
          </div>
          <div>
            <label style={labelStyle}>Date &amp; time *</label>
            <input
              type="datetime-local" value={datetime}
              onChange={e => setDatetime(e.target.value)}
              className="ihype-input"
            />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input
              value={city} onChange={e => setCity(e.target.value)}
              placeholder="Portland, ME"
              className="ihype-input"
            />
          </div>
          <div>
            <label style={labelStyle}>Genre</label>
            <select value={genre} onChange={e => setGenre(e.target.value)} className="ihype-input">
              <option value="">Select genre…</option>
              {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Tell fans what to expect…"
              rows={3}
              className="ihype-input" style={{ resize: "vertical" }}
            />
          </div>
          <button
            onClick={() => title.trim() && datetime ? setStep(2) : setError('Title and date are required')}
            className="ihype-btn-primary"
            style={{ width: '100%' }}
          >
            Continue →
          </button>
          {error && <p style={{ color: '#ff5029', fontSize: 13, margin: 0 }}>{error}</p>}
        </div>
      )}

      {/* Step 2 — Ticketing */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[true, false].map(t => (
              <button
                key={String(t)}
                onClick={() => setIsTicketed(t)}
                style={{
                  flex: 1, padding: '12px', border: `1px solid ${isTicketed === t ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.1)'}`,
                  borderRadius: 8, background: isTicketed === t ? 'rgba(255,80,41,.12)' : 'transparent',
                  color: isTicketed === t ? 'var(--accent)' : 'rgba(240,235,229,.6)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                {t ? '🎟️ Ticketed' : '🆓 Free entry'}
              </button>
            ))}
          </div>

          {isTicketed && (
            <>
              <div>
                <label style={labelStyle}>Ticket price (USD)</label>
                <input
                  type="number" min="1" step="1" value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="ihype-input"
                />
              </div>
              <div>
                <label style={labelStyle}>Capacity</label>
                <input
                  type="number" min="1" step="1" value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  className="ihype-input"
                />
              </div>

              {/* Split preview */}
              <div style={{ padding: '16px 18px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, background: 'var(--bg-2, #100d09)' }}>
                <p style={{ ...labelStyle, marginBottom: 12 }}>Per-ticket split — locked in the charter</p>
                {[
                  { label: 'Artist', pct: '45%', val: artistCut, color: '#ff5029' },
                  { label: 'Venue', pct: '45%', val: venueCut, color: '#22e5d4' },
                  { label: 'Promoter', pct: '10%', val: promoterCut, color: '#ff3e9a' },
                  { label: 'iHYPE', pct: '0%', val: '$0.00', color: 'rgba(240,235,229,.3)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ fontSize: 13, color: row.color }}>{row.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: row.color }}>{row.pct} · {row.val}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} className="ihype-btn-ghost" style={{ flex: 1 }}>← Back</button>
            <button onClick={() => setStep(3)} className="ihype-btn-primary" style={{ flex: 2 }}>Review →</button>
          </div>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ padding: '20px 22px', border: '1px solid rgba(255,80,41,.2)', borderRadius: 10, background: 'rgba(255,80,41,.06)' }}>
            <p style={labelStyle}>Show</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, margin: '0 0 4px' }}>{title}</p>
            <p style={{ fontSize: 13, color: 'rgba(240,235,229,.5)', margin: 0 }}>
              {datetime ? new Date(datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date TBD'}
              {city ? ` · ${city}` : ''}
              {genre ? ` · ${genre}` : ''}
            </p>
          </div>

          <div style={{ padding: '16px 20px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, background: 'var(--bg-2, #100d09)' }}>
            <p style={labelStyle}>Ticketing</p>
            {isTicketed && priceDollars > 0 ? (
              <p style={{ fontSize: 14, margin: 0, color: 'var(--ink)' }}>
                {fmt$(priceDollars)} per ticket · {cap.toLocaleString()} capacity · <span style={{ color: '#22e5d4' }}>$0.00 platform fee</span>
              </p>
            ) : (
              <p style={{ fontSize: 14, margin: 0, color: 'var(--ink)' }}>Free entry</p>
            )}
          </div>

          {error && <p style={{ color: '#ff5029', fontSize: 13, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} className="ihype-btn-ghost" style={{ flex: 1 }}>← Back</button>
            <button onClick={publish} disabled={submitting} className="ihype-btn-primary" style={{ flex: 2 }}>
              {submitting ? 'Publishing…' : 'Publish show →'}
            </button>
          </div>

          <p style={{ fontSize: 11, color: 'rgba(240,235,229,.25)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em', textAlign: 'center' }}>
            iHYPE takes 0% · 45% artist · 45% venue · 10% promoters
          </p>
        </div>
      )}
    </div>
  );
}
