'use client';

import { useState } from 'react';

interface BulkItem {
  id: string;
  label: string;
}

type BulkAction = 'verify_profiles' | 'feature_shows' | 'unfeature_shows';

interface BulkActionsProps {
  items: BulkItem[];
  type: 'profiles' | 'shows';
}

export function BulkActions({ items, type }: BulkActionsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<BulkAction>(type === 'profiles' ? 'verify_profiles' : 'feature_shows');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(items.map((i) => i.id)));
  const clearAll = () => setSelected(new Set());

  const apply = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      const data = (await res.json()) as { ok?: boolean; updated?: number; error?: string };
      if (data.ok) {
        setResult(`Updated ${data.updated ?? selected.size} records`);
        setSelected(new Set());
      } else {
        setResult(`Error: ${data.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      setResult('Request failed');
    } finally {
      setLoading(false);
    }
  };

  const profileActions: { value: BulkAction; label: string }[] = [
    { value: 'verify_profiles', label: 'Verify profiles' },
  ];
  const showActions: { value: BulkAction; label: string }[] = [
    { value: 'feature_shows', label: 'Feature shows' },
    { value: 'unfeature_shows', label: 'Unfeature shows' },
  ];
  const actionOptions = type === 'profiles' ? profileActions : showActions;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="button small secondary" onClick={selectAll}>Select all</button>
        <button className="button small secondary" onClick={clearAll}>Clear</button>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as BulkAction)}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line2, #333)', background: 'var(--bg2, #111)', color: 'inherit', fontSize: 13 }}
        >
          {actionOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          className="button small"
          onClick={apply}
          disabled={loading || selected.size === 0}
        >
          {loading ? 'Applying…' : `Apply to ${selected.size}`}
        </button>
        {result && <span style={{ fontSize: 13, color: result.startsWith('Error') ? '#e74c3c' : '#2ecc71' }}>{result}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
        {items.map((item) => (
          <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}
