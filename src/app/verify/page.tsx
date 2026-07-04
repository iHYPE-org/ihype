import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Metadata } from 'next';
import { VerifyForm } from '@/components/VerifyForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verification · iHYPE',
  robots: { index: false, follow: false },
};

const TYPE_LABEL: Record<string, string> = { ARTIST: 'Artist', DJ: 'DJ', VENUE: 'Venue' };

const BADGE_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  ARTIST: { bg: 'rgba(255,80,41,.12)', border: 'rgba(255,80,41,.3)', text: '#ff5029' },
  DJ: { bg: 'rgba(185,131,255,.12)', border: 'rgba(185,131,255,.3)', text: '#b983ff' },
  VENUE: { bg: 'rgba(34,229,212,.12)', border: 'rgba(34,229,212,.3)', text: '#22e5d4' },
};

const NEXT_STEP: Record<string, { title: string; body: string; cta: string; href: string }> = {
  ARTIST: { title: 'Draft your artist page', body: "Add a bio, pin a track, and set your genres now — it goes live the moment you're verified.", cta: 'Start your page', href: '/pages?tab=creator' },
  DJ: { title: 'Build your crate', body: "Upload free-use tracks and set your regular show slot — ready to air the moment you're verified.", cta: 'Open your crate', href: '/pages?tab=creator' },
  VENUE: { title: 'Set up your room', body: 'Add capacity, amenities, and photos so promoters and artists can find you the moment you\'re verified.', cta: 'Set up your venue', href: '/pages?tab=creator' },
};

export default async function VerifyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/verify');

  const profiles = await db.profile.findMany({
    where: { ownerId: session.user.id, type: { in: ['ARTIST', 'DJ', 'VENUE'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, type: true, name: true, city: true, genres: true, contactInfo: true, verificationStatus: true, verificationSubmittedAt: true },
  });

  if (profiles.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 24px 100px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginBottom: 12 }}>Verification</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800, marginBottom: 12 }}>Nothing to verify yet.</h1>
        <p style={{ fontSize: 14, color: 'rgba(240,235,229,.6)', marginBottom: 24 }}>
          Fan accounts don&apos;t need verification. Create an Artist, DJ, or Venue page to get started.
        </p>
        <Link href="/pages?tab=creator" className="ihype-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Create a page →
        </Link>
      </div>
    );
  }

  const profile = profiles.find((p) => p.verificationStatus !== 'VERIFIED') ?? profiles[0];

  if (profile.verificationStatus === 'VERIFIED') {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 24px 100px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: 'rgba(34,229,212,.12)', border: '2px solid #22e5d4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800, marginBottom: 8 }}>You&apos;re verified.</h1>
        <p style={{ fontSize: 14, color: 'rgba(240,235,229,.6)' }}>{profile.name} is a verified {TYPE_LABEL[profile.type]} on iHYPE.</p>
      </div>
    );
  }

  if (profile.verificationStatus === 'PENDING' && profile.verificationSubmittedAt) {
    const badge = BADGE_COLOR[profile.type];
    const nextStep = NEXT_STEP[profile.type];
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 24px 100px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: 'rgba(34,229,212,.12)', border: '2px solid #22e5d4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800, marginBottom: 8 }}>Submitted.</h1>
        <p style={{ fontSize: 14, color: 'rgba(240,235,229,.6)', maxWidth: '34ch', margin: '0 auto 24px', lineHeight: 1.65 }}>
          We&apos;ll review your application within 48 hours and email you at the address on your account. While you wait, you can use iHYPE as a Fan.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 999,
            background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text,
            fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '.1em', fontWeight: 700, textTransform: 'uppercase',
          }}>
            Verified {TYPE_LABEL[profile.type]} · Pending
          </span>
        </div>
        <div style={{ textAlign: 'left', background: 'var(--bg-2, #0e0b08)', border: '1px solid var(--line, rgba(255,255,255,.08))', borderRadius: 18, padding: '1.5rem', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '.14em', textTransform: 'uppercase', color: badge.text, marginBottom: 8 }}>While you wait</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', marginBottom: 6 }}>{nextStep.title}</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-2, #9e9080)', lineHeight: 1.6, marginBottom: 14 }}>{nextStep.body}</p>
          <Link href={nextStep.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 700, color: badge.text, textDecoration: 'none' }}>
            {nextStep.cta} →
          </Link>
        </div>
        <Link href="/home" className="ihype-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Explore as a Fan →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 24px 100px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginBottom: 12 }}>Verification</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800, marginBottom: 8 }}>Verify your {TYPE_LABEL[profile.type]} page.</h1>
      <p style={{ fontSize: 14, color: 'rgba(240,235,229,.6)', marginBottom: 24, lineHeight: 1.6 }}>
        Fan accounts are instant. Artist, DJ, and Venue accounts require verification — it protects everyone in the 45/45/10 ecosystem.
      </p>
      <VerifyForm
        profileId={profile.id}
        type={profile.type as 'ARTIST' | 'DJ' | 'VENUE'}
        initialName={profile.name}
        initialCity={profile.city ?? ''}
        initialGenres={profile.genres.join(', ')}
        initialLink={profile.contactInfo ?? ''}
      />
    </div>
  );
}
