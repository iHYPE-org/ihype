import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PiAdminButton } from '@/components/PiAdminButton';
import { isInviteCodeRequiredRuntime } from '@/lib/runtime-flags';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';
import { getServerT } from '@/lib/i18n/server';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';

const TITLE = 'iHYPE — Your local music scene, completely free';
const DESCRIPTION = 'iHYPE is your local music scene in one app. Discover the artists, DJs, and live shows happening near you, hype the moments you love, and grab tickets with zero fees. Completely free — no subscription, no catch.';
const SOCIAL_DESCRIPTION = 'Your local music scene in one app. Discover artists and live shows near you, hype the moments you love, and get tickets with zero fees. Completely free.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: getBaseUrl() },
  openGraph: {
    type: 'website',
    siteName: 'iHYPE',
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    url: getBaseUrl(),
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
  },
};

/**
 * The note head is the split.
 *
 * Rather than decorate the page with a music note and separately assert the
 * 70/20/10 somewhere below it, the ring IS the chart: 70% artist orange, 20%
 * venue teal, 10% promoter purple, and the arc you cannot see is iHYPE's 0%.
 * One graphic carries the whole proposition, which is what lets everything
 * else on this page be short.
 *
 * aria-hidden, because a screen reader gets nothing from a dash array — the
 * same numbers are stated in text immediately below it.
 */
function SplitNote() {
  const r = 48;
  const c = 2 * Math.PI * r;
  const seg = (pct: number) => (c * pct) / 100;
  const ring = (pct: number, after: number, stroke: string) => (
    <circle
      cx="58"
      cy="148"
      r={r}
      stroke={stroke}
      strokeWidth="12"
      fill="none"
      strokeDasharray={`${seg(pct)} ${c - seg(pct)}`}
      strokeDashoffset={`${-seg(after)}`}
    />
  );

  return (
    <svg aria-hidden="true" className="idx-note" viewBox="0 0 172 208" fill="none" role="presentation">
      {/* rotate -90 so the split starts at 12 o'clock rather than 3 */}
      <g transform="rotate(-90 58 148)">
        {ring(70, 0, 'var(--accent)')}
        {ring(20, 70, 'var(--role-venue)')}
        {ring(10, 90, 'var(--role-fan)')}
      </g>
      {/* Stem and flag — what makes this read as a note rather than a pie
          chart. Drawn in ink, not accent: the colour in this mark is carrying
          data, so nothing decorative competes with it. */}
      <path d="M106 148V26" stroke="var(--ink)" strokeWidth="9" strokeLinecap="round" />
      <path d="M106 30c26 6 42 22 42 44 0 14-6 24-16 32 4-16-6-30-26-38Z" fill="var(--ink)" />
    </svg>
  );
}

export default async function RootPage() {
  const t = await getServerT();
  const session = await auth();
  // Straight to /listen rather than /home — /home is itself only a redirect
  // to /listen, so routing through it costs a signed-in visitor an extra hop
  // on their very first paint.
  if (session?.user?.id) redirect(WORKBENCH_PATH);

  const [artistCount, fanCount, totalHypes, showCount, inviteOnly] = await Promise.all([
    db.profile.count({ where: { type: 'ARTIST' } }).catch(() => 0),
    db.profile.count({ where: { type: 'LISTENER' } }).catch(() => 0),
    db.profileHypeEvent.count().catch(() => 0),
    db.show.count({ where: { status: { in: ['SCHEDULED', 'LIVE'] } } }).catch(() => 0),
    isInviteCodeRequiredRuntime(),
  ]);

  // "beta" framing only makes sense while signup is actually invite-gated,
  // and self-corrects the moment that flag flips off.
  const primaryCtaLabel = inviteOnly ? t('page.requestBeta', 'Request Beta') : t('page.getStarted', 'Get started');

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

  // Only real numbers appear. A pre-launch platform rendering "0 artists ·
  // 0 shows" beneath its own headline argues against itself more effectively
  // than any competitor could, so a zero is dropped rather than displayed and
  // the line disappears entirely when there is nothing true to say yet.
  const stats = [
    showCount > 0 ? `${fmt(showCount)} ${t('page.statShows', 'live shows')}` : null,
    artistCount > 0 ? `${fmt(artistCount)} ${t('page.statArtists', 'artists')}` : null,
    fanCount > 0 ? `${fmt(fanCount)} ${t('page.statFans', 'fans')}` : null,
    totalHypes > 0 ? `${fmt(totalHypes)} ${t('page.statHypes', 'hypes')}` : null,
  ].filter((entry): entry is string => entry !== null);

  const points = [
    {
      k: 'fee',
      head: t('page.pointFeeHead', 'Zero ticket fees'),
      body: t('page.pointFeeBody', 'Face value is face value. iHYPE takes nothing.'),
      tone: 'var(--accent)',
    },
    {
      k: 'split',
      head: t('page.pointSplitHead', '70 / 20 / 10, locked'),
      body: t('page.pointSplitBody', 'Artist, venue, promoter — a condition of incorporation.'),
      tone: 'var(--role-venue)',
    },
    {
      k: 'hype',
      head: t('page.pointHypeHead', 'No pay-to-play'),
      body: t('page.pointHypeBody', 'A hype is a real signal. It cannot be bought.'),
      tone: 'var(--role-fan)',
    },
    {
      k: 'data',
      head: t('page.pointDataHead', 'Your data is not for sale'),
      body: t('page.pointDataBody', 'Music ads fund this, the way radio always did.'),
      tone: 'var(--accent-2)',
    },
  ];

  return (
    <div className="idx-one">
      <section className="idx-one-inner">
        <p className="idx-one-eyebrow">{t('page.heroEyebrow', 'Completely free · your local scene')}</p>

        <SplitNote />

        <h1 className="idx-one-h1">{t('page.oneHeadline', 'Your local scene, completely free.')}</h1>
        <p className="idx-one-sub">
          {t('page.oneSub', 'Find the artists and shows near you, hype what you love, and buy tickets at face value.')}
        </p>

        <ul className="idx-one-points">
          {points.map((p) => (
            <li className="idx-one-point" key={p.k}>
              <span aria-hidden="true" className="idx-one-point-dot" style={{ background: p.tone }} />
              <strong className="idx-one-point-head">{p.head}</strong>
              <span className="idx-one-point-body">{p.body}</span>
            </li>
          ))}
        </ul>

        <div className="idx-one-actions">
          <Link className="idx-one-cta" href="/join">{primaryCtaLabel}</Link>
          <Link className="idx-one-alt" href="/login">{t('page.signIn', 'Sign in')}</Link>
        </div>

        {stats.length > 0 && <p className="idx-one-stats">{stats.join(' · ')}</p>}

        <p className="idx-one-foot">
          <Link href="/info?tab=charter">{t('page.readCharter', 'Read the charter')}</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/info?tab=transparency">{t('page.seeNumbers', 'See the numbers')}</Link>
        </p>
      </section>
      <PiAdminButton />
    </div>
  );
}
