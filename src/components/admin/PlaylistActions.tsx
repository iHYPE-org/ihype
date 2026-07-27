'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

interface PlaylistActionsProps {
  id: string;
  published: boolean;
}

export function PlaylistActions({ id, published: initialPublished }: PlaylistActionsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [published, setPublished] = useState(initialPublished);
  const [loading, setLoading] = useState(false);

  async function togglePublished() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !published }),
      });
      if (res.ok) setPublished((p) => !p);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function deletePlaylist() {
    if (!confirm(t('playlistActions.confirmDelete', 'Delete this playlist? This cannot be undone.'))) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/playlists/${id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="button small secondary" onClick={togglePublished} disabled={loading} type="button">
        {published ? t('playlistActions.unpublish', 'Unpublish') : t('playlistActions.publish', 'Publish')}
      </button>
      <button className="button small secondary" onClick={deletePlaylist} disabled={loading} type="button">
        {t('playlistActions.delete', 'Delete')}
      </button>
    </div>
  );
}
