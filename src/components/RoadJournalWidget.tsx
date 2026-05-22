'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type Entry = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

type Mode = 'list' | 'write' | 'edit';

const input: React.CSSProperties = {
  padding: '9px 11px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'inherit',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: '0.88rem',
  width: '100%',
  boxSizing: 'border-box',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function charCount(n: number, max: number) {
  const pct = n / max;
  const color = pct > 0.9 ? '#ff5029' : pct > 0.75 ? '#fbbf24' : 'rgba(255,255,255,0.3)';
  return <span style={{ fontSize: '0.62rem', color }}>{n}/{max}</span>;
}

export function RoadJournalWidget({ profileId, profileSlug }: { profileId: string; profileSlug: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('list');
  const [editTarget, setEditTarget] = useState<Entry | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/journal?profileId=${profileId}`);
      const json = (await res.json()) as { entries?: Entry[] };
      setEntries(json.entries ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  function startWrite() {
    setTitle(''); setContent(''); setEditTarget(null); setStatus(null); setMode('write');
  }

  function startEdit(e: Entry) {
    setTitle(e.title); setContent(e.content); setEditTarget(e); setStatus(null); setMode('edit');
  }

  function cancel() {
    setMode('list'); setStatus(null); setTitle(''); setContent(''); setEditTarget(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true); setStatus(null);
    try {
      if (mode === 'edit' && editTarget) {
        const res = await fetch('/api/journal', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editTarget.id, title, content }),
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Edit failed.');
      } else {
        const res = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, title, content }),
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Post failed.');
      }
      await load();
      cancel();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/journal?id=${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  const eyebrow: React.CSSProperties = {
    fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em',
    opacity: 0.4, fontFamily: 'var(--f-m, monospace)',
  };

  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={eyebrow}>● ROAD JOURNAL</div>
          <div style={{ fontSize: '0.72rem', opacity: 0.45, marginTop: 2 }}>
            Tour thoughts, show recaps, studio notes — visible on your profile.
          </div>
        </div>
        {mode === 'list' && (
          <button
            onClick={startWrite}
            style={{ fontSize: '0.75rem', padding: '5px 12px', background: 'var(--accent, #ff5029)', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }}
          >
            + New entry
          </button>
        )}
      </div>

      {(mode === 'write' || mode === 'edit') && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8, padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: 2 }}>
            {mode === 'edit' ? 'Edit entry' : 'New road journal entry'}
          </div>
          <div>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Title — show name, city, date, or thought…"
              style={input}
              autoFocus
            />
            <div style={{ textAlign: 'right', marginTop: 2 }}>{charCount(title.length, 140)}</div>
          </div>
          <div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={5000}
              placeholder="What happened? How did the set feel? What's on your mind after the show? Write anything."
              rows={6}
              style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ textAlign: 'right', marginTop: 2 }}>{charCount(content.length, 5000)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={cancel} style={{ fontSize: '0.78rem', padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'inherit', borderRadius: 5, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !title.trim() || !content.trim()} style={{ fontSize: '0.78rem', padding: '6px 14px', background: 'var(--accent, #ff5029)', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', opacity: (busy || !title.trim() || !content.trim()) ? 0.5 : 1 }}>
              {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Publish'}
            </button>
          </div>
          {status && <p style={{ margin: 0, fontSize: '0.72rem', color: '#ff5029' }}>{status}</p>}
        </form>
      )}

      {mode === 'list' && (
        <div style={{ display: 'grid', gap: 1 }}>
          {loading && <div style={{ fontSize: '0.75rem', opacity: 0.4, padding: '8px 0' }}>Loading…</div>}
          {!loading && entries.length === 0 && (
            <div style={{ fontSize: '0.75rem', opacity: 0.4, padding: '10px 0' }}>
              No entries yet. Write about your last show, your thoughts on the road, or what's coming next.
            </div>
          )}
          {entries.map((e, i) => {
            const expanded = expandedId === e.id;
            const preview = e.content.slice(0, 160) + (e.content.length > 160 ? '…' : '');
            return (
              <div key={e.id} style={{ padding: '10px 0', borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>{e.title}</div>
                    <div style={{ fontSize: '0.62rem', opacity: 0.35, marginBottom: 5 }}>{fmt(e.createdAt)}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {expanded ? e.content : preview}
                    </div>
                    {e.content.length > 160 && (
                      <button onClick={() => setExpandedId(expanded ? null : e.id)} style={{ background: 'none', border: 'none', color: 'var(--accent, #ff5029)', fontSize: '0.7rem', cursor: 'pointer', padding: '4px 0 0', marginTop: 2 }}>
                        {expanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(e)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontSize: '0.65rem', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', opacity: 0.6 }}>
                      Edit
                    </button>
                    <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: '1px solid rgba(255,80,41,0.25)', color: '#ff5029', fontSize: '0.65rem', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', opacity: 0.7 }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {entries.length > 0 && (
            <div style={{ marginTop: 8, fontSize: '0.65rem', opacity: 0.35 }}>
              <Link href={`/artists/${profileSlug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                View public profile →
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
