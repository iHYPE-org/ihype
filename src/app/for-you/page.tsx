import Link from 'next/link';
import { auth } from '@/lib/auth';
import { detectRequestLocation } from '@/lib/request-location';
import { getRecommendations } from '@/lib/recommendations';
import { enhanceRecommendationsWithAI } from '@/lib/ai-recommendations';
import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'For You · iHYPE',
  description: 'Artists picked for you — and exactly why, based on who you hype.',
};

const REASON_COLOR: Record<string, string> = {
  taste: 'var(--accent)',
  collab: 'var(--role-fan)',
  comparable: 'var(--role-fan)',
  geo: 'var(--role-venue)',
  momentum: 'var(--accent-2)',
  social: 'var(--ink-a55)',
};

export default async function ForYouPage() {
  const t = await getServerT();
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
        <span className="foryou-eyebrow">{t('forYouPage.eyebrow', 'FOR YOU')}</span>
        <h1 className="foryou-title">{t('forYouPage.title', 'Picked for your taste')}</h1>
        <p className="foryou-sub">
          {meta.viewerHasHypeHistory
            ? t('forYouPage.subWithHistory', 'Ranked from who you hype, who fans like you hype, your scene, and what’s rising.')
            : t('forYouPage.subWithoutHistory', 'Hype a few artists and these get personal — each pick will show exactly why.')}
        </p>
      </header>

      {profiles.length === 0 ? (
        <div className="foryou-empty">
          <p>{t('forYouPage.emptyState', 'Nothing to recommend yet.')}</p>
          <Link href="/discover" className="foryou-cta">{t('forYouPage.browseArtists', 'Browse artists')}</Link>
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
                    {(p.genres.slice(0, 2).join(' · ') || t('forYouPage.artistFallback', 'Artist'))}{p.city ? ` · ${p.city}` : ''}
                  </div>
                  <div className="foryou-reason" style={{ color: REASON_COLOR[p.reason.kind] ?? REASON_COLOR.social }}>
                    {p.reason.text}
                  </div>
                </div>
                {p.hypeCount > 0 && <span className="foryou-hype">{p.hypeCount} {t('forYouPage.hypeUnit', 'HYPE')}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!session?.user?.id && profiles.length > 0 && (
        <p className="foryou-foot"><Link href="/register">{t('forYouPage.signUp', 'Sign up')}</Link> {t('forYouPage.signUpSuffix', 'to make these personal.')}</p>
      )}
    </div>
  );
}

const FORYOU_CSS = `
.foryou-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
.foryou-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: var(--accent); }
.foryou-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 34px; line-height: 1.0; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 10px; }
.foryou-sub { font-family: 'Work Sans', sans-serif; font-size: 15px; line-height: 1.6; color: var(--ink-a60); max-width: 54ch; margin: 0 0 24px; }
.foryou-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.foryou-card { background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; }
.foryou-card-link { display: flex; align-items: center; gap: 14px; padding: 14px 16px; text-decoration: none; }
.foryou-avatar { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--role-fan)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 18px; color: var(--ink-on-accent); }
.foryou-body { flex: 1; min-width: 0; }
.foryou-name { font-family: 'Work Sans', sans-serif; font-weight: 600; font-size: 16px; color: var(--ink); display: flex; align-items: center; gap: 6px; }
.foryou-verified { color: var(--role-venue); font-size: 12px; }
.foryou-meta { font-family: 'Work Sans', sans-serif; font-size: 13px; color: var(--ink-a50); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.foryou-reason { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 6px; }
.foryou-hype { flex-shrink: 0; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: var(--ink-a50); }
.foryou-empty { text-align: center; padding: 32px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; }
.foryou-empty p { font-family: 'Work Sans', sans-serif; color: var(--ink-a60); margin: 0 0 14px; }
.foryou-cta { display: inline-block; font-family: 'Work Sans', sans-serif; font-weight: 600; font-size: 15px; padding: 12px 22px; border-radius: 9999px; background: var(--accent-grad-warm); color: var(--ink-on-accent); text-decoration: none; }
.foryou-foot { font-family: 'Work Sans', sans-serif; font-size: 14px; color: var(--ink-a50); text-align: center; margin-top: 24px; }
.foryou-foot a { color: var(--accent); }
`;
