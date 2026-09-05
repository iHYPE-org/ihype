'use client';

import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { toQueue, type PlayableRow } from '@/lib/mmm-play';
import { useI18n } from '@/components/I18nProvider';

/**
 * The play key on a release row.
 *
 * `MmmPlayHere` hands an artist's releases to the dock's transport, but since
 * the cold-start Radio key left the tab bar (2026-09-04) the chrome carries no
 * transport until something is loaded — so on an artist page there was no way
 * to start a track at all: the rows linked to the track page and nothing here
 * played (owner, 2026-09-05: "No music player"). This is that way. One press
 * plays this track inside the artist's whole release queue, so the mini player
 * appears with next/previous meaning something; pressing the playing track
 * pauses it. Unplayable rows (no stored audio) get no key rather than a dead one.
 */
export function ReleasePlayButton({ track, rows, label }: { track: PlayableRow; rows: readonly PlayableRow[]; label: string }) {
  const { playTrack, togglePlayback, currentTrack, isPlaying } = useMediaPlayer();
  const { t } = useI18n();
  const queue = toQueue(rows);
  const id = track.hexId || track.id;
  const index = queue.findIndex((entry) => entry.id === id);
  if (index === -1) return null;
  const isCurrent = currentTrack?.id === id;
  const playing = isCurrent && isPlaying;
  return (
    <button
      aria-label={(playing ? t('releasePlay.pause', 'Pause {title}') : t('releasePlay.play', 'Play {title}')).replace('{title}', label)}
      aria-pressed={playing}
      className="profile-release-play"
      data-playing={playing ? '' : undefined}
      onClick={() => {
        if (isCurrent) togglePlayback();
        else playTrack(queue[index], queue);
      }}
      type="button"
    >
      <span aria-hidden="true">{playing ? '❚❚' : '▶︎'}</span>
    </button>
  );
}
