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

// ADMIN is here because an administrator signing in lands on /welcome like
// anyone else, and this union is what picks the label and the call to action.
// Without it the fall-through below resolved ADMIN to FAN, so the operator of
// the platform was greeted as a fan and pointed at "start hyping artists".
type Role = 'FAN' | 'ARTIST' | 'VENUE' | 'ADMIN';

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
  // the type -> URL-prefix mapping (ARTIST -> /artists,
  // VENUE -> /venues), so there is no second copy of it here to drift.
  const profileRole: Role | null =
    profile?.type === 'ARTIST' || profile?.type === 'VENUE'
      ? profile.type
      : profile
        ? 'FAN'
        : null;
  const sessionRole = (session.user as { role?: string }).role;
  // ADMIN is checked BEFORE the profile, unlike every other role: an operator
  // may also own an artist or venue page, and being greeted as that page's
  // owner would hide the console they actually signed in to reach.
  const role: Role =
    sessionRole === 'ADMIN'
      ? 'ADMIN'
      : profileRole
        ?? (sessionRole === 'ARTIST' || sessionRole === 'VENUE' ? sessionRole : 'FAN');

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
    // No wizard and no profile: an administrator's next steps are the queues
    // that are already waiting, so every step here points at a real console
    // route rather than a setup task that does not exist for this role.
    ADMIN: {
      roleLabel: t('welcomePage.roleAdmin', 'Admin'), tint: 'var(--accent)',
      sub: t('welcomePage.subAdmin', 'You are signed in as a platform administrator. The console shows every queue waiting on a human, ordered by what is overdue.'),
      // Lands on the map like every other member. An administrator is a member
      // with a capability, not a different product, and the console is one tap
      // away from the ADMIN MODE control the shell carries. This used to point
      // at `/admin`, which — combined with the magic-link handler's own ADMIN
      // branch — is how the platform owner ended up on a device-registration
      // lockout screen instead of ever seeing the app.
      cta: t('welcomePage.ctaAdmin', 'Open iHYPE →'), ctaHref: WORKBENCH_PATH,
      steps: [
        { title: t('welcomePage.adminStep1Title', 'Register this device'), desc: t('welcomePage.adminStep1Desc', 'The console requires a registered device in addition to your passkey. Without one, /admin redirects here.') },
        { title: t('welcomePage.adminStep2Title', 'Work the queues'), desc: t('welcomePage.adminStep2Desc', 'Verifications, held tracks, moderation and ad approvals each carry the turnaround the product promises applicants.') },
        { title: t('welcomePage.adminStep3Title', 'Check launch readiness'), desc: t('welcomePage.adminStep3Desc', 'System status reports the runtime configuration and anything blocking launch.') },
      ],
    },
    ARTIST: {
      roleLabel: t('welcomePage.roleArtist', 'Artist'), tint: 'var(--accent)',
      sub: t('welcomePage.subArtist', 'Welcome to the platform where 70% of every ticket is yours — locked by charter, before a single ticket sells.'),
      cta: t('welcomePage.ctaArtist', 'Set up your page →'), ctaHref: onboardingPath ?? '/pages',
      steps: [
        { title: t('welcomePage.artistStep1Title', 'Complete verification'), desc: t('welcomePage.artistStep1Desc', 'Link your catalog and confirm identity — the 70% split activates the moment you’re verified.') },
        { title: t('welcomePage.artistStep2Title', 'Upload your first track'), desc: t('welcomePage.artistStep2Desc', 'Choose all-rights or free-use licensing per track; free-use tracks can air on the station.') },
        { title: t('welcomePage.artistStep3Title', 'Publish a show'), desc: t('welcomePage.artistStep3Desc', 'Set face-value pricing and lock your 70/20 charter. Fans buy direct — $0 platform fees.') },
      ],
    },
    VENUE: {
      roleLabel: t('welcomePage.roleVenue', 'Venue'), tint: 'var(--role-venue)',
      sub: t('welcomePage.subVenue', 'A guaranteed 20% of every gate, by charter — plus real demand data on who fans actually want to see.'),
      cta: t('welcomePage.ctaVenue', 'List your room →'), ctaHref: onboardingPath ?? '/pages',
      steps: [
        { title: t('welcomePage.venueStep1Title', 'Verify your room'), desc: t('welcomePage.venueStep1Desc', 'Confirm capacity and address so events can go live with serialized, QR-verified tickets.') },
        { title: t('welcomePage.venueStep2Title', 'Check the demand radar'), desc: t('welcomePage.venueStep2Desc', 'See which artists your city is hyping before you book — no promoter guesswork.') },
        { title: t('welcomePage.venueStep3Title', 'Publish your first event'), desc: t('welcomePage.venueStep3Desc', 'Your 20% is locked in the charter at publish. Settlement goes direct after the show.') },
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
        /* Welcome is a full-screen interstitial and owns the viewport — the
           DS8 template (templates/welcome/Welcome.dc.html) is a bare centred
           column with no header, no nav and no player dock. The root layout
           renders all three on every route, so this page was drawing its
           100vh card UNDER the marketing header and OVER the player dock:
           a search field and a "Nothing playing" bar framing the moment an
           account is created.

           Hidden with :has() rather than a prop, matching how the shell does
           the same job (body:has(.site-dock) in shell.css) — the rule lives
           with the page that needs it and costs no JS. */
        body:has(.welcome-body) .adaptive-site-header,
        body:has(.welcome-body) .site-dock,
        body:has(.welcome-body) .site-tabbar { display: none; }

        .welcome-body { background: var(--bg); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .welcome-card { max-width: 560px; width: 100%; text-align: center; }
        .welcome-check { width: 64px; height: 64px; border-radius: 50%; background: rgba(var(--role-venue-rgb),.12); border: 1px solid rgba(var(--role-venue-rgb),.35); display: flex; align-items: center; justify-content: center; margin: 0 auto 22px; font-size: 1.625rem; color: var(--role-venue); }
        .welcome-h1 { font-family: var(--f-d, 'Bricolage Grotesque', sans-serif); font-weight: 800; font-size: clamp(32px, 7vw, 48px); letter-spacing: -.04em; line-height: 1; color: var(--ink); }
        .welcome-sub { font-size: 1rem; color: var(--ink-a70); line-height: 1.65; margin: 14px 0 36px; }
        .welcome-panel { text-align: left; background: var(--bg2); border: 1px solid var(--line); border-radius: 18px; padding: 26px 26px 18px; }
        .welcome-identity { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
        .welcome-avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--ink-on-accent); font-family: var(--f-d); font-weight: 800; }
        .welcome-name { font-family: var(--f-d, 'Bricolage Grotesque', sans-serif); font-weight: 800; font-size: 1rem; color: var(--ink); }
        .welcome-role { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 0.7813rem; letter-spacing: .12em; text-transform: uppercase; margin-top: 2px; }
        .welcome-steps-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .welcome-steps-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 0.625rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-a65); }
        .welcome-ring { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .welcome-ring span { width: 24px; height: 24px; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 0.7813rem; color: var(--ink-a70); }
        .welcome-steps { display: flex; flex-direction: column; }
        .welcome-step { display: flex; gap: 14px; align-items: flex-start; padding: 11px 0; width: 100%; background: none; border: none; cursor: pointer; text-align: left; font: inherit; }
        .welcome-step-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px; background: rgba(var(--accent-rgb),.12); color: var(--accent-text); font-family: var(--f-d, 'Bricolage Grotesque', sans-serif); font-weight: 800; font-size: 0.7813rem; display: flex; align-items: center; justify-content: center; }
        .welcome-step.done .welcome-step-num { background: rgba(var(--role-venue-rgb),.15); color: var(--role-venue); }
        .welcome-step-title { font-weight: 700; font-size: 0.875rem; color: var(--ink); }
        .welcome-step.done .welcome-step-title { color: var(--ink-a70); text-decoration: line-through; }
        .welcome-step-desc { font-size: 0.8125rem; color: var(--ink-a70); line-height: 1.55; margin-top: 2px; }
        .welcome-cta { display: inline-block; margin-top: 28px; font-family: var(--f-d, 'Bricolage Grotesque', sans-serif); font-weight: 800; font-size: 0.9375rem; background: var(--accent); color: var(--ink-on-accent); padding: 14px 34px; border-radius: 999px; box-shadow: 0 6px 24px rgba(var(--accent-rgb),.35); text-decoration: none; transition: opacity 150ms; }
        .welcome-cta:hover { opacity: .9; }
        .welcome-split { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: 0.7813rem; color: var(--ink-a65); margin-top: 16px; letter-spacing: .06em; }
      `}</style>
    </div>
  );
}
