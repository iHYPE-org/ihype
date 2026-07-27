'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type VoteTrack = {
  mediaId: string;
  title: string;
  voteCount: number;
  userVoted: boolean;
};

export function ShowSetlistVote({
  showId,
  canVote,
  isLive
}: {
  showId: string;
  canVote: boolean;
  isLive: boolean;
}) {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<VoteTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shows/${showId}/setlist-vote`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { tracks?: VoteTrack[] } | null) => {
        if (!cancelled && json?.tracks) setTracks(json.tracks);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showId]);

  async function toggleVote(mediaId: string) {
    if (!canVote) return;
    // Optimistic update
    setTracks((prev) =>
      prev.map((t) =>
        t.mediaId === mediaId
          ? { ...t, userVoted: !t.userVoted, voteCount: t.userVoted ? t.voteCount - 1 : t.voteCount + 1 }
          : t
      )
    );
    await fetch(`/api/shows/${showId}/setlist-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId })
    }).catch(() => {});
  }

  return (
    <section className="section" id="setlist-vote">
      <div
        className="panel"
        style={{
          padding: '1.25rem',
          ...(isLive ? { border: '1px solid var(--accent)' } : {})
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>{t('showSetlistVote.title', 'Vote on the setlist')}</h2>
          {isLive ? (
            <span className="badge" style={{ color: 'var(--accent)' }}>{t('showSetlistVote.liveBadge', '● LIVE')}</span>
          ) : null}
        </div>
        <p className="meta" style={{ marginTop: 0 }}>
          {isLive
            ? t('showSetlistVote.liveDescription', 'The show is live — vote for the tracks you want to hear next.')
            : t('showSetlistVote.preShowDescription', 'Vote for the tracks you want on the setlist before the show.')}
        </p>
        {loading ? (
          <p className="meta">{t('showSetlistVote.loadingTracks', 'Loading tracks…')}</p>
        ) : tracks.length === 0 ? (
          <p className="meta">{t('showSetlistVote.noTracks', 'No tracks are available to vote on yet.')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.35rem' }}>
            {tracks.map((track) => (
              <li
                key={track.mediaId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  background: 'var(--hair-30)'
                }}
              >
                <strong>{track.title}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {track.voteCount} {track.voteCount === 1 ? t('showSetlistVote.voteSingular', 'vote') : t('showSetlistVote.votePlural', 'votes')}
                  </span>
                  <button
                    className={track.userVoted ? 'button small' : 'button small secondary'}
                    type="button"
                    disabled={!canVote}
                    title={canVote ? undefined : t('showSetlistVote.signInToVoteTitle', 'Sign in to vote')}
                    onClick={() => void toggleVote(track.mediaId)}
                  >
                    {track.userVoted ? t('showSetlistVote.voted', 'Voted ✓') : t('showSetlistVote.vote', 'Vote')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!canVote ? <p className="meta" style={{ marginBottom: 0 }}>{t('showSetlistVote.signInToCastVote', 'Sign in to cast your vote.')}</p> : null}
      </div>
    </section>
  );
}
