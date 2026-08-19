'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function PlaylistCreateForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      if (res.ok) {
        setTitle('');
        setDescription('');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t('playlistCreateForm.createError', 'Could not create playlist.'));
      }
    } catch {
      setError(t('playlistCreateForm.createError', 'Could not create playlist.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span className="meta">{t('playlistCreateForm.titleLabel', 'Title')}</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('playlistCreateForm.titlePlaceholder', 'New playlist title')} />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span className="meta">{t('playlistCreateForm.descriptionLabel', 'Description (optional)')}</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('playlistCreateForm.descriptionPlaceholder', 'Short description')} />
      </label>
      <button className="button small" type="submit" disabled={loading || !title.trim()}>
        {loading ? t('playlistCreateForm.creating', 'Creating…') : t('playlistCreateForm.createPlaylist', 'Create playlist')}
      </button>
      {error && <span className="meta" style={{ color: 'var(--accent-text)' }}>{error}</span>}
    </form>
  );
}
