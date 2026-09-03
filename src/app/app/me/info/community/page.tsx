import type { Metadata } from 'next';
import Link from 'next/link';
import { CommunityVoteBoard } from '@/components/CommunityVoteBoard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Community · iHYPE',
  robots: { index: false, follow: false },
};

/**
 * The roadmap board, at a route that exists.
 *
 * `CommunityVoteBoard` reads and writes `/api/feedback` — a real table, a real
 * one-vote-per-member rule (the acceptance walk's V1 item proves it counts once
 * and that a second tap withdraws) — and it was mounted on no page at all. The
 * legacy `/community` route is a redirect into `/app/me?section=about`, so the
 * board had no home on either side of the cutover: members could not see what
 * had been asked for, and could not ask.
 *
 * It sits under Info rather than Settings because it is a public record of what
 * the product is going to do, which is the same kind of thing as the charter
 * and the transparency report beside it — not a preference.
 */
export default function MmmCommunityPage() {
  return (
    <article className="mmm-info-report">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ Info</Link>
      <header className="mmm-info-report-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">Me · Info</p>
        <h1>Community roadmap</h1>
        <p>What members have asked for, and what they have voted up. Anyone signed in can add one.</p>
      </header>
      <CommunityVoteBoard />
    </article>
  );
}
