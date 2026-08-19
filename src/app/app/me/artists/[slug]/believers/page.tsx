import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getEarlyBelievers } from '@/lib/earlyBelievers';
import { BelieverShareButton } from '@/components/BelieverShareButton';
import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEarlyBelievers(slug, null);
  if (!data) return { title: 'Early Believers · iHYPE' };
  const title = `Early believers in ${data.artistName} · iHYPE`;
  const description = `${data.totalBelievers} people believed in ${data.artistName}. See who called it first.`;
  return {
    title,
    description,
    openGraph: {
      title, description, siteName: 'iHYPE', type: 'website',
      url: `/app/me/artists/${slug}/believers`,
      images: [{ url: `/api/og?${new URLSearchParams({ title: `Believers in ${data.artistName}`, subtitle: `${data.totalBelievers} called it first`, type: 'artist' }).toString()}`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function BelieversPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const t = await getServerT();
  const data = await getEarlyBelievers(slug, session?.user?.id ?? null);
  if (!data) notFound();

  return (
    <div className="believers-page">
      <style>{BELIEVERS_CSS}</style>

      <header className="believers-head">
        <span className="believers-eyebrow">{t('artistsSlugBelieversPage.eyebrow', 'EARLY BELIEVERS')}</span>
        <h1 className="believers-title">{t('artistsSlugBelieversPage.titlePrefix', 'Who called')} <Link href={`/app/artists/${data.artistSlug}`} className="believers-artist-link">{data.artistName}</Link> {t('artistsSlugBelieversPage.titleSuffix', 'first')}</h1>
        <p className="believers-sub">{data.totalBelievers} {data.totalBelievers === 1 ? t('artistsSlugBelieversPage.personHas', 'person has') : t('artistsSlugBelieversPage.peopleHave', 'people have')} {t('artistsSlugBelieversPage.hyped', 'hyped')} {data.artistName}. {t('artistsSlugBelieversPage.earlyExplainer', 'The first')} {data.earlyCount} {t('artistsSlugBelieversPage.areEarlyBelievers', 'are early believers.')}</p>
      </header>

      {data.viewerRank ? (
        <div className={`believers-you${data.viewerIsEarly ? ' believers-you-early' : ''}`}>
          <div className="believers-you-rank">#{data.viewerRank}</div>
          <div className="believers-you-text">
            <strong>{data.viewerIsEarly ? t('artistsSlugBelieversPage.youAreEarly', "You're an early believer.") : t('artistsSlugBelieversPage.youAreBeliever', "You're a believer.")}</strong>
            <span>{t('artistsSlugBelieversPage.youWereThe', 'You were the')} {ordinal(data.viewerRank)} {t('artistsSlugBelieversPage.toHype', 'to hype')} {data.artistName}.</span>
          </div>
          <BelieverShareButton artistName={data.artistName} artistSlug={data.artistSlug} rank={data.viewerRank} />
        </div>
      ) : (
        <div className="believers-cta-card">
          <span>{t('artistsSlugBelieversPage.believeIn', 'Believe in')} {data.artistName}? {t('artistsSlugBelieversPage.hypeAndClaim', 'Hype them and claim your rank.')}</span>
          <Link href={`/app/artists/${data.artistSlug}`} className="believers-cta">{t('artistsSlugBelieversPage.goHype', 'Go hype')}</Link>
        </div>
      )}

      <ol className="believers-list">
        {data.believers.map((b) => (
          <li key={b.rank} className={`believers-row${b.isViewer ? ' believers-row-you' : ''}`}>
            <span className="believers-rank">{String(b.rank).padStart(2, '0')}</span>
            <span className="believers-avatar" style={b.avatarUrl ? { backgroundImage: `url(${b.avatarUrl})` } : undefined}>
              {!b.avatarUrl && b.initials}
            </span>
            <span className="believers-name">
              {b.fanSlug ? <Link href={`/app/fans/${b.fanSlug}`}>{b.name}</Link> : b.name}
              {b.isViewer && <span className="believers-you-tag">{t('artistsSlugBelieversPage.youTag', 'YOU')}</span>}
            </span>
            {b.rank <= data.earlyCount && <span className="believers-early-tag">{t('artistsSlugBelieversPage.earlyTag', 'EARLY')}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const BELIEVERS_CSS = `
.believers-page { max-width: 640px; margin: 0 auto; padding: 32px 16px 64px; }
.believers-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.16em; color: var(--accent); }
.believers-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 2rem; line-height: 1.05; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 10px; }
.believers-artist-link { color: var(--accent); text-decoration: none; }
.believers-sub { font-family: 'Work Sans', sans-serif; font-size: 0.875rem; line-height: 1.5; color: var(--ink-a65); margin: 0 0 24px; }
.believers-you, .believers-cta-card { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 16px; background: var(--bg-2); border: 1px solid var(--hair-80); margin-bottom: 22px; }
.believers-you-early { border-color: rgba(var(--accent-rgb),0.5); box-shadow: 0 0 50px rgba(var(--accent-rgb),0.10); }
.believers-you-rank { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 1.875rem; color: var(--accent); letter-spacing: -0.03em; }
.believers-you-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.believers-you-text strong { font-family: 'Work Sans', sans-serif; font-size: 0.9375rem; color: var(--ink); }
.believers-you-text span { font-family: 'Work Sans', sans-serif; font-size: 0.8125rem; color: var(--ink-a65); }
.believers-share-btn, .believers-cta { flex-shrink: 0; font-family: 'Work Sans', sans-serif; font-weight: 600; font-size: 0.875rem; padding: 10px 18px; border-radius: 9999px; border: none; cursor: pointer; background: var(--accent-grad-warm); color: var(--ink-on-accent); text-decoration: none; }
.believers-cta-card span { flex: 1; font-family: 'Work Sans', sans-serif; font-size: 0.875rem; color: var(--ink-a70); }
.believers-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.believers-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; }
.believers-row-you { background: rgba(var(--accent-rgb),0.08); }
.believers-rank { font-family: 'JetBrains Mono', monospace; font-size: 0.7813rem; color: var(--ink-a65); width: 24px; }
.believers-avatar { flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--role-fan), var(--accent-2)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 0.7813rem; color: var(--ink-on-accent); }
.believers-name { flex: 1; font-family: 'Work Sans', sans-serif; font-weight: 500; font-size: 0.9375rem; color: var(--ink); display: flex; align-items: center; gap: 8px; }
.believers-name a { color: var(--ink); text-decoration: none; }
.believers-name a:hover { color: var(--accent); }
.believers-you-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.7813rem; letter-spacing: 0.1em; color: var(--accent); background: rgba(var(--accent-rgb),0.14); border-radius: 4px; padding: 2px 6px; }
.believers-early-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.7813rem; letter-spacing: 0.1em; color: var(--role-fan); background: rgba(var(--role-fan-rgb),0.12); border-radius: 4px; padding: 3px 7px; }
`;
