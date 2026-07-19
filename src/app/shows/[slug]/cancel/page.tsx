import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { EventCancellationFlow } from '@/components/EventCancellationFlow';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const show = await db.show.findUnique({ where: { slug }, select: { title: true } });
  return {
    title: show ? `Cancel · ${show.title} · iHYPE` : 'Cancel Event · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function CancelEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/shows/${slug}/cancel`);
  }

  const show = await db.show.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, status: true, startsAt: true, ticketsSoldCount: true, creatorId: true,
      venueProfile: { select: { slug: true, name: true, ownerId: true } },
      headlinerProfile: { select: { slug: true, ownerId: true, type: true } },
    },
  });
  if (!show) return notFound();

  const isVenueOwner = canManageOwnedResource(session, show.venueProfile?.ownerId);
  const isHeadlinerOwner = canManageOwnedResource(session, show.headlinerProfile?.ownerId);
  const isCreator = session.user.id === show.creatorId;
  if (!isVenueOwner && !isHeadlinerOwner && !isCreator) return notFound();

  if (!['DRAFT', 'SCHEDULED'].includes(show.status)) {
    return notFound();
  }

  const dashboardHref = isVenueOwner && show.venueProfile
    ? `/venues/${show.venueProfile.slug}/dashboard`
    : isHeadlinerOwner && show.headlinerProfile
      ? show.headlinerProfile.type === 'DJ'
        ? `/promoters/${show.headlinerProfile.slug}/dashboard`
        : `/artists/${show.headlinerProfile.slug}/dashboard`
      : `/shows/${show.slug}`;

  return (
    <EventCancellationFlow
      dashboardHref={dashboardHref}
      showId={show.id}
      showSlug={show.slug}
      showTitle={show.title}
      startsAtLabel={show.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      ticketsSoldCount={show.ticketsSoldCount}
      venueName={show.venueProfile?.name ?? null}
    />
  );
}
