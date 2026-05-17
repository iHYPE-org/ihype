'use client';

import { useState } from 'react';

type Item = { id: string; title: string };

export function ArtistMediaReorder({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function onDragStart(i: number) {
    setDragIndex(i);
  }
  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(i, 0, moved);
    setItems(next);
    setDragIndex(i);
  }
  function onDragEnd() {
    setDragIndex(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/media/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaIds: items.map((i) => i.id) })
    });
    setMsg(res.ok ? 'Order saved.' : 'Failed to save.');
    setSaving(false);
  }

  if (items.length === 0) return null;

  return (
    <div className="panel" style={{ padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Reorder media</h3>
      <p className="meta">Drag to reorder, then save.</p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {items.map((item, i) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={onDragEnd}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--bg-3)',
              border: '1px solid var(--line)',
              cursor: 'grab',
              opacity: dragIndex === i ? 0.5 : 1
            }}
          >
            <span style={{ opacity: 0.5, marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
            {item.title}
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="button small" onClick={save} disabled={saving} type="button">
          {saving ? 'Saving…' : 'Save order'}
        </button>
        {msg ? <span className="meta">{msg}</span> : null}
      </div>
    </div>
  );
}
