'use client';

import { useCallback } from 'react';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { useRegisterPlayIntent } from '@/components/mmm/MmmPlayIntent';

/**
 * Makes the dock's joystick play THIS track.
 *
 * Renders nothing. It exists because the track page is a server component and
 * the registry is a client context, so something has to cross that line — and a
 * null-rendering registrar is a smaller thing to cross it with than making the
 * whole page a client component for one hook.
 *
 * Worth stating what this closed: `/app/tracks/[hexId]` had **no play control
 * at all**, and its query did not even select `storageUrl`. You could open a
 * track's own page, in a music app, and have no way to hear it — the joystick
 * fell through to the radio, which is the right last resort everywhere except
 * on the page for one specific track.
 *
 * `url` is nullable because `storageUrl` is: a track can be published with its
 * audio still missing. With no url this registers nothing and the transport
 * falls back to the radio, which is honest — there is nothing here to play.
 */
export function MmmTrackPlayIntent({
  artistName,
  artistSlug,
  artworkUrl,
  hexId,
  title,
  url,
}: {
  artistName: string;
  artistSlug: string | null;
  artworkUrl: string | null;
  hexId: string;
  title: string;
  url: string | null;
}) {
  const { playTrack } = useMediaPlayer();
  /* The callback is built unconditionally — a hook cannot be — and it is the
     REGISTRATION that is withheld when there is no audio, so the dock falls
     through to the radio rather than registering something inert. */
  const play = useCallback(() => {
    if (!url) return;
    playTrack({ id: hexId, mediaId: hexId, title, artistName, url, artistProfileSlug: artistSlug, artworkUrl });
  }, [artistName, artistSlug, artworkUrl, hexId, playTrack, title, url]);
  useRegisterPlayIntent(url ? play : null);
  return null;
}
