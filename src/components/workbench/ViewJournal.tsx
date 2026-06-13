'use client';
import React, { useState, useEffect, useRef } from 'react';
import { WorkbenchData } from '@/types/workbench';

type JournalEntry = { id: string; title: string; content: string; createdAt: string };

function SwipeRow({ entry, onDelete, timeAgo }: { entry: JournalEntry; onDelete: () => void; timeAgo: (iso: string) => string }) {
  const [swipeX, setSwipeX] = useState(0);
  const dragRef = useRef<{ startX: number; dragging: boolean }>({ startX: 0, dragging: false });
  const REVEAL = 76;
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      <div onClick={onDelete} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL, background: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '0 12px 12px 0' }}>
        <span style={{ color: '#fff', fontFamily: 'var(--f-m,monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em' }}>DELETE</span>
      </div>
      <article style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.07))', borderRadius: 12, padding: '18px 20px', transform: `translateX(${-swipeX}px)`, transition: dragRef.current.dragging ? 'none' : 'transform .2s', touchAction: 'pan-y', userSelect: 'none' }}
        onPointerDown={e => { dragRef.current = { startX: e.clientX, dragging: false }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const dx = dragRef.current.startX - e.clientX; if (dx > 8) { dragRef.current.dragging = true; setSwipeX(Math.min(REVEAL, Math.max(0, dx))); } }}
        onPointerUp={() => { dragRef.current.dragging = false; setSwipeX(prev => prev > REVEAL / 2 ? REVEAL : 0); }}
        onPointerLeave={() => { if (dragRef.current.dragging) { dragRef.current.dragging = false; setSwipeX(0); } }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink,#f4efe9)', lineHeight: 1.2 }}>{entry.title}</div>
          <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: 'rgba(244,239,233,.3)', flexShrink: 0 }}>{timeAgo(entry.createdAt)}</span>
        </div>
        <div style={{ fontFamily: 'var(--f-b,sans-serif)', fontSize: 14, color: 'rgba(244,239,233,.75)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{entry.content}</div>
      </article>
    </div>
  );
}

export default function ViewJournal({ data, onToast }: { data: WorkbenchData; onToast?: (msg: string, color?: string) => void }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileId = data.profileId;

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const update = () => setKeyboardHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  useEffect(() => {
    if (!profileId) { setLoading(false); return; }
    fetch(`/api/journal?profileId=${profileId}`)
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(d => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  }, [profileId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !profileId) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, title: title.trim(), content: content.trim() }),
      });
      if (res.ok) {
        const { post } = await res.json();
        setEntries(es => [{ id: post.id, title: post.title, content: post.content, createdAt: post.createdAt }, ...es]);
        setTitle(''); setContent(''); setShowForm(false);
      } else {
        const d = await res.json();
        setErr(d.error ?? 'Failed to post');
      }
    } finally { setSaving(false); }
  }

  function deleteEntry(id: string) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    setEntries(es => es.filter(e => e.id !== id));
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDelete(entry);
    deleteTimerRef.current = setTimeout(() => {
      fetch(`/api/journal?id=${id}`, { method: 'DELETE' }).catch(() => {});
      setPendingDelete(null);
      deleteTimerRef.current = null;
    }, 2000);
  }

  function undoDelete() {
    if (!pendingDelete) return;
    if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null; }
    setEntries(es => [pendingDelete, ...es]);
    setPendingDelete(null);
  }

  const timeAgo = (iso: string) => {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return `${Math.floor(d / 86400000)}d ago`;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: showForm ? keyboardHeight : 0 }}>
      <div style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--f-d,sans-serif)', fontSize: 22, fontWeight: 800, color: 'var(--ink,#f4efe9)', margin: 0 }}>Journal</h2>
            <div style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.4)', marginTop: 4 }}>Updates and stories for your followers</div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, background: 'rgba(255,80,41,.12)', border: '1px solid rgba(255,80,41,.3)', color: '#ff5029' }}>
            {showForm ? 'Cancel' : '+ New post'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} style={{ background: 'var(--bg-2,#121009)', border: '1px solid var(--line-2,rgba(255,255,255,.08))', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" maxLength={140} required style={{ padding: '10px 12px', background: 'var(--bg-3,#1a1612)', border: '1px solid var(--line-2,rgba(255,255,255,.08))', borderRadius: 8, color: 'var(--ink,#f4efe9)', fontFamily: 'var(--f-d,sans-serif)', fontSize: 16, fontWeight: 700 }} />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your update…" maxLength={5000} rows={5} required style={{ padding: '10px 12px', background: 'var(--bg-3,#1a1612)', border: '1px solid var(--line-2,rgba(255,255,255,.08))', borderRadius: 8, color: 'var(--ink,#f4efe9)', fontFamily: 'var(--f-b,sans-serif)', fontSize: 14, resize: 'vertical', lineHeight: 1.55 }} />
            <div style={{ textAlign: 'right', fontFamily: 'var(--f-m,monospace)', fontSize: 10, color: content.length > 4500 ? 'rgba(255,80,41,.8)' : 'rgba(244,239,233,.25)', marginTop: -4 }}>{content.length.toLocaleString()} / 5,000</div>
            {err && <div style={{ color: '#ff5029', fontFamily: 'var(--f-m,monospace)', fontSize: 12 }}>{err}</div>}
            <button type="submit" disabled={saving || !title.trim() || !content.trim()} style={{ padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, background: 'rgba(255,80,41,.15)', border: '1px solid rgba(255,80,41,.4)', color: '#ff5029', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Publishing…' : 'Publish post'}
            </button>
          </form>
        )}

        {pendingDelete && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'rgba(255,80,41,.08)', border: '1px solid rgba(255,80,41,.18)' }}>
            <span style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, color: 'rgba(244,239,233,.6)' }}>Post deleted</span>
            <button onClick={undoDelete} style={{ fontFamily: 'var(--f-m,monospace)', fontSize: 12, fontWeight: 700, color: '#ff5029', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>Undo</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(244,239,233,.3)', fontFamily: 'var(--f-m,monospace)', fontSize: 13 }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(244,239,233,.3)', fontFamily: 'var(--f-m,monospace)', fontSize: 13 }}>No posts yet — share an update with your followers</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {entries.map(e => (
              <SwipeRow key={e.id} entry={e} onDelete={() => deleteEntry(e.id)} timeAgo={timeAgo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
