import Link from 'next/link';
import { auth } from '@/lib/auth';
import { detectRequestLocation } from '@/lib/request-location';
import { getRecommendations } from '@/lib/recommendations';
import { enhanceRecommendationsWithAI } from '@/lib/ai-recommendations';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For You · iHYPE',
  description: 'Artists picked for you — and exactly why, based on who you hype.',
};

const REASON_COLOR: Record<string, string> = {
  taste: '#ff5029',
  collab: '#b983ff',
  comparable: '#b983ff',
  geo: '#22e5d4',
  momentum: '#ff3e9a',
  social: 'var(--ink-a55)',
};

export default async function ForYouPage() {
  const [session, location] = await Promise.all([auth(), detectRequestLocation()]);
  const result = await getRecommendations(session?.user?.id ?? null, location, { type: null, limit: 30 });
  const { meta } = result;
  const { profiles } = await enhanceRecommendationsWithAI(result.profiles, {
    genres: meta.viewerGenres,
    city: meta.viewerCity,
    stateRegion: meta.viewerState,
    hasHypeHistory: meta.viewerHasHypeHistory,
  });

  return (
    <div className="foryou-page">
      <style>{FORYOU_CSS}</style>

      <header className="foryou-head">
        <span className="foryou-eyebrow">FOR YOU</span>
        <h1 className="foryou-title">Picked for your taste</h1>
        <p className="foryou-sub">
          {meta.viewerHasHypeHistory
            ? 'Ranked from who you hype, who fans like you hype, your scene, and what’s rising.'
            : 'Hype a few artists and these get personal — each pick will show exactly why.'}
        </p>
      </header>

      {profiles.length === 0 ? (
        <div className="foryou-empty">
          <p>Nothing to recommend yet.</p>
          <Link href="/discover" className="foryou-cta">Browse artists</Link>
        </div>
      ) : (
        <ul className="foryou-list">
          {profiles.map((p) => (
            <li key={p.id} className="foryou-card">
              <Link href={`/artists/${p.slug}`} className="foryou-card-link">
                <span className="foryou-avatar" style={p.avatarImage ? { backgroundImage: `url(${p.avatarImage})` } : undefined}>
                  {!p.avatarImage && p.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="foryou-body">
                  <div className="foryou-name">{p.name}{p.verified && <span className="foryou-verified">✓</span>}</div>
                  <div className="foryou-meta">
                    {(p.genres.slice(0, 2).join(' · ') || 'Artist')}{p.city ? ` · ${p.city}` : ''}
                  </div>
                  <div className="foryou-reason" style={{ color: REASON_COLOR[p.reason.kind] ?? REASON_COLOR.social }}>
                    {p.reason.text}
                  </div>
                </div>
                {p.hypeCount > 0 && <span className="foryou-hype">{p.hypeCount} HYPE</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!session?.user?.id && profiles.length > 0 && (
        <p className="foryou-foot"><Link href="/register">Sign up</Link> to make these personal.</p>
      )}
    </div>
  );
}

const FORYOU_CSS = `
.foryou-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
.foryou-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: #ff5029; }
.foryou-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 34px; line-height: 1.0; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 10px; }
.foryou-sub { font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.6; color: var(--ink-a60); max-width: 54ch; margin: 0 0 24px; }
.foryou-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.foryou-card { background: #100d09; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; }
.foryou-card-link { display: flex; align-items: center; gap: 14px; padding: 14px 16px; text-decoration: none; }
.foryou-avatar { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #ff5029, #b983ff); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; }
.foryou-body { flex: 1; min-width: 0; }
.foryou-name { font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 16px; color: var(--ink); display: flex; align-items: center; gap: 6px; }
.foryou-verified { color: #22e5d4; font-size: 12px; }
.foryou-meta { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--ink-a50); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.foryou-reason { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 6px; }
.foryou-hype { flex-shrink: 0; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: var(--ink-a50); }
.foryou-empty { text-align: center; padding: 32px; background: #100d09; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; }
.foryou-empty p { font-family: 'DM Sans', sans-serif; color: var(--ink-a60); margin: 0 0 14px; }
.foryou-cta { display: inline-block; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px; padding: 12px 22px; border-radius: 9999px; background: linear-gradient(135deg, #ff5029, #ff3e6e); color: #fff; text-decoration: none; }
.foryou-foot { font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--ink-a50); text-align: center; margin-top: 24px; }
.foryou-foot a { color: #ff5029; }
`;
