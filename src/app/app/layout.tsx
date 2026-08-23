import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/app/mmm.css';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canHype } from '@/lib/hype-window';
import { MmmShell, type MmmNowPlaying } from '@/components/mmm/MmmShell';
import { isAdminSession } from '@/lib/permissions';

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
 * change.
 *
 * The hi-fi console dock is rendered INSIDE `MmmShell` (`MmmDock`: RotaryNav ·
 * TunerDial · JoystickTransport) and is the whole of this shell's navigation.
 * Do not mount a second dock here. The console handoff's `ConsoleDock.tsx`
 * (IMPLEMENT.md step 2) briefly stood beside it as a sibling and was retired
 * at the 2026-08-23 merge: it was a second, thinner implementation of the same
 * hardware — hardcoded section ring, no registered stations, an unwired
 * transport — which is the TunerDial failure mode the vendoring row in
 * CLAUDE.md exists to prevent. The handoff's token skin (mmm-console.css)
 * stays; its dock component does not.
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
      // the track copy needs no join. The artist's PROFILE does need one: the
      // row carries a slug, and /api/hype takes a profile id.
      select: { title: true, artistName: true, artistProfileSlug: true },
    })
    .catch(() => null);

  // Resolve the artist's profile so the player's heart can write through to the
  // same endpoint an artist page uses. Everything the hype route itself refuses
  // is resolved HERE instead of on click: a non-discoverable profile (404) and
  // the viewer's own profile (409) both yield a null id, which renders the
  // heart as absent rather than as a control that always fails. Independently
  // .catch()'d — a failed lookup costs the heart, never the player.
  const artistProfile = listen?.artistProfileSlug
    ? await db.profile
        .findFirst({
          where: { slug: listen.artistProfileSlug, discoverable: true },
          select: { id: true, ownerId: true },
        })
        .catch(() => null)
    : null;
  const hypeableProfileId =
    artistProfile && artistProfile.ownerId !== session.user.id ? artistProfile.id : null;

  // Whether the viewer has hyped this artist inside the current 24h window, so
  // the heart opens filled instead of resetting to empty on every navigation —
  // and empties again once the window has passed and the hype is spendable.
  const existingHype = hypeableProfileId
    ? await db.profileHypeEvent
        .findUnique({
          where: { userId_profileId: { userId: session.user.id, profileId: hypeableProfileId } },
          select: { createdAt: true },
        })
        .catch(() => null)
    : null;

  const nowPlaying: MmmNowPlaying = listen
    ? {
        title: listen.title,
        artist: listen.artistName,
        initial: (listen.artistName || listen.title).charAt(0).toUpperCase(),
        artistProfileId: hypeableProfileId,
        // Already selected above and simply never passed through, which is why
        // the player's artist name had no destination to point at.
        artistSlug: listen.artistProfileSlug ?? null,
        hyped: !canHype(existingHype?.createdAt),
      }
    : null;

  /**
   * The ADMIN MODE affordance is resolved HERE, from the session, and never
   * from anything the client can set. It is visibility only — `/admin` keeps
   * its own gate (session, role, and the device-cookie check), exactly like
   * every other role-gated destination in this codebase.
   */
  return (
    <MmmShell isAdmin={isAdminSession(session)} nowPlaying={nowPlaying}>
      {children}
    </MmmShell>
  );
}
