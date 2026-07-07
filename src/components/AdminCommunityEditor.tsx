'use client';

import { useState } from 'react';

export function AdminCommunityEditor() {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'update' | 'announcement'>('update');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/community/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, summary, body, category })
    });
    if (res.ok) {
      setMsg('Published.');
      setSlug('');
      setTitle('');
      setSummary('');
      setBody('');
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? 'Failed.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['update', 'announcement'] as const).map((c) => (
          <button
            key={c}
            className={category === c ? 'button small' : 'button small secondary'}
            onClick={() => setCategory(c)}
            type="button"
          >
            {c === 'update' ? 'Update' : 'Announcement'}
          </button>
        ))}
      </div>
      <input className="input" placeholder="slug-here" value={slug} onChange={(e) => setSlug(e.target.value)} required />
      <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input className="input" placeholder="One-line summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <textarea
        rows={8}
        placeholder="Full update…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="button" type="submit" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>
        {msg ? <span className="meta">{msg}</span> : null}
      </div>
    </form>
  );
}
