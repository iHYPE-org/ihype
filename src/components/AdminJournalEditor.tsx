'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function AdminJournalEditor() {
  const { t } = useI18n();
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
      setMsg(t('adminJournalEditor.published', 'Published.'));
      setSlug('');
      setTitle('');
      setExcerpt('');
      setBody('');
      setAuthor('');
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? t('adminJournalEditor.failed', 'Failed.'));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <input className="input" placeholder={t('adminJournalEditor.slugPlaceholder', 'slug-here')} value={slug} onChange={(e) => setSlug(e.target.value)} required />
      <input className="input" placeholder={t('adminJournalEditor.titlePlaceholder', 'Title')} value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input className="input" placeholder={t('adminJournalEditor.excerptPlaceholder', 'Excerpt')} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      <input className="input" placeholder={t('adminJournalEditor.authorPlaceholder', 'Author')} value={author} onChange={(e) => setAuthor(e.target.value)} />
      <textarea
        rows={10}
        placeholder={t('adminJournalEditor.bodyPlaceholder', 'Post body…')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="button" type="submit" disabled={busy}>
          {busy ? t('adminJournalEditor.publishing', 'Publishing…') : t('adminJournalEditor.publish', 'Publish')}
        </button>
        {msg ? <span className="meta">{msg}</span> : null}
      </div>
    </form>
  );
}
