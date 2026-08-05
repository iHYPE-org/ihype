import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/app/mmm.css';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { MmmShell, type MmmNowPlaying } from '@/components/mmm/MmmShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'iHYPE',
  description: 'Map, music, and your own signal — one screen.',
  robots: { index: false, follow: false },
};

/**
 * The Music · Map · Me shell, mounted as a LAYOUT.
 *
 * That placement is the contract, not a convenience: the map is the base layer
 * and must survive navigation between modules so returning to MAP keeps your pan
 * and zoom, and a layout is the only place the App Router guarantees a subtree
 * is preserved. Moving this into a page re-mounts the map on every module
 * change. Same reasoning as `AppShell` living in the root layout.
 */
export default async function MmmLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/map');

  // The player's "now playing" is seeded from the viewer's most recent listen so
  // the chrome opens with something real in it rather than a placeholder track.
  // No listen history yet → no player, rather than an invented one.
  const listen = await db.mediaListen
    .findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      // MediaListen denormalizes the title and artist onto the row itself, so
      // this needs no join.
      select: { title: true, artistName: true },
    })
    .catch(() => null);

  const nowPlaying: MmmNowPlaying = listen
    ? {
        title: listen.title,
        artist: listen.artistName,
        initial: (listen.artistName || listen.title).charAt(0).toUpperCase(),
      }
    : null;

  return <MmmShell nowPlaying={nowPlaying}>{children}</MmmShell>;
}
