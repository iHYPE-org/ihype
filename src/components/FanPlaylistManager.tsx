'use client';

import { useEffect, useMemo, useState } from 'react';

type MediaTrack = {
  id: string;
  title: string;
  artistName: string;
  url: string;
  mediaId?: string | null;
  artistProfileSlug?: string | null;
  notes?: string | null;
  artworkUrl?: string | null;
};

type PlaylistItem = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  url: string;
  artistProfileSlug: string | null;
  notes: string | null;
  artworkUrl: string | null;
  position: number;
};

type Playlist = {
  id: string;
  name: string;
  items: PlaylistItem[];
};

type FavoriteMedia = {
  mediaId: string;
};

export function FanPlaylistManager({
  currentTrack,
  playTrack
}: {
  currentTrack: MediaTrack | null;
  playTrack: (track: MediaTrack, queue?: MediaTrack[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMedia[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  async function loadPlaylists() {
    setLoading(true);

    try {
      const response = await fetch('/api/fan-playlists', { cache: 'no-store' });

      if (response.status === 401 || response.status === 403) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setAuthorized(true);
      setPlaylists(data.playlists ?? []);
      setFavorites(data.favorites ?? []);
      setActivePlaylistId((current) => current ?? data.playlists?.[0]?.id ?? null);
    } catch {
      setMessage('Could not load playlists right now.');
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadPlaylists();
  }, [open]);

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null;
  const playlistQueue = useMemo<MediaTrack[]>(
    () =>
      (activePlaylist?.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        artistName: item.artistName,
        url: item.url,
        mediaId: item.mediaId,
        artistProfileSlug: item.artistProfileSlug,
        notes: item.notes,
        artworkUrl: item.artworkUrl
      })),
    [activePlaylist]
  );
  const currentTrackPayload = currentTrack
    ? {
        mediaId: currentTrack.mediaId ?? currentTrack.id,
        title: currentTrack.title,
        artistName: currentTrack.artistName,
        url: currentTrack.url,
        artistProfileSlug: currentTrack.artistProfileSlug ?? null,
        notes: currentTrack.notes ?? null,
        artworkUrl: currentTrack.artworkUrl ?? null
      }
    : null;
  const isCurrentTrackLoved = currentTrackPayload
    ? favorites.some((favorite) => favorite.mediaId === currentTrackPayload.mediaId)
    : false;

  async function handleCreatePlaylist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPlaylistName.trim()) {
      return;
    }

    const response = await fetch('/api/fan-playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPlaylistName.trim() })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not create playlist.');
      return;
    }

    setPlaylists((current) => [...current, data]);
    setActivePlaylistId(data.id);
    setNewPlaylistName('');
    setMessage(`Created ${data.name}.`);
  }

  async function handleAddCurrentTrack() {
    if (!currentTrackPayload || !activePlaylistId) {
      return;
    }

    const response = await fetch(`/api/fan-playlists/${activePlaylistId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentTrackPayload)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not add this track.');
      return;
    }

    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === activePlaylistId ? { ...playlist, items: [...playlist.items, data] } : playlist
      )
    );
    setMessage(`${currentTrackPayload.title} added to ${activePlaylist?.name ?? 'playlist'}.`);
  }

  async function handleToggleFavorite() {
    if (!currentTrackPayload) {
      return;
    }

    const response = await fetch('/api/fan-favorites', {
      method: isCurrentTrackLoved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentTrackPayload)
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not update loved media.');
      return;
    }

    setFavorites((current) =>
      isCurrentTrackLoved
        ? current.filter((favorite) => favorite.mediaId !== currentTrackPayload.mediaId)
        : [{ mediaId: currentTrackPayload.mediaId }, ...current]
    );
    setMessage(isCurrentTrackLoved ? 'Removed from loved tracks.' : 'Tagged as loved.');
  }

  async function handleRemoveItem(itemId: string) {
    if (!activePlaylistId) {
      return;
    }

    const response = await fetch(`/api/fan-playlists/${activePlaylistId}/items/${itemId}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(data?.error ?? 'Could not remove this item.');
      return;
    }

    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === activePlaylistId
          ? {
              ...playlist,
              items: playlist.items
                .filter((item) => item.id !== itemId)
                .map((item, index) => ({ ...item, position: index }))
            }
          : playlist
      )
    );
  }

  async function persistReorder(nextItems: PlaylistItem[]) {
    if (!activePlaylistId) {
      return;
    }

    const response = await fetch(`/api/fan-playlists/${activePlaylistId}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: nextItems.map((item) => item.id) })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not reorder playlist.');
      void loadPlaylists();
      return;
    }

    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === activePlaylistId ? { ...playlist, items: data.items ?? nextItems } : playlist
      )
    );
  }

  function handleDrop(targetItemId: string) {
    if (!activePlaylist || !draggedItemId || draggedItemId === targetItemId) {
      return;
    }

    const items = [...activePlaylist.items];
    const draggedIndex = items.findIndex((item) => item.id === draggedItemId);
    const targetIndex = items.findIndex((item) => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);
    const normalizedItems = items.map((item, index) => ({ ...item, position: index }));

    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === activePlaylist.id ? { ...playlist, items: normalizedItems } : playlist
      )
    );
    setDraggedItemId(null);
    void persistReorder(normalizedItems);
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="fan-playlist-manager">
      <div className="fan-playlist-head">
        <button
          className={open ? 'button small secondary fan-playlist-toggle active' : 'button small secondary fan-playlist-toggle'}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? 'Hide playlists' : 'My playlists'}
        </button>
        {message ? <span className="meta">{message}</span> : null}
      </div>

      {open ? (
        <div className="fan-playlist-panel">
          <form className="fan-playlist-create" onSubmit={handleCreatePlaylist}>
            <input
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="Create a playlist"
              type="text"
              value={newPlaylistName}
            />
            <button className="button small secondary" type="submit">
              Add
            </button>
          </form>

          <div className="fan-playlist-current">
            <div>
              <strong>{currentTrack?.title ?? 'No current track'}</strong>
              <p className="meta">
                {currentTrack ? `${currentTrack.artistName}${currentTrack.notes ? ` | ${currentTrack.notes}` : ''}` : 'Play a track to tag it or file it into a playlist.'}
              </p>
            </div>
            <div className="cta-row">
              <button
                className="button small secondary"
                disabled={!currentTrackPayload}
                onClick={handleToggleFavorite}
                type="button"
              >
                {isCurrentTrackLoved ? 'Loved' : 'Love'}
              </button>
              <button
                className="button small secondary"
                disabled={!currentTrackPayload || !activePlaylistId}
                onClick={handleAddCurrentTrack}
                type="button"
              >
                Add to playlist
              </button>
            </div>
          </div>

          <div className="fan-playlist-layout">
            <aside className="fan-playlist-sidebar">
              {loading && !playlists.length ? <div className="empty">Loading playlists...</div> : null}
              {playlists.map((playlist) => (
                <button
                  className={playlist.id === activePlaylistId ? 'fan-playlist-tab active' : 'fan-playlist-tab'}
                  key={playlist.id}
                  onClick={() => setActivePlaylistId(playlist.id)}
                  type="button"
                >
                  <strong>{playlist.name}</strong>
                  <span>{playlist.items.length} tracks</span>
                </button>
              ))}
              {!playlists.length && !loading ? <div className="empty">Create your first playlist to start collecting tracks.</div> : null}
            </aside>

            <div className="fan-playlist-viewer">
              {activePlaylist ? (
                <>
                  <div className="fan-playlist-viewer-head">
                    <strong>{activePlaylist.name}</strong>
                    <span className="meta">Drag and drop to reorder.</span>
                  </div>

                  <div className="fan-playlist-items">
                    {activePlaylist.items.length ? (
                      activePlaylist.items.map((item, index) => (
                        <article
                          className="fan-playlist-item"
                          draggable
                          key={item.id}
                          onDragOver={(event) => event.preventDefault()}
                          onDragStart={() => setDraggedItemId(item.id)}
                          onDrop={() => handleDrop(item.id)}
                        >
                          <button
                            className="fan-playlist-item-main"
                            onClick={() => playTrack(playlistQueue[index], playlistQueue)}
                            type="button"
                          >
                            <span className="fan-playlist-item-order">{String(index + 1).padStart(2, '0')}</span>
                            <div>
                              <strong>{item.title}</strong>
                              <span>{item.artistName}</span>
                            </div>
                          </button>
                          <button
                            className="button small secondary"
                            onClick={() => handleRemoveItem(item.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </article>
                      ))
                    ) : (
                      <div className="empty">This playlist is empty. Add the current track or start playing songs from artist pages.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty">Choose a playlist to review its tracks.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
