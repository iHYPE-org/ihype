'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';
import { useI18n } from '@/components/I18nProvider';

type StationTrack = {
  hexId: string;
  title: string;
  url: string;
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  durationSecs: number;
};

type StationState = {
  live: boolean;
  liveShow: { slug: string; title: string } | null;
  nowPlaying: StationTrack | null;
  positionSecs: number;
  upNext: StationTrack[];
  rotationLength: number;
};

// The always-on auto-DJ player. Loads the shared station state, starts the
// current track at the server-synced offset, and advances to whatever the
// station says is playing next — so it's never silent. Audio only.
export function AlwaysOnStation({ initial }: { initial: StationState }) {
  const { t } = useI18n();
  const [state, setState] = useState<StationState>(initial);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentHex = useRef<string | null>(null);

  // Refetch the station when the current track is expected to end, so we stay
  // in sync with the shared rotation rather than drifting.
  useEffect(() => {
    const np = state.nowPlaying;
    if (!np) return;
    const remainingMs = Math.max(2, np.durationSecs - state.positionSecs) * 1000;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/radio/station', { cache: 'no-store' });
        if (res.ok) setState(await res.json());
      } catch {
        /* keep last state on network hiccup */
      }
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [state]);

  // When the now-playing track changes, load it and seek to the shared offset.
  useEffect(() => {
    const audio = audioRef.current;
    const np = state.nowPlaying;
    if (!audio || !np) return;
    if (currentHex.current === np.hexId) return;
    currentHex.current = np.hexId;
    audio.src = np.url;
    audio.currentTime = Math.min(state.positionSecs, Math.max(0, np.durationSecs - 1));
    if (playing) audio.play().catch(() => setPlaying(false));
  }, [state, playing]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => {
        setPlaying(true);
        track('station_play', { hex: state.nowPlaying?.hexId ?? null });
      }).catch(() => {});
    }
  }

  const np = state.nowPlaying;

  return (
    <div className="station">
      <style>{STATION_CSS}</style>
      <audio ref={audioRef} preload="none" onEnded={() => { /* timer drives advance */ }} />

      <div className="station-head">
        <span className="station-dot" aria-hidden="true" />
        <span className="station-status">
          {state.live ? t('alwaysOnStation.djLive', 'DJ LIVE') : np ? t('alwaysOnStation.autoDj', 'AUTO-DJ · ALWAYS ON') : t('alwaysOnStation.offAir', 'OFF AIR')}
        </span>
      </div>

      {state.live && state.liveShow ? (
        <div className="station-live">
          <p className="station-live-title">{state.liveShow.title}</p>
          <Link href={`/shows/${state.liveShow.slug}`} className="station-cta">{t('alwaysOnStation.joinLiveShow', 'Join the live show')}</Link>
        </div>
      ) : np ? (
        <>
          <div className="station-now">
            <div className="station-art" style={np.artworkUrl ? { backgroundImage: `url(${np.artworkUrl})` } : undefined} aria-hidden="true" />
            <div className="station-now-text">
              <div className="station-track">{np.title}</div>
              <Link href={`/artists/${np.artistSlug}`} className="station-artist">{np.artistName}</Link>
            </div>
            <button type="button" className="station-toggle" onClick={toggle} aria-label={playing ? t('alwaysOnStation.pause', 'Pause') : t('alwaysOnStation.play', 'Play')}>
              {playing ? '❚❚' : '▶'}
            </button>
          </div>

          {state.upNext.length > 0 && (
            <div className="station-next">
              <span className="station-next-label">{t('alwaysOnStation.upNext', 'UP NEXT')}</span>
              {state.upNext.map((nextTrack, i) => (
                <span key={`${nextTrack.hexId}-${i}`} className="station-next-item">{nextTrack.title} · {nextTrack.artistName}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="station-empty">{t('alwaysOnStation.stationQuiet', 'The station is quiet — no free-use tracks in the crate yet.')}</p>
      )}
    </div>
  );
}

const STATION_CSS = `
.station { background: var(--bg-2); border: 1px solid var(--hair-80); border-radius: 20px; padding: 22px; max-width: 460px; }
.station-head { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; }
.station-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
.station-status { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: var(--accent); }
.station-now { display: flex; align-items: center; gap: 14px; }
.station-art { flex-shrink: 0; width: 64px; height: 64px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), var(--role-fan)); background-size: cover; background-position: center; }
.station-now-text { flex: 1; min-width: 0; }
.station-track { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -0.02em; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.station-artist { font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--ink-a60); text-decoration: none; }
.station-artist:hover { color: var(--accent); }
.station-toggle { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer; background: var(--accent-grad-warm); color: var(--ink-on-accent); font-size: 16px; display: flex; align-items: center; justify-content: center; }
.station-next { display: flex; flex-direction: column; gap: 4px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
.station-next-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.14em; color: var(--ink-a40); margin-bottom: 2px; }
.station-next-item { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--ink-a55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.station-live-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px; color: var(--ink); margin: 0 0 12px; }
.station-cta { display: inline-block; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 14px; padding: 10px 18px; border-radius: 9999px; background: var(--accent-grad-warm); color: var(--ink-on-accent); text-decoration: none; }
.station-empty { font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--ink-a50); margin: 0; }
`;
