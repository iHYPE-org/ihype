'use client';

import { useState } from 'react';
import { useAsyncForm } from '@/hooks/useAsyncForm';

const ROLES = ['ALL', 'FAN', 'ARTIST', 'DJ', 'VENUE'] as const;

export function AdminBroadcastForm() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<(typeof ROLES)[number]>('ALL');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const { message: status, setMessage: setStatus, error, setError, pending: busy, setPending: setBusy, reset } = useAsyncForm();

  async function fetchPreview() {
    reset();
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject || 'preview', body: body || 'preview', targetRole, preview: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Preview failed.');
      setPreviewCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.');
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    reset();
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, targetRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Send failed.');
      setStatus(`Sent ${data.sent}/${data.total} (${data.failed} failed).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} style={{ display: 'grid', gap: 12 }}>
      <label className="field">
        <span>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </label>
      <label className="field">
        <span>Body</span>
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />
      </label>
      <label className="field">
        <span>Target role</span>
        <select value={targetRole} onChange={(e) => setTargetRole(e.target.value as (typeof ROLES)[number])}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="button secondary" onClick={fetchPreview}>Preview recipient count</button>
        {previewCount != null ? <small>{previewCount} recipient{previewCount === 1 ? '' : 's'}</small> : null}
      </div>
      <button className="button" type="submit" disabled={busy}>
        {busy ? 'Sending...' : 'Send broadcast'}
      </button>
      {status ? <p className="status-note">{status}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </form>
  );
}
