'use client';

import { useEffect, useState } from 'react';

type StreakData = { streak: number; daysActive: number };

type StatsMeData = {
  hype: { given: number; received: number; rating: number };
  plays: { songs: number; shows: number };
  fanStats: {
    ticketsBought: number;
    showsAttended: number;
    songsCompleted: number;
    showsCompleted: number;
  } | null;
};

type HistoryItem = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  artistProfileSlug: string | null;
  mediaUrl: string;
  completedAt: string | null;
  createdAt: string;
};

const LISTENING_HISTORY_LIMIT = 8;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function Tile({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="mystats-tile">
      <div className="mystats-tile-value" style={{ color }}>{value.toLocaleString()}</div>
      <div className="mystats-tile-label">{label}</div>
    </div>
  );
}

/**
 * Fan-facing "My Stats" section for /me/wrapped — the evergreen counterpart
 * to ProfileInsights.tsx (which is owner-only, for ARTIST/DJ/VENUE profiles).
 * Pulls real data from three previously-orphaned routes: /api/hype-streak,
 * /api/stats/me, and /api/me/listening-history. Best-effort — a failed
 * fetch just hides the section rather than blanking the whole wrapped page.
 */
export function MyStatsPanel() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [stats, setStats] = useState<StatsMeData | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/hype-streak').then((r) => (r.ok ? r.json() : { streak: 0, daysActive: 0 })),
      fetch('/api/stats/me').then((r) => (r.ok ? r.json() : Promise.reject(new Error('stats/me failed')))),
      fetch('/api/me/listening-history').then((r) => (r.ok ? r.json() : { history: [] })),
    ])
      .then(([streakRes, statsRes, historyRes]) => {
        if (cancelled) return;
        setStreak(streakRes);
        setStats(statsRes);
        setHistory((historyRes.history ?? []).slice(0, LISTENING_HISTORY_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;
  if (!streak || !stats || !history) {
    return (
      <div className="mystats-section">
        <p className="mystats-empty">Loading your stats…</p>
      </div>
    );
  }

  const fan = stats.fanStats;

  return (
    <div className="mystats-section">
      <div className="mystats-eyebrow">MY STATS</div>

      <div className="mystats-grid">
        <Tile value={streak.streak} label="Day streak" color="#ff3e9a" />
        <Tile value={stats.hype.given} label="Hypes given" color="#ff5029" />
        <Tile value={stats.hype.received} label="Hypes received" color="#b983ff" />
        {fan ? (
          <Tile value={fan.showsAttended} label="Shows attended" color="#22e5d4" />
        ) : (
          <Tile value={streak.daysActive} label="Active days" color="#22e5d4" />
        )}
      </div>

      <div className="mystats-listening">
        <div className="mystats-subhead">Listening history</div>
        {history.length > 0 ? (
          <div className="mystats-track-list">
            {history.map((h) => (
              <div key={h.id} className="mystats-track-row">
                <div className="mystats-track-info">
                  <span className="mystats-track-title">{h.title}</span>
                  <span className="mystats-track-artist">{h.artistName}</span>
                </div>
                <span className="mystats-track-time">{timeAgo(h.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mystats-empty">No listens yet — tracks you play will show up here.</p>
        )}
      </div>
    </div>
  );
}
