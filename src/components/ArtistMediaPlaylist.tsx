'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import type { ArtistMediaEntry } from '@/lib/media';
import { useI18n } from '@/components/I18nProvider';

type ArtistMediaPlaylistProps = {
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  entries: ArtistMediaEntry[];
  isOwner?: boolean;
  profileId?: string;
  playCountMap?: Record<string, number>;
};

type EditState = { title: string; notes: string; saving: boolean };

export function ArtistMediaPlaylist({
  artistName,
  artistSlug,
  artworkUrl,
  entries: initialEntries,
  isOwner = false,
  profileId,
  playCountMap = {}
}: ArtistMediaPlaylistProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { currentTrack, isPlaying, playTrack, togglePlayback } = useMediaPlayer();
  const [message, setMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState(initialEntries);
  const [editing, setEditing] = useState<Record<string, EditState>>({});
  const [freeUse, setFreeUse] = useState<Record<string, boolean>>(
    () => Object.fromEntries(entries.filter((e) => e.source === 'UPLOADED').map((e) => [e.hexId, e.freeUseEnabled ?? false]))
  );

  // Drag-to-reorder state
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const queue = useMemo<MediaTrack[]>(
    () =>
      entries.map((entry) => ({
        id: `${artistSlug}-${entry.hexId}`,
        title: entry.title,
        artistName,
        url: entry.url,
        mediaId: entry.hexId,
        artistProfileSlug: artistSlug,
        notes: entry.notes,
        artworkUrl
      })),
    [artistName, artistSlug, artworkUrl, entries]
  );

  async function copyToClipboard(value: string, label: string, options?: { treatAsLink?: boolean }) {
    try {
      const normalizedValue = options?.treatAsLink
        ? value.startsWith('http://') || value.startsWith('https://')
          ? value
          : new URL(value, window.location.origin).toString()
        : value;
      await navigator.clipboard.writeText(normalizedValue);
      setMessage(`${label} ${t('artistMediaPlaylist.copied', 'copied.')}`);
    } catch {
      setMessage(`${t('artistMediaPlaylist.couldNotCopy', 'Could not copy')} ${label.toLowerCase()}.`);
    }
  }

  async function removeUpload(entry: ArtistMediaEntry) {
    if (!window.confirm(`${t('artistMediaPlaylist.confirmRemove', 'Remove')} ${entry.title} ${t('artistMediaPlaylist.confirmRemoveSuffix', 'from your artist page?')}`)) return;
    try {
      const response = await fetch(`/api/artist-media/${entry.hexId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? t('artistMediaPlaylist.couldNotRemove', 'Could not remove this upload.')); return; }
      setMessage(`${entry.title} ${t('artistMediaPlaylist.removed', 'removed.')}`);
      router.refresh();
    } catch {
      setMessage(t('artistMediaPlaylist.couldNotRemove', 'Could not remove this upload.'));
    }
  }

  function startEdit(entry: ArtistMediaEntry) {
    setEditing((prev) => ({ ...prev, [entry.hexId]: { title: entry.title, notes: entry.notes ?? '', saving: false } }));
  }

  function cancelEdit(hexId: string) {
    setEditing((prev) => { const next = { ...prev }; delete next[hexId]; return next; });
  }

  async function saveEdit(hexId: string) {
    const state = editing[hexId];
    if (!state) return;
    setEditing((prev) => ({ ...prev, [hexId]: { ...state, saving: true } }));
    try {
      const response = await fetch(`/api/artist-media/${hexId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: state.title, notes: state.notes })
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? t('artistMediaPlaylist.couldNotSave', 'Could not save changes.')); setEditing((prev) => ({ ...prev, [hexId]: { ...state, saving: false } })); return; }
      cancelEdit(hexId);
      setMessage(t('artistMediaPlaylist.trackUpdated', 'Track updated.'));
      router.refresh();
    } catch {
      setMessage(t('artistMediaPlaylist.couldNotSave', 'Could not save changes.'));
      setEditing((prev) => ({ ...prev, [hexId]: { ...state, saving: false } }));
    }
  }

  async function toggleFreeUse(hexId: string) {
    const next = !freeUse[hexId];
    setFreeUse((prev) => ({ ...prev, [hexId]: next }));
    try {
      const response = await fetch(`/api/artist-media/${hexId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeUseEnabled: next })
      });
      if (!response.ok) {
        setFreeUse((prev) => ({ ...prev, [hexId]: !next }));
        setMessage(t('artistMediaPlaylist.couldNotUpdateFreeUse', 'Could not update free-use status.'));
      } else {
        setMessage(next ? t('artistMediaPlaylist.freeUseEnabled', 'Free use enabled — promoters can add this to playlists.') : t('artistMediaPlaylist.freeUseDisabled', 'Free use disabled.'));
      }
    } catch {
      setFreeUse((prev) => ({ ...prev, [hexId]: !next }));
      setMessage(t('artistMediaPlaylist.couldNotUpdateFreeUse', 'Could not update free-use status.'));
    }
  }

  // Drag-to-reorder handlers (uploaded tracks only, owner only)
  function onDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function onDragEnd() {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  }

  async function onDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    setDragOverIndex(null);
    dragIndexRef.current = null;
    if (from === null || from === dropIndex) return;

    const next = [...entries];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setEntries(next);

    if (!profileId) return;
    const uploadOrder = next.filter((e) => e.source === 'UPLOADED').map((e) => e.hexId);
    try {
      await fetch('/api/artist-media/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, order: uploadOrder })
      });
    } catch {
      setMessage(t('artistMediaPlaylist.couldNotSaveOrder', 'Could not save track order.'));
    }
  }

  return (
    <div className="artist-media-list">
      {message ? <p className="meta">{message}</p> : null}
      {queue.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const isCurrentAndPlaying = isCurrentTrack && isPlaying;
        const entry = entries[index];
        const editState = editing[entry.hexId];
        const isEditingThis = Boolean(editState);
        const canEdit = isOwner && entry.source === 'UPLOADED';
        const canDrag = canEdit;
        const playCount = playCountMap[entry.hexId];
        const isDragTarget = dragOverIndex === index;

        return (
          <article
            className={[
              'artist-media-card',
              isCurrentTrack ? 'active' : '',
              isDragTarget ? 'drag-over' : ''
            ].filter(Boolean).join(' ')}
            key={track.id}
            draggable={canDrag}
            onDragStart={canDrag ? () => onDragStart(index) : undefined}
            onDragOver={canDrag ? (e) => onDragOver(e, index) : undefined}
            onDrop={canDrag ? (e) => onDrop(e, index) : undefined}
            onDragEnd={canDrag ? onDragEnd : undefined}
            style={isDragTarget ? { outline: '2px dashed var(--accent, #ff5029)', outlineOffset: 2 } : undefined}
          >
            <div className="artist-media-card-copy">
              {canDrag && (
                <span
                  className="artist-media-drag-handle"
                  title={t('artistMediaPlaylist.dragToReorder', 'Drag to reorder')}
                  style={{ cursor: 'grab', opacity: 0.4, paddingRight: 6, userSelect: 'none', fontSize: '1rem' }}
                >
                  ⠿
                </span>
              )}
              <span className="artist-media-index">{String(index + 1).padStart(2, '0')}</span>
              {entry.previewImageUrl ? (
                <img
                  alt=""
                  className="artist-media-track-art"
                  height={60}
                  src={entry.previewImageUrl}
                  width={64}
                />
              ) : null}
              <div style={{ flex: 1 }}>
                <div className="composer-media-code">{entry.hexId}</div>

                {isEditingThis ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <input
                      autoFocus
                      className="field"
                      disabled={editState.saving}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [entry.hexId]: { ...editState, title: e.target.value } }))}
                      placeholder={t('artistMediaPlaylist.trackTitlePlaceholder', 'Track title')}
                      style={{ fontSize: '0.875rem', padding: '4px 8px' }}
                      value={editState.title}
                    />
                    <textarea
                      disabled={editState.saving}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [entry.hexId]: { ...editState, notes: e.target.value } }))}
                      placeholder={t('artistMediaPlaylist.notesPlaceholder', 'Version notes, live room details, release context…')}
                      rows={2}
                      style={{ fontSize: '0.8rem', padding: '4px 8px', resize: 'vertical' }}
                      value={editState.notes}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="button small" disabled={editState.saving || !editState.title.trim()} onClick={() => saveEdit(entry.hexId)} type="button">
                        {editState.saving ? t('artistMediaPlaylist.saving', 'Saving…') : t('artistMediaPlaylist.save', 'Save')}
                      </button>
                      <button className="button small secondary" disabled={editState.saving} onClick={() => cancelEdit(entry.hexId)} type="button">
                        {t('artistMediaPlaylist.cancel', 'Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <strong>{track.title}</strong>
                    <p className="meta">
                      {artistName}
                      {track.notes ? ` | ${track.notes}` : ''}
                      {playCount ? ` · ${playCount} ${playCount === 1 ? t('artistMediaPlaylist.play', 'play') : t('artistMediaPlaylist.plays', 'plays')}` : ''}
                    </p>
                    {canEdit && freeUse[entry.hexId] && (
                      <span className="meta" style={{ fontSize: '0.7rem', opacity: 0.6 }}>{t('artistMediaPlaylist.freeUseOn', 'Free use on')}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="artist-media-actions">
              {!isEditingThis && (
                <button
                  className="button small"
                  onClick={() => { if (isCurrentTrack) { togglePlayback(); return; } playTrack(track, queue); }}
                  type="button"
                >
                  {isCurrentAndPlaying ? t('artistMediaPlaylist.pause', 'Pause') : isCurrentTrack ? t('artistMediaPlaylist.resume', 'Resume') : t('artistMediaPlaylist.playInDock', 'Play in dock')}
                </button>
              )}
              {!isEditingThis && (
                <>
                  <button className="button small secondary" onClick={() => copyToClipboard(entry.hexId, t('artistMediaPlaylist.mediaId', 'Media ID'))} type="button">{t('artistMediaPlaylist.copyId', 'Copy ID')}</button>
                  <button className="button small secondary" onClick={() => copyToClipboard(entry.shareUrl, t('artistMediaPlaylist.shareLink', 'Share link'), { treatAsLink: true })} type="button">{t('artistMediaPlaylist.copyLink', 'Copy link')}</button>
                  <a className="button small secondary" href={track.url} rel="noreferrer" target="_blank">{t('artistMediaPlaylist.openAudio', 'Open audio')}</a>
                  {canEdit && (
                    <button className="button small secondary" onClick={() => startEdit(entry)} type="button">{t('artistMediaPlaylist.edit', 'Edit')}</button>
                  )}
                  {canEdit && (
                    <button
                      className={`button small${freeUse[entry.hexId] ? '' : ' secondary'}`}
                      onClick={() => toggleFreeUse(entry.hexId)}
                      title={freeUse[entry.hexId] ? t('artistMediaPlaylist.disableFreeUse', 'Disable free use') : t('artistMediaPlaylist.allowFreeUse', 'Allow promoters to add this to playlists')}
                      type="button"
                    >
                      {freeUse[entry.hexId] ? t('artistMediaPlaylist.freeUseChecked', 'Free use ✓') : t('artistMediaPlaylist.freeUse', 'Free use')}
                    </button>
                  )}
                  {canEdit && (
                    <button className="button small secondary" onClick={() => removeUpload(entry)} type="button">{t('artistMediaPlaylist.delete', 'Delete')}</button>
                  )}
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
