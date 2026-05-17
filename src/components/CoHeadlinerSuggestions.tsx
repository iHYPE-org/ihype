'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Match = {
  id: string;
  slug: string;
  name: string;
  genres: string[];
  city: string | null;
  avatarImage: string | null;
  hypeCount: number;
  sharedFans: number;
};

export function CoHeadlinerSuggestions({ profileId }: { profileId: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/shows/match-artists?profileId=${profileId}`)
      .then((r) => r.json())
      .then((data) => {
        setMatches(data.matches ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [profileId]);

  if (!loaded || matches.length === 0) return null;

  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
        Artists your fans also love
      </div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginBottom: 12 }}>
        Potential co-headliner pairings based on shared fans
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map((match) => (
          <div
            key={match.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--wb-bg-2)',
            }}
          >
            {match.avatarImage && (
              <img
                alt={match.name}
                src={match.avatarImage}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
            )}
            <div style={{ flex: 1 }}>
              <Link
                href={`/artists/${match.slug}`}
                style={{ fontWeight: 600, fontSize: 13, color: 'var(--wb-ink)' }}
              >
                {match.name}
              </Link>
              {match.city && (
                <div style={{ fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 2 }}>{match.city}</div>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--wb-ink-3)' }}>
              {match.sharedFans} shared fan{match.sharedFans !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
