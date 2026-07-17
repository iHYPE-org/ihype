'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type RoleOption = { value: string; label: string };

const TYPE_OPTIONS = [
  { value: 'looking-for', label: 'Looking for' },
  { value: 'available', label: 'Available' },
];

export function CollabBoardPostForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(TYPE_OPTIONS[0].value);
  const [role, setRole] = useState(roles[0]?.value ?? '');
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!body.trim()) {
      setError('Description is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/collab-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, role, body, contact: contact || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not post that listing.');
        return;
      }
      setBody('');
      setContact('');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not post that listing.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="ihype-btn-primary" onClick={() => setOpen(true)} style={{ display: 'inline-block' }}>
        + Post a listing
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="ihype-card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select className="ihype-input" value={type} onChange={(e) => setType(e.target.value)} style={{ flex: '1 1 160px' }}>
          {TYPE_OPTIONS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select className="ihype-input" value={role} onChange={(e) => setRole(e.target.value)} style={{ flex: '1 1 160px' }}>
          {roles.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <textarea
        className="ihype-input"
        placeholder="Tell people what you're looking for or what you have to offer…"
        required
        rows={4}
        maxLength={500}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        style={{ resize: 'vertical' }}
      />
      <input
        className="ihype-input"
        placeholder="Contact (email, phone, or handle) — optional"
        maxLength={100}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      {error && <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="ihype-btn-primary" disabled={submitting} style={{ flex: '0 0 auto', padding: '11px 22px' }}>
          {submitting ? 'Posting…' : 'Post listing'}
        </button>
        <button type="button" className="ihype-btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
