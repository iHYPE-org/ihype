import Link from 'next/link';
import { db } from '@/lib/db';
import { CommunityVoteBoard } from '@/components/CommunityVoteBoard';

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
        <h1>Community</h1>
        <p className="community-lede">
          Communications and changes from the iHYPE team, plus a real vote on what we build next.
        </p>
      </div>

      <div className="community-content">
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

        <section className="community-cta">
          <div>
            <h2>Every vote and every dollar, on the record.</h2>
            <p>The 45/45/10 split and the vote you just cast are both spelled out in the charter — not a marketing promise.</p>
          </div>
          <Link className="ihype-btn-primary" href="/charter" style={{ flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Read the charter →
          </Link>
        </section>
      </div>

      <style>{`
        .community-page { max-width: 720px; margin: 0 auto; padding: 32px 0 100px; }
        .community-hero { padding: 0 20px; margin-bottom: 32px; }
        .community-hero h1 { font-family: var(--font-display); font-size: clamp(2rem, 6vw, 2.6rem); font-weight: 800; letter-spacing: -.02em; color: var(--ink); margin: 0 0 10px; }
        .community-lede { font-size: 15px; line-height: 1.6; color: rgba(240,235,229,.7); margin: 0; max-width: 56ch; }
        .community-content { padding: 0 20px; display: flex; flex-direction: column; gap: 44px; }
        .community-section-head { margin-bottom: 16px; }
        .community-eyebrow { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--accent, #ff5029); letter-spacing: .14em; }
        .community-section-head h2 { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -.01em; color: var(--ink); margin: 6px 0 0; }
        .community-section-copy { font-size: 13px; color: rgba(240,235,229,.6); margin: 6px 0 0; line-height: 1.5; }
        .community-card { border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 22px; background: var(--bg-2, #100d09); }
        .community-empty { text-align: center; color: rgba(240,235,229,.45); font-size: 14px; }
        .community-post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .community-badge { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; padding: 4px 10px; border-radius: 999px; border: 1px solid; }
        .community-post-date { font-family: var(--font-mono); font-size: 11px; color: rgba(240,235,229,.45); }
        .community-card h3 { font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--ink); margin: 0 0 6px; }
        .community-post-summary { font-size: 13px; color: rgba(240,235,229,.65); margin: 0 0 8px; line-height: 1.5; }
        .community-post-body { font-size: 14px; color: rgba(240,235,229,.85); white-space: pre-wrap; margin: 0 0 10px; line-height: 1.6; }
        .community-post-author { font-family: var(--font-mono); font-size: 11px; color: rgba(240,235,229,.4); margin: 0; }
        .community-cta { border: 1px solid rgba(255,80,41,.2); border-radius: 16px; padding: 28px 24px; background: rgba(255,80,41,.05); display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .community-cta h2 { font-family: var(--font-display); font-size: 19px; font-weight: 800; color: var(--ink); margin: 0 0 8px; letter-spacing: -.01em; }
        .community-cta p { font-size: 13px; color: rgba(240,235,229,.65); margin: 0; max-width: 46ch; line-height: 1.5; }

        @media (max-width: 600px) {
          .community-cta { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
