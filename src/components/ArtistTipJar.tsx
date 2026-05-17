'use client';

import { useState } from 'react';

type Props = {
  profileId: string;
  artistName: string;
};

const PRESETS = [
  { label: '$1', cents: 100 },
  { label: '$3', cents: 300 },
  { label: '$5', cents: 500 }
];

export function ArtistTipJar({ profileId, artistName }: Props) {
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submitTip(amountCents: number) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, amountCents })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; clientSecret?: string };
      if (!res.ok) {
        setStatus({ kind: 'err', text: json.error ?? 'Tip failed.' });
      } else {
        setStatus({
          kind: 'ok',
          text: `Tip of $${(amountCents / 100).toFixed(2)} for ${artistName} created. Check your email for the confirmation.`
        });
      }
    } catch (err) {
      setStatus({ kind: 'err', text: err instanceof Error ? err.message : 'Tip failed.' });
    } finally {
      setBusy(false);
    }
  }

  function handleCustom() {
    const dollars = parseFloat(customAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setStatus({ kind: 'err', text: 'Enter a positive amount.' });
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents < 100) {
      setStatus({ kind: 'err', text: 'Minimum custom tip is $1.' });
      return;
    }
    if (cents > 50000) {
      setStatus({ kind: 'err', text: 'Maximum custom tip is $500.' });
      return;
    }
    void submitTip(cents);
  }

  if (!open) {
    return (
      <button
        className="button small"
        type="button"
        onClick={() => setOpen(true)}
        style={{ marginTop: 12 }}
      >
        Support this artist
      </button>
    );
  }

  return (
    <div
      className="panel"
      style={{
        marginTop: 12,
        padding: '14px 16px',
        border: '1px solid var(--line-2)',
        borderRadius: 10
      }}
    >
      <div
        style={{
          fontFamily: 'var(--f-m)',
          fontSize: 11,
          letterSpacing: '.14em',
          color: 'var(--ink-3)',
          marginBottom: 8
        }}
      >
        SUPPORT {artistName.toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {PRESETS.map((p) => (
          <button
            key={p.cents}
            className="button small secondary"
            type="button"
            disabled={busy}
            onClick={() => void submitTip(p.cents)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Custom"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--bg-3)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
            borderRadius: 6
          }}
        />
        <button className="button small" type="button" disabled={busy} onClick={handleCustom}>
          Tip
        </button>
        <button
          className="button small secondary"
          type="button"
          onClick={() => {
            setOpen(false);
            setStatus(null);
          }}
        >
          Cancel
        </button>
      </div>
      {status ? (
        <p
          className="meta"
          style={{
            marginTop: 8,
            color: status.kind === 'ok' ? 'var(--r-venue)' : 'var(--accent)'
          }}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
