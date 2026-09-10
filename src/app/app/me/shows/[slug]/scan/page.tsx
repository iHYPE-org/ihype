import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canWorkTheDoor } from '@/lib/door-access';
import { DoorScanner } from '@/components/door/DoorScanner';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const show = await db.show.findUnique({ where: { slug }, select: { title: true } });
  return {
    title: show ? `Door · ${show.title} · iHYPE` : 'Door · iHYPE',
    robots: { index: false, follow: false },
  };
}

/**
 * The door. A server component on purpose: the show's identity is rendered
 * INTO the HTML, and the service worker stores that HTML (with its scripts)
 * when the organiser downloads the guest list — so the page opens with no
 * signal and already knows which show it is. The scanner itself is the client
 * component below; the camera, the manifest and the sync queue all live there.
 *
 * Same gate as the scan and manifest routes, read from one module: the venue's
 * owner, the headliner's owner, the creator, an admin. Anyone else sees a 404,
 * not a 403 — the URL names a show, and a stranger learns nothing from it.
 */
export default async function DoorPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/app/me/shows/${slug}/scan`);
  }

  const show = await db.show.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, startsAt: true, creatorId: true, status: true,
      venueProfile: { select: { ownerId: true, name: true } },
      headlinerProfile: { select: { ownerId: true, name: true } },
    },
  });
  if (!show || !canWorkTheDoor(session, show)) return notFound();

  return (
    <DoorScanner
      show={{
        id: show.id,
        slug: show.slug,
        title: show.title,
        startsAt: show.startsAt.toISOString(),
        venueName: show.venueProfile?.name ?? null,
        headlinerName: show.headlinerProfile?.name ?? null,
      }}
    />
  );
}
