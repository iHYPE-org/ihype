'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The artist highlight — the panel the player's artist name opens.
 *
 * `SimplifiedApp.dc.html` opens this over the shell rather than navigating:
 * the point is to decide whether to follow the artist without losing the map,
 * the pane you were on, or your place in the queue. "Open artist page" is the
 * one control here that leaves.
 *
 * It reads `/api/profile/[slug]`, which already returns everything the panel
 * states — name, bio, hype count and upcoming shows — so this needed no new
 * endpoint. Every figure is real or absent: a count that could not be read
 * renders as an em dash rather than 0, the same rule the analytics engine and
 * the admin workbench follow. A dashboard showing 0 for "could not read" is
 * worse than one showing nothing, because 0 is a claim.
 */

type ArtistSummary = {
  name: string;
  meta: string;
  bio: string | null;
  hypeCount: number | null;
  upcomingShows: number | null;
  avatarImage: string | null;
};

function readSummary(payload: unknown): ArtistSummary | null {
  const body = payload as {
    profile?: Record<string, unknown>;
    shows?: unknown[];
  } | null;
  const profile = body?.profile;
  if (!profile || typeof profile !== 'object') return null;
  const name = typeof profile.name === 'string' ? profile.name : '';
  if (!name) return null;
  const genres = Array.isArray(profile.genres) ? profile.genres.filter((g): g is string => typeof g === 'string') : [];
  const city = typeof profile.city === 'string' ? profile.city : '';
  return {
    name,
    meta: [genres[0], city].filter(Boolean).join(' · '),
    bio: typeof profile.headline === 'string' && profile.headline
      ? profile.headline
      : typeof profile.bio === 'string' && profile.bio
        ? profile.bio
        : null,
    hypeCount: typeof profile.hypeCount === 'number' ? profile.hypeCount : null,
    upcomingShows: Array.isArray(body?.shows) ? body.shows.length : null,
    avatarImage: typeof profile.avatarImage === 'string' ? profile.avatarImage : null,
  };
}

export function MmmArtistCard({ onClose, slug }: { onClose: () => void; slug: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data: ArtistSummary | null }>({
    status: 'loading',
    data: null,
  });
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null });
    fetch(`/api/profile/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload) => {
        if (cancelled) return;
        const summary = readSummary(payload);
        setState(summary ? { status: 'ready', data: summary } : { status: 'error', data: null });
      })
      .catch(() => { if (!cancelled) setState({ status: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const artist = state.data;
  const stat = (value: number | null) => (value === null ? '—' : value.toLocaleString());
  /* The endpoint takes 10 shows, so 10 means "10 or more" and printing a bare
     10 would be a claim the response cannot support. */
  const shows = artist?.upcomingShows ?? null;
  const showsLabel = shows === null ? '—' : shows >= 10 ? '10+' : String(shows);

  return (
    <div aria-label="Artist" className="mmm-artist-card" role="dialog">
      <div className="mmm-artist-head">
        <span aria-hidden="true" className="mmm-artist-avatar">
          {artist?.avatarImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote R2 URL,
            // 52px, and the panel is transient; a loader round trip buys nothing.
            <img alt="" src={artist.avatarImage} />
          ) : (
            (artist?.name ?? '·').charAt(0).toUpperCase()
          )}
        </span>
        <span className="mmm-artist-ident">
          <span className="mmm-artist-name">{artist?.name ?? (state.status === 'error' ? 'Artist' : 'Loading…')}</span>
          {artist?.meta ? <span className="mmm-artist-meta">{artist.meta}</span> : null}
        </span>
        <button aria-label="Close" className="mmm-artist-close" onClick={onClose} ref={closeRef} type="button">
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {state.status === 'error' ? (
        <p className="mmm-artist-bio">That artist page could not be read just now. The link below still works.</p>
      ) : artist?.bio ? (
        <p className="mmm-artist-bio">{artist.bio}</p>
      ) : null}

      <div className="mmm-artist-stats">
        <div className="mmm-artist-stat">
          <span className="mmm-artist-stat-value" data-heat="">{stat(artist?.hypeCount ?? null)}</span>
          <span className="mmm-artist-stat-label">Hypes</span>
        </div>
        <div className="mmm-artist-stat">
          <span className="mmm-artist-stat-value">{showsLabel}</span>
          <span className="mmm-artist-stat-label">Upcoming shows</span>
        </div>
      </div>

      <a className="mmm-artist-open" href={`/app/artists/${slug}`}>Open artist page</a>
    </div>
  );
}
