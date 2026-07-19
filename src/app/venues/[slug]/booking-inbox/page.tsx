import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { VenueBookingInboxTabs } from '@/components/VenueBookingInboxTabs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `Booking Inbox · ${profile.name} · iHYPE` : 'Booking Inbox · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function VenueBookingInboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/venues/${slug}/booking-inbox`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true, type: true },
  });
  if (!profile || profile.type !== 'VENUE') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  return (
    <div className="vbip-page">
      <div className="vbip-header">
        <h1>Booking Inbox</h1>
        <Link className="vbip-back" href={`/venues/${profile.slug}/dashboard`}>← Dashboard</Link>
      </div>
      <VenueBookingInboxTabs profileId={profile.id} />

      <style>{`
        .vbip-page { max-width: 720px; margin: 0 auto; padding: 32px 24px 100px; }
        .vbip-header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .vbip-header h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .vbip-back { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-a60); text-decoration: none; }
        .vbip-back:hover { color: var(--ink); text-decoration: underline; }
      `}</style>
    </div>
  );
}
