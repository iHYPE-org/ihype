import Link from 'next/link';
import type { SimilarArtist } from '@/lib/sounds-like';

export function SimilarArtistsRow({
  artists,
  accent,
  heading = 'Similar Artists',
}: {
  artists: SimilarArtist[];
  accent: string;
  heading?: string;
}) {
  if (!artists.length) return null;

  return (
    <div className="similar-artists">
      <div className="similar-artists-label">{heading}</div>
      <div className="similar-artists-row">
        {artists.map((a) => (
          <Link
            className="similar-artist-card"
            href={a.type === 'DJ' ? `/promoters/${a.slug}` : `/artists/${a.slug}`}
            key={a.slug}
          >
            <div className="similar-artist-avatar">
              {a.avatarImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={a.name} src={a.avatarImage} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <span>{a.name.charAt(0)}</span>
              )}
            </div>
            <div className="similar-artist-name">{a.name}</div>
            <div className="similar-artist-genre">{a.genres.slice(0, 2).join(' · ')}</div>
          </Link>
        ))}
      </div>
      <style>{`
        .similar-artists { margin-top: 24px; }
        .similar-artists-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 12px; }
        .similar-artists-row { display: flex; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
        .similar-artists-row::-webkit-scrollbar { display: none; }
        .similar-artist-card { flex: 0 0 108px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 14px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg2); text-decoration: none; color: inherit; }
        .similar-artist-card:hover { background: var(--bg3); }
        .similar-artist-avatar { width: 56px; height: 56px; border-radius: 50%; background: ${accent}; display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 20px; overflow: hidden; margin-bottom: 10px; }
        .similar-artist-name { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
        .similar-artist-genre { font-size: 11px; color: var(--ink-a55); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
      `}</style>
    </div>
  );
}
