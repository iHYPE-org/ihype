import Link from 'next/link';
import { db } from '@/lib/db';
import { CommunityVoteBoard } from '@/components/CommunityVoteBoard';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import { getServerT } from '@/lib/i18n/server';

export const metadata = { title: 'Community · iHYPE', description: 'Platform updates, announcements, and a vote on what we build next.' };
export const dynamic = 'force-dynamic';

type CommunityMeta = {
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  category?: 'update' | 'announcement';
  author?: string;
};

const CATEGORY_LABEL: Record<string, string> = { update: 'Update', announcement: 'Announcement' };
const CATEGORY_COLOR: Record<string, string> = { update: 'var(--accent)', announcement: 'var(--role-fan)' };

const COMMUNITY_CHANNELS = [
  { icon: '🗳️', title: 'You get a vote', body: 'Platform changes ship with a feedback window. The split and moderation heuristics are published for public audit — check our work.' },
  { icon: '📻', title: 'Radio shows', body: 'Every DJ and promoter gets the same hosting tools, free. No tier unlocks anything — the scene decides what gets heard.' },
  { icon: '🔥', title: 'Hype honestly', body: 'No bots, no paid manipulation, no hidden incentives. Hype is the demand signal venues book from — keep it real.' },
  { icon: '🛡️', title: 'Look out for each other', body: 'Report unsafe content, fraud, or impersonation. Every report is tracked to a resolution in the public trust & safety report.' },
];

