import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { WelcomeStepsChecklist } from '@/components/WelcomeStepsChecklist';
import { getProfilePathForType } from '@/lib/profile-paths';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Welcome · iHYPE',
  robots: { index: false, follow: false },
};

type Role = 'FAN' | 'ARTIST' | 'VENUE' | 'DJ';

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');

  const t = await getServerT();

  // POST /api/register creates the Profile in the same transaction as the User,
  // so by the time anyone lands here it exists. First-created wins if the
  // account has since grown more than one, matching how /settings picks the
  // invite link's profile. Null is still handled: an ADVERTISER account has no
  // Profile row at all (it gets routed to /advertise/dashboard instead, but
  // nothing structurally stops it reaching this URL).
  const profile = await db.profile.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { slug: true, type: true, verificationStatus: true, onboardedAt: true },
  });

  // Prefer the profile's own type over session.user.role: the profile is what
  // the onboarding wizard is keyed to, and getProfilePathForType already owns
  // the type -> URL-prefix mapping (ARTIST -> /artists, DJ -> /promoters,
  // VENUE -> /venues), so there is no second copy of it here to drift.
  const profileRole: Role | null =
    profile?.type === 'ARTIST' || profile?.type === 'VENUE'
      ? profile.type
      : profile
        ? 'FAN'
        : null;
  const sessionRole = (session.user as { role?: string }).role;
  const role: Role =
    profileRole
    ?? (sessionRole === 'ARTIST' || sessionRole === 'VENUE' || sessionRole === 'DJ' ? sessionRole : 'FAN');

  // "You're in." is a POST-SIGNUP screen — Welcome.dc.html's whole subject is
  // an account that has just been created. But `resolvePostAuthRedirect` sends
  // every generic sign-in here, so a creator who finished setup months ago was
  // still being congratulated on arriving, every single time, and had to click
  // through a setup CTA to get anywhere. That is the "this is all I see when I
  // sign in" report.
  //
  // Once the wizard has reported finishing there is nothing on this page for
  // them, so they go straight to the app. Keyed on `onboardedAt` because that
  // is the existing "this account is set up" signal; a fan has no such column
  // and still sees the screen once, which is correct — for a fan it really is
  // the confirmation that signup worked, and their CTA already leads to the app.
  if (profile?.onboardedAt) redirect(WORKBENCH_PATH);

  // Only the three creator roles have a wizard. A fan does not need one, and
  // without a profile row there is no slug to build a URL from.
  //
  // Skipped once the wizard has reported finishing: /welcome is normally seen
  // once at signup, but it is a plain URL anyone can return to, and sending a
  // set-up creator back through setup would undo the point of tracking it.
  const onboardingPath =
    profile && role !== 'FAN' && !profile.onboardedAt
      ? `${getProfilePathForType(profile.type, profile.slug)}/onboarding`
      : null;

  // Where a creator goes once the wizard is behind them. This used to fall back
  // to `/pages`, which produced the worst possible landing for the people most
  // invested in the platform: `resolvePostAuthRedirect` sends EVERY generic
  // sign-in here, not just the first one, so a fully set-up artist signed in,
  // read "Set up your page →", and was handed the page editor again — for the
  // rest of the account's life, with no route to the app on the screen at all.
  // A fan's CTA has always pointed at WORKBENCH_PATH; this makes the creator
  // roles agree once they have nothing left to set up.
  //
  // Welcome.dc.html's single CTA points at the app (FanApp.dc.html), so this is
  // the design's own intent. The wizard destination below is the deliberate
  // divergence from it and is kept: verification has to come before payouts
  // (see ArtistOnboardingWizard), and that is worth one screen of detour.
  const setUpPath = onboardingPath ?? WORKBENCH_PATH;

  const CONFIG: Record<Role, {
    roleLabel: string; tint: string;
    sub: string; cta: string; ctaHref: string;
    steps: { title: string; desc: string }[];
  }> = {
    FAN: {
      roleLabel: t('welcomePage.roleFan', 'Fan'), tint: 'var(--role-fan)',
      sub: t('welcomePage.subFan', 'Your account is live. Start hyping the artists you believe in — your listens and hypes shape who gets discovered.'),
      // No fan setup wizard exists, and none is needed — a fan account is
      // complete at signup. Listening is the first thing to do.
      cta: t('welcomePage.ctaFan', 'Start listening →'), ctaHref: WORKBENCH_PATH,
      steps: [
        { title: t('welcomePage.fanStep1Title', 'Hype your first artist'), desc: t('welcomePage.fanStep1Desc', 'Listen to a track all the way through or tap the flame — every hype is a demand signal venues can see.') },
        { title: t('welcomePage.fanStep2Title', 'Follow your scene'), desc: t('welcomePage.fanStep2Desc', 'Pick your city and genres so Local shows and For You surface the right nights out.') },
        { title: t('welcomePage.fanStep3Title', 'Share a referral link'), desc: t('welcomePage.fanStep3Desc', 'Promote any show you love and earn from the dedicated 10% promoter pool.') },
      ],
    },
    ARTIST: {
      roleLabel: t('welcomePage.roleArtist', 'Artist'), tint: 'var(--accent)',
      sub: t('welcomePage.subArtist', 'Welcome to the platform where 70% of every ticket is yours — locked by charter, before a single ticket sells.'),
      cta: t('welcomePage.ctaArtist', 'Set up your page →'), ctaHref: setUpPath,
      steps: [
        { title: t('welcomePage.artistStep1Title', 'Complete verification'), desc: t('welcomePage.artistStep1Desc', 'Link your catalog and confirm identity — the 70% split activates the moment you’re verified.') },
        { title: t('welcomePage.artistStep2Title', 'Upload your first track'), desc: t('welcomePage.artistStep2Desc', 'Choose all-rights or free-use licensing per track; free-use tracks can be crated by DJs for radio shows.') },
        { title: t('welcomePage.artistStep3Title', 'Publish a show'), desc: t('welcomePage.artistStep3Desc', 'Set face-value pricing and lock your 70/20 charter. Fans buy direct — $0 platform fees.') },
      ],
    },
    VENUE: {
      roleLabel: t('welcomePage.roleVenue', 'Venue'), tint: 'var(--role-venue)',
      sub: t('welcomePage.subVenue', 'A guaranteed 20% of every gate, by charter — plus real demand data on who fans actually want to see.'),
      cta: t('welcomePage.ctaVenue', 'List your room →'), ctaHref: setUpPath,
      steps: [
        { title: t('welcomePage.venueStep1Title', 'Verify your room'), desc: t('welcomePage.venueStep1Desc', 'Confirm capacity and address so events can go live with serialized, QR-verified tickets.') },
        { title: t('welcomePage.venueStep2Title', 'Check the demand radar'), desc: t('welcomePage.venueStep2Desc', 'See which artists your city is hyping before you book — no promoter guesswork.') },
        { title: t('welcomePage.venueStep3Title', 'Publish your first event'), desc: t('welcomePage.venueStep3Desc', 'Your 20% is locked in the charter at publish. Settlement goes direct after the show.') },
      ],
    },
    DJ: {
      roleLabel: t('welcomePage.roleDj', 'DJ'), tint: 'var(--accent-2)',
      sub: t('welcomePage.subDj', 'Your studio is waiting. Build radio shows from the free-use library and get paid to promote the shows you play.'),
      cta: t('welcomePage.ctaDj', 'Open the studio →'), ctaHref: onboardingPath ?? '/radio',
      steps: [
        { title: t('welcomePage.djStep1Title', 'Crate some tracks'), desc: t('welcomePage.djStep1Desc', 'Browse the free-use library and add tracks to your crate — they’re licensed for your radio shows.') },
        { title: t('welcomePage.djStep2Title', 'Record your first show'), desc: t('welcomePage.djStep2Desc', 'Mix crated tracks with your voice and royalty-free SFX, right from your phone.') },
        { title: t('welcomePage.djStep3Title', 'Promote and earn'), desc: t('welcomePage.djStep3Desc', 'Share referral links for shows you play — you earn from the 10% promoter pool.') },
      ],
    },
  };

  const c = CONFIG[role];

  // The account's own name, not a mockup's. This block used to render one of
  // four hardcoded placeholders from Welcome.dc.html — 'Nyla', 'DJ Caro',
  // 'Port City Music Hall', 'Jess R.' — so every real signup was greeted by
  // somebody else's name and initial. session.user.name is the right source
  // rather than profile.name: registration stores the raw hexId as a fan
  // profile's name, while User.name holds their chosen username.
  const displayName =
    session.user.name?.trim()
    || session.user.email?.split('@')[0]
    || t('welcomePage.fallbackName', 'Your account');
  const initial = displayName.charAt(0).toUpperCase();

  // Was hardcoded to "Verification pending (~48h)" for all three creator roles
  // regardless of the real column, so a verified venue was still told it was
  // waiting. Fans are UNVERIFIED by design and are simply active.
  const status = profile?.verificationStatus;
  const pendingNote =
    status === 'PENDING'
      ? t('welcomePage.pendingVerification', ' · Verification pending (~48h)')
      : status === 'VERIFIED'
        ? t('welcomePage.pendingVerified', ' · Verified')
        : status === 'REJECTED'
          ? t('welcomePage.pendingNeedsAttention', ' · Verification needs attention')
          : t('welcomePage.pendingActiveNow', ' · Active now');

  return (
    <div className="welcome-body">
      <div className="welcome-card">
        <div className="welcome-check">✓</div>
        <h1 className="welcome-h1">{t('welcomePage.heading', "You're in.")}</h1>
        <p className="welcome-sub">{c.sub}</p>

        <div className="welcome-panel">
          <div className="welcome-identity">
            <div className="welcome-avatar" style={{ background: `linear-gradient(135deg, ${c.tint}, var(--role-fan))` }}>{initial}</div>
            <div>
              <div className="welcome-name">{displayName}</div>
              <div className="welcome-role" style={{ color: c.tint }}>{c.roleLabel}{pendingNote}</div>
            </div>
          </div>
          <WelcomeStepsChecklist steps={c.steps} tint={c.tint} />
        </div>

        <Link className="welcome-cta" href={c.ctaHref}>{c.cta}</Link>
        <div className="welcome-split">{t('welcomePage.splitFooter', '70% artist · 20% venue · 10% promoters · 0% iHYPE')}</div>
      </div>

      <style>{`
        .welcome-body { background: var(--bg); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .welcome-card { max-width: 560px; width: 100%; text-align: center; }
        .welcome-check { width: 64px; height: 64px; border-radius: 50%; background: rgba(var(--role-venue-rgb),.12); border: 1px solid rgba(var(--role-venue-rgb),.35); display: flex; align-items: center; justify-content: center; margin: 0 auto 22px; font-size: 26px; color: var(--role-venue); }
        .welcome-h1 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: clamp(32px, 7vw, 48px); letter-spacing: -.04em; line-height: 1; color: var(--ink); }
        .welcome-sub { font-size: 16px; color: var(--ink-a70); line-height: 1.65; margin: 14px 0 36px; }
        .welcome-panel { text-align: left; background: var(--bg2); border: 1px solid var(--line); border-radius: 18px; padding: 26px 26px 18px; }
        .welcome-identity { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
        .welcome-avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; }
        .welcome-name { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 16px; color: var(--ink); }
        .welcome-role { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; margin-top: 2px; }
        .welcome-steps-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .welcome-steps-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-a55); }
        .welcome-ring { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .welcome-ring span { width: 24px; height: 24px; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 8.5px; color: var(--ink-a70); }
        .welcome-steps { display: flex; flex-direction: column; }
        .welcome-step { display: flex; gap: 14px; align-items: flex-start; padding: 11px 0; width: 100%; background: none; border: none; cursor: pointer; text-align: left; font: inherit; }
        .welcome-step-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px; background: rgba(var(--accent-rgb),.12); color: var(--accent); font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; }
        .welcome-step.done .welcome-step-num { background: rgba(var(--role-venue-rgb),.15); color: var(--role-venue); }
        .welcome-step-title { font-weight: 700; font-size: 14px; color: var(--ink); }
        .welcome-step.done .welcome-step-title { color: var(--ink-a70); text-decoration: line-through; }
        .welcome-step-desc { font-size: 13px; color: var(--ink-a70); line-height: 1.55; margin-top: 2px; }
        .welcome-cta { display: inline-block; margin-top: 28px; font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 15px; background: var(--accent); color: var(--ink-on-accent); padding: 14px 34px; border-radius: 999px; box-shadow: 0 6px 24px rgba(var(--accent-rgb),.35); text-decoration: none; transition: opacity 150ms; }
        .welcome-cta:hover { opacity: .9; }
        .welcome-split { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 10px; color: var(--ink-a55); margin-top: 16px; letter-spacing: .06em; }
      `}</style>
    </div>
  );
}
