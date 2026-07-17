'use client';

import { useState } from 'react';

interface AbTest {
  key: string;
  description: string | null;
  enabled: boolean;
  createdAt: Date;
}

interface Props {
  initialTests: AbTest[];
}

// Thin client over GET/POST /api/admin/ab-tests. That route only supports
// list + upsert-by-key (no PATCH/DELETE) — so both "create a test" and
// "toggle an existing one" go through the same POST, resending the row's
// current key/description with the flipped `enabled` value.
export function AdminAbTestsClient({ initialTests }: Props) {
  const [tests, setTests] = useState(initialTests);
  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEnabled, setNewEnabled] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function upsert(key: string, description: string, enabled: boolean) {
    setSaving(key);
    setError('');
    try {
      const res = await fetch('/api/admin/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, description, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed.');
        return;
      }
      const saved: AbTest = data.test;
      setTests((prev) => {
        const idx = prev.findIndex((t) => t.key === saved.key);
        if (idx === -1) return [saved, ...prev];
        const next = prev.slice();
        next[idx] = saved;
        return next;
      });
    } catch {
      setError('Save failed.');
    } finally {
      setSaving(null);
    }
  }

  async function createTest() {
    const key = newKey.trim();
    if (!key) return;
    await upsert(key, newDescription.trim(), newEnabled);
    setNewKey('');
    setNewDescription('');
    setNewEnabled(false);
  }

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); createTest(); }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', margin: '12px 0 20px' }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="meta">Key</span>
          <input className="input" onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. new-onboarding-flow" value={newKey} />
        </label>
        <label style={{ display: 'grid', gap: 4, flex: 1, minWidth: 200 }}>
          <span className="meta">Description</span>
          <input className="input" onChange={(e) => setNewDescription(e.target.value)} placeholder="What this test controls" style={{ width: '100%' }} value={newDescription} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
          <input checked={newEnabled} onChange={(e) => setNewEnabled(e.target.checked)} type="checkbox" />
          <span className="meta">Enabled</span>
        </label>
        <button className="button small" disabled={!newKey.trim() || saving === newKey.trim()} type="submit">Create test</button>
      </form>

      {error && <p className="meta" style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</p>}

      {tests.length === 0 ? (
        <div className="empty">No A/B tests defined yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Key</th><th>Description</th><th>Status</th><th>Created</th><th></th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.key}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.key}</td>
                <td>{t.description ?? '—'}</td>
                <td><span className={`badge ${t.enabled ? 'success' : ''}`}>{t.enabled ? 'Enabled' : 'Disabled'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toISOString().slice(0, 10)}</td>
                <td>
                  <button
                    className="button small secondary"
                    disabled={saving === t.key}
                    onClick={() => upsert(t.key, t.description ?? '', !t.enabled)}
                    type="button"
                  >
                    {t.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
