'use client';

import { useState } from 'react';

export function ShowSetlistEditor({
  showId,
  initialTracks
}: {
  showId: string;
  initialTracks: string[];
}) {
  const [text, setText] = useState(initialTracks.join('\n'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const tracks = text.split('\n').map((s) => s.trim()).filter(Boolean);
    const res = await fetch(`/api/shows/${showId}/setlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks })
    });
    if (res.ok) setMsg('Saved.');
    else setMsg('Could not save.');
    setBusy(false);
  }

  return (
    <section className="section">
      <h2>Setlist (owner only)</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="One track per line…"
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--bg-3)',
          border: '1px solid var(--line)',
          color: 'var(--ink)',
          fontFamily: 'var(--f-b)'
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button className="button small" onClick={save} disabled={busy} type="button">
          {busy ? 'Saving…' : 'Save setlist'}
        </button>
        {msg ? <span className="meta">{msg}</span> : null}
      </div>
    </section>
  );
}
