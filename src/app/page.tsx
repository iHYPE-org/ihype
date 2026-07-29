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
 * Music, and a place.
 *
 * This was a 70/20/10 donut with a stem — the revenue split as the hero
 * graphic. That is the mission argument, and the mission now lives on /info
 * for people who have already come in. Leading with it meant the first thing
 * a stranger saw was an economics diagram.
 *
 * A pin holding a note says the two things this page is actually for: music,
 * and near you. The brand palette is still here as the gradient on the pin,
 * but it is identity now rather than data — nothing in this mark encodes a
 * number, so nothing in it can be misread as one.
 *
 * aria-hidden: purely decorative, and the headline beneath says the same
 * thing in words.
 */
function LocalNote() {
  return (
    <svg aria-hidden="true" className="idx-note" viewBox="0 0 140 176" fill="none" role="presentation">
      <defs>
        <linearGradient id="idxPin" x1="12" y1="6" x2="128" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="0.55" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--role-fan)" />
        </linearGradient>
      </defs>
      {/* Pin: a teardrop that comes to a point at the bottom, so it reads as
          "here" rather than as a balloon. */}
      <path
        d="M70 8c-30.9 0-56 24.6-56 55 0 38.6 46.3 78.6 53 84.2a4.6 4.6 0 0 0 6 0c6.7-5.6 53-45.6 53-84.2 0-30.4-25.1-55-56-55Z"
        stroke="url(#idxPin)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      {/* Eighth note sitting in the pin's void. */}
      <circle cx="57" cy="83" r="13" fill="var(--ink)" />
      <path d="M69 83V38" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" />
      <path d="M69 40c17 4 27 14 27 28 0 9-4 15-10 20 3-10-4-19-17-24Z" fill="var(--ink)" />
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

  // Music, place, and what showing up changes. Deliberately no fee, split or
  // charter copy: that is the mission, it is well told on /info, and it is a
  // second conversation. This page only has to make someone want to hear
  // what is playing near them.
  const points = [
    {
      k: 'near',
      head: t('page.pointCityHead', 'Hear your city'),
      body: t('page.pointCityBody', 'The artists playing near you this week.'),
      tone: 'var(--role-fan)',
    },
    {
      k: 'early',
      head: t('page.pointEarlyHead', 'Find them early'),
      body: t('page.pointEarlyBody', 'Before they turn up on everyone else\u2019s playlist.'),
      tone: 'var(--accent)',
    },
    {
      k: 'hype',
      head: t('page.pointCountHead', 'Your hype counts'),
      body: t('page.pointCountBody', 'It is what tells venues who to book next.'),
      tone: 'var(--accent-2)',
    },
    {
      k: 'scene',
      head: t('page.pointSceneHead', 'Keep the scene alive'),
      body: t('page.pointSceneBody', 'Every ticket keeps a local room open.'),
      tone: 'var(--role-venue)',
    },
  ];

  return (
    <div className="idx-one">
      <section className="idx-one-inner">
        <p className="idx-one-eyebrow">{t('page.heroEyebrowLocal', 'Live music · near you')}</p>

        <LocalNote />

        <h1 className="idx-one-h1">{t('page.oneHeadlineMusic', 'The music happening around you.')}</h1>
        <p className="idx-one-sub">
          {t('page.oneSubMusic', 'Find the artists playing your city, hype the ones you love, and be there when it happens.')}
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

        {/* Straight to /register, not /join. /join is a role chooser whose
            Fan card leads to another page before anything is created — a
            detour that only makes sense for someone deciding what they are.
            A fan already knows, and every account starts as a fan anyway, so
            the chooser is friction on the one path this page is selling.
            Creators still get in, one line down. */}
        <div className="idx-one-actions">
          <Link className="idx-one-cta" href="/register">{primaryCtaLabel}</Link>
          <Link className="idx-one-alt" href="/login">{t('page.signIn', 'Sign in')}</Link>
        </div>

        {stats.length > 0 && <p className="idx-one-stats">{stats.join(' · ')}</p>}

        {/* The only two things a stranger might still want before signing
            up: a different door if they are not a fan, and the reason any of
            this exists. Both are one click, neither is on this page. */}
        <p className="idx-one-foot">
          <Link href="/join">{t('page.creatorDoor', 'Artist, DJ or venue?')}</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/info?tab=charter">{t('page.whyBuilt', 'Why we built this')}</Link>
        </p>
      </section>
      <PiAdminButton />
    </div>
  );
}
