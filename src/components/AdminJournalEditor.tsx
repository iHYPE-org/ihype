'use client';

import { useState } from 'react';

export function AdminJournalEditor() {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/journal/editorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, excerpt, body, author })
    });
    if (res.ok) {
      setMsg('Published.');
      setSlug('');
      setTitle('');
      setExcerpt('');
      setBody('');
      setAuthor('');
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? 'Failed.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <input className="input" placeholder="slug-here" value={slug} onChange={(e) => setSlug(e.target.value)} required />
      <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input className="input" placeholder="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      <input className="input" placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <textarea
        rows={10}
        placeholder="Post body…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="button" type="submit" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>
        {msg ? <span className="meta">{msg}</span> : null}
      </div>
    </form>
  );
}
