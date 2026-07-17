import Link from 'next/link';
import { db } from '@/lib/db';
import { CommunityVoteBoard } from '@/components/CommunityVoteBoard';
import { NewsletterSignup } from '@/components/NewsletterSignup';

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
const CATEGORY_COLOR: Record<string, string> = { update: '#ff5029', announcement: '#b983ff' };

const COMMUNITY_CHANNELS = [
  { icon: '🗳️', title: 'You get a vote', body: 'Platform changes ship with a feedback window. The split and moderation heuristics are published for public audit — check our work.' },
  { icon: '📻', title: 'Radio shows', body: 'Every DJ and promoter gets the same hosting tools, free. No tier unlocks anything — the scene decides what gets heard.' },
  { icon: '🔥', title: 'Hype honestly', body: 'No bots, no paid manipulation, no hidden incentives. Hype is the demand signal venues book from — keep it real.' },
  { icon: '🛡️', title: 'Look out for each other', body: 'Report unsafe content, fraud, or impersonation. Every report is tracked to a resolution in the public trust & safety report.' },
];

export default async function CommunityPage() {
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
        <span className="community-page-badge">Community</span>
        <h1>The scene runs this place.</h1>
        <p className="community-lede">
          Users of iHYPE are stakeholders, not just customers. Meaningful changes — the split, moderation rules, new fees of any kind — are put to the people who use it.
        </p>
      </div>

      <div className="community-content">
        <section className="community-section community-channels">
          {COMMUNITY_CHANNELS.map((c) => (
            <div className="community-channel-card" key={c.title}>
              <div className="community-channel-icon">{c.icon}</div>
              <div>
                <h2>{c.title}</h2>
                <p>{c.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="community-section">
          <div className="community-section-head">
            <span className="community-eyebrow">Vote &amp; suggest</span>
            <h2>What should we build next?</h2>
            <p className="community-section-copy">
              Every idea here is a real, counted vote — the charter promise &ldquo;you get a vote&rdquo; points at this board.
            </p>
          </div>
          <div className="community-card">
            <CommunityVoteBoard />
          </div>
        </section>

        <section className="community-section">
          <div className="community-section-head">
            <span className="community-eyebrow">Collab board</span>
            <h2>Find your people</h2>
            <p className="community-section-copy">
              Musician classifieds — post what you&apos;re looking for, or what you have to offer, and browse what the rest of the scene has posted.
            </p>
          </div>
          <div className="community-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-a70)', maxWidth: '48ch' }}>
              Drummers, vocalists, producers, venues, DJs — post a listing or browse what&apos;s open.
            </p>
            <Link className="ihype-btn-primary" href="/collab-board" style={{ flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Open the collab board →
            </Link>
          </div>
        </section>

        <section className="community-section">
          <div className="community-section-head">
            <span className="community-eyebrow">Updates</span>
            <h2>What&apos;s changed</h2>
          </div>
          {posts.length === 0 ? (
            <div className="community-card community-empty">
              <p>No community updates yet.</p>
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
                      {CATEGORY_LABEL[p.meta.category ?? 'update'] ?? 'Update'}
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
            <span className="community-eyebrow">Stay in the loop</span>
            <h2>Get updates from the scene</h2>
            <p className="community-section-copy">
              Follow a specific artist, venue, or DJ by email — we send a one-click confirm link, and only that profile&apos;s updates land in your inbox.
            </p>
          </div>
          <div className="community-card">
            <NewsletterSignup />
          </div>
        </section>

        <section className="community-cta">
          <div>
            <h2>Every vote and every dollar, on the record.</h2>
            <p>The 70/20/10 split and the vote you just cast are both spelled out in the charter — not a marketing promise.</p>
          </div>
          <Link className="ihype-btn-primary" href="/charter" style={{ flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Read the charter →
          </Link>
        </section>
      </div>

      <style>{`
        .community-page { max-width: 720px; margin: 0 auto; padding: 32px 0 100px; }
        .community-hero { padding: 0 20px; margin-bottom: 32px; }
        .community-page-badge { display: inline-block; font-family: var(--font-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent, #ff5029); border: 1px solid rgba(255,80,41,.3); background: rgba(255,80,41,.07); border-radius: 999px; padding: 5px 13px; margin-bottom: 14px; }
        .community-hero h1 { font-family: var(--font-display); font-size: clamp(2rem, 6vw, 2.6rem); font-weight: 800; letter-spacing: -.02em; color: var(--ink); margin: 0 0 10px; }
        .community-lede { font-size: 15px; line-height: 1.6; color: var(--ink-a70); margin: 0; max-width: 56ch; }
        .community-content { padding: 0 20px; display: flex; flex-direction: column; gap: 44px; }
        .community-channels { display: flex; flex-direction: column; gap: 12px; }
        .community-channel-card { display: flex; gap: 16px; align-items: flex-start; background: var(--bg-2, #100d09); border: 1px solid var(--hair-70); border-radius: 14px; padding: 20px 22px; }
        .community-channel-icon { font-size: 1.5rem; flex-shrink: 0; }
        .community-channel-card h2 { font-family: var(--font-display); font-weight: 800; font-size: 1.02rem; color: var(--ink); margin: 0 0 6px; }
        .community-channel-card p { font-size: .88rem; color: var(--ink-a70); line-height: 1.6; margin: 0; }
        .community-section-head { margin-bottom: 16px; }
        .community-eyebrow { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--accent, #ff5029); letter-spacing: .14em; }
        .community-section-head h2 { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -.01em; color: var(--ink); margin: 6px 0 0; }
        .community-section-copy { font-size: 13px; color: var(--ink-a60); margin: 6px 0 0; line-height: 1.5; }
        .community-card { border: 1px solid var(--hair-70); border-radius: 14px; padding: 22px; background: var(--bg-2, #100d09); }
        .community-empty { text-align: center; color: var(--ink-a45); font-size: 14px; }
        .community-post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .community-badge { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; padding: 4px 10px; border-radius: 999px; border: 1px solid; }
        .community-post-date { font-family: var(--font-mono); font-size: 11px; color: var(--ink-a45); }
        .community-card h3 { font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--ink); margin: 0 0 6px; }
        .community-post-summary { font-size: 13px; color: var(--ink-a65); margin: 0 0 8px; line-height: 1.5; }
        .community-post-body { font-size: 14px; color: var(--ink-a85); white-space: pre-wrap; margin: 0 0 10px; line-height: 1.6; }
        .community-post-author { font-family: var(--font-mono); font-size: 11px; color: var(--ink-a40); margin: 0; }
        .community-cta { border: 1px solid rgba(255,80,41,.2); border-radius: 16px; padding: 28px 24px; background: rgba(255,80,41,.05); display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .community-cta h2 { font-family: var(--font-display); font-size: 19px; font-weight: 800; color: var(--ink); margin: 0 0 8px; letter-spacing: -.01em; }
        .community-cta p { font-size: 13px; color: var(--ink-a65); margin: 0; max-width: 46ch; line-height: 1.5; }

        @media (max-width: 600px) {
          .community-cta { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