export default async function CommunityPage() {
  const t = await getServerT();
  const categoryLabel = (key: string) => t(`communityPage.category.${key}`, CATEGORY_LABEL[key] ?? key);
  const channelTitles = [
    t('communityPage.channel0Title', 'You get a vote'),
    t('communityPage.channel1Title', 'Radio shows'),
    t('communityPage.channel2Title', 'Hype honestly'),
    t('communityPage.channel3Title', 'Look out for each other'),
  ];
  const channelBodies = [
    t('communityPage.channel0Body', 'Platform changes ship with a feedback window. The split and moderation heuristics are published for public audit — check our work.'),
    t('communityPage.channel1Body', 'Every DJ and promoter gets the same hosting tools, free. No tier unlocks anything — the scene decides what gets heard.'),
    t('communityPage.channel2Body', 'No bots, no paid manipulation, no hidden incentives. Hype is the demand signal venues book from — keep it real.'),
    t('communityPage.channel3Body', 'Report unsafe content, fraud, or impersonation. Every report is tracked to a resolution in the public trust & safety report.'),
  ];
  const rows = await db.auditLog.findMany({
    where: { action: 'community_update' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, metadata: true }
  });

  const posts = rows
    .map((r) => ({ id: r.id, createdAt: r.createdAt, meta: (r.metadata ?? {}) as CommunityMeta }))
    .filter((p) => typeof p.meta.slug === 'string' && typeof p.meta.title === 'string');

  return (
    <div className="community-page">
      <div className="community-hero">
        <span className="community-page-badge">{t('communityPage.badge', 'Community')}</span>
        <h1>{t('communityPage.heroTitle', 'The scene runs this place.')}</h1>
        <p className="community-lede">
          {t('communityPage.lede', 'Users of iHYPE are stakeholders, not just customers. Meaningful changes — the split, moderation rules, new fees of any kind — are put to the people who use it.')}
        </p>
      </div>

      <div className="community-content">
        <section className="community-section community-channels">
          {COMMUNITY_CHANNELS.map((c, i) => (
            <div className="community-channel-card" key={c.title}>
              <div className="community-channel-icon">{c.icon}</div>
              <div>
                <h2>{channelTitles[i]}</h2>
                <p>{channelBodies[i]}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="community-section">
          <div className="community-section-head">
            <span className="community-eyebrow">{t('communityPage.updatesEyebrow', 'Newsroom')}</span>
            <h2>{t('communityPage.updatesTitle', 'What we shipped, and what changed')}</h2>
            <p className="community-section-copy">
              {t('communityPage.updatesCopy', 'Every platform change, split decision and moderation-rule update gets written up here — the running public record of how iHYPE is run.')}
            </p>
          </div>
          {posts.length === 0 ? (
            <div className="community-card community-empty">
              <p>{t('communityPage.updatesEmpty', 'No community updates yet.')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {posts.map((p) => (
                <article className="community-card" key={p.id}>
                  <div className="community-post-head">
                    <span
                      className="community-badge"
                      style={{ color: CATEGORY_COLOR[p.meta.category ?? 'update'], borderColor: `${CATEGORY_COLOR[p.meta.category ?? 'update']}40`, background: `${CATEGORY_COLOR[p.meta.category ?? 'update']}12` }}
                    >
                      {categoryLabel(p.meta.category ?? 'update')}
                    </span>
                    <span className="community-post-date">{p.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <h3>{p.meta.title}</h3>
                  {p.meta.summary ? <p className="community-post-summary">{p.meta.summary}</p> : null}
                  {p.meta.body ? <p className="community-post-body">{p.meta.body}</p> : null}
                  <p className="community-post-author">{p.meta.author ?? 'iHYPE'}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="community-section">
          <div className="community-section-head">
            <span className="community-eyebrow">{t('communityPage.voteEyebrow', 'Vote & suggest')}</span>
            <h2>{t('communityPage.voteTitle', 'Open votes on where iHYPE goes next')}</h2>
            <p className="community-section-copy">
              {t('communityPage.voteCopy', 'When a direction change comes up it is posted here for a vote, and any signed-in account gets one. Every vote is real and counted — the charter promise "you get a vote" points at this board.')}
            </p>
          </div>
          <div className="community-card">
            <CommunityVoteBoard />
          </div>
        </section>

        <section className="community-section">
          <div className="community-section-head">
            <span className="community-eyebrow">{t('communityPage.collabEyebrow', 'Collab board')}</span>
            <h2>{t('communityPage.collabTitle', 'Find your people')}</h2>
            <p className="community-section-copy">
              {t('communityPage.collabCopy', "Musician classifieds — post what you're looking for, or what you have to offer, and browse what the rest of the scene has posted.")}
            </p>
          </div>
          <div className="community-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ink-a70)', maxWidth: '48ch' }}>
              {t('communityPage.collabSub', "Drummers, vocalists, producers, venues, DJs — post a listing or browse what's open.")}
            </p>
            <Link className="ihype-btn-primary" href="/collab-board" style={{ flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              {t('communityPage.collabLink', 'Open the collab board →')}
            </Link>
          </div>
        </section>

        <section className="community-section">
          <div className="community-section-head">
            <span className="community-eyebrow">{t('communityPage.newsletterEyebrow', 'Stay in the loop')}</span>
            <h2>{t('communityPage.newsletterTitle', 'Get updates from the scene')}</h2>
            <p className="community-section-copy">
              {t('communityPage.newsletterCopy', "Follow a specific artist, venue, or DJ by email — we send a one-click confirm link, and only that profile's updates land in your inbox.")}
            </p>
          </div>
          <div className="community-card">
            <NewsletterSignup />
          </div>
        </section>

        <section className="community-cta">
          <div>
            <h2>{t('communityPage.ctaTitle', 'Every vote and every dollar, on the record.')}</h2>
            <p>{t('communityPage.ctaBody', 'The 70/20/10 split and the vote you just cast are both spelled out in the charter — not a marketing promise.')}</p>
          </div>
          <Link className="ihype-btn-primary" href="/info?tab=charter" style={{ flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            {t('communityPage.ctaLink', 'Read the charter →')}
          </Link>
        </section>
      </div>

      <style>{`
        .community-page { max-width: 720px; margin: 0 auto; padding: 32px 0 100px; }
        .community-hero { padding: 0 20px; margin-bottom: 32px; }
        .community-page-badge { display: inline-block; font-family: var(--font-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); border: 1px solid rgba(var(--accent-rgb),.3); background: rgba(var(--accent-rgb),.07); border-radius: 999px; padding: 5px 13px; margin-bottom: 14px; }
        .community-hero h1 { font-family: var(--font-display); font-size: clamp(2rem, 6vw, 2.6rem); font-weight: 800; letter-spacing: -.02em; color: var(--ink); margin: 0 0 10px; }
        .community-lede { font-size: 15px; line-height: 1.6; color: var(--ink-a70); margin: 0; max-width: 56ch; }
        .community-content { padding: 0 20px; display: flex; flex-direction: column; gap: 44px; }
        .community-channels { display: flex; flex-direction: column; gap: 12px; }
        .community-channel-card { display: flex; gap: 16px; align-items: flex-start; background: var(--bg-2); border: 1px solid var(--hair-70); border-radius: 14px; padding: 20px 22px; }
        .community-channel-icon { font-size: 1.5rem; flex-shrink: 0; }
        .community-channel-card h2 { font-family: var(--font-display); font-weight: 800; font-size: 1.02rem; color: var(--ink); margin: 0 0 6px; }
        .community-channel-card p { font-size: .88rem; color: var(--ink-a70); line-height: 1.6; margin: 0; }
        .community-section-head { margin-bottom: 16px; }
        .community-eyebrow { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--accent); letter-spacing: .14em; }
        .community-section-head h2 { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -.01em; color: var(--ink); margin: 6px 0 0; }
        .community-section-copy { font-size: 13px; color: var(--ink-a60); margin: 6px 0 0; line-height: 1.5; }
        .community-card { border: 1px solid var(--hair-70); border-radius: 14px; padding: 22px; background: var(--bg-2); }
        .community-empty { text-align: center; color: var(--ink-a45); font-size: 14px; }
        .community-post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .community-badge { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; padding: 4px 10px; border-radius: 999px; border: 1px solid; }
        .community-post-date { font-family: var(--font-mono); font-size: 11px; color: var(--ink-a45); }
        .community-card h3 { font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--ink); margin: 0 0 6px; }
        .community-post-summary { font-size: 13px; color: var(--ink-a65); margin: 0 0 8px; line-height: 1.5; }
        .community-post-body { font-size: 14px; color: var(--ink-a85); white-space: pre-wrap; margin: 0 0 10px; line-height: 1.6; }
        .community-post-author { font-family: var(--font-mono); font-size: 11px; color: var(--ink-a40); margin: 0; }
        .community-cta { border: 1px solid rgba(var(--accent-rgb),.2); border-radius: 16px; padding: 28px 24px; background: rgba(var(--accent-rgb),.05); display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .community-cta h2 { font-family: var(--font-display); font-size: 19px; font-weight: 800; color: var(--ink); margin: 0 0 8px; letter-spacing: -.01em; }
        .community-cta p { font-size: 13px; color: var(--ink-a65); margin: 0; max-width: 46ch; line-height: 1.5; }

        @media (max-width: 600px) {
          .community-cta { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
