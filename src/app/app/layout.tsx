import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/app/mmm.css';
import { auth } from '@/lib/auth';
import { MmmShell } from '@/components/mmm/MmmShell';
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
 * THERE IS NO DOCK (2026-09-22, owner: "The chrome button bottom nav is no
 * longer the direction we're going … remove those components to save space").
 * This shell's navigation is the SITE HEADER the root layout mounts on every
 * page — `AdaptiveSiteHeader.tsx` draws the four destinations as text links
 * and `MmmShell` no longer hides it — and its only chrome is the now-playing
 * pill `MmmShell` renders while a track is loaded. Do not mount a navigation
 * here: the header is it, and this layout would be putting a second one on
 * screen. (The console dock, the middle road's tab bar and the handoff's own
 * `ConsoleDock.tsx` each stood here in turn; every one is gone, and
 * `guard:design` asserts the files stay gone.)
 *
 * THIS LAYOUT AWAITS THE SESSION AND NOTHING ELSE (2026-09-23, DESIGN_SYNC
 * row 509; owner: "There's a bit of a lag in between selection of new menus
 * and displaying them"). Until then it also resolved a "now playing" for the
 * shell — the viewer's most recent listen, then that artist's profile, then
 * the viewer's hype on it: three DEPENDENT database round-trips, paid before
 * any pane could stream, on every cold load of the shell. And the surface
 * they fed was unreachable: the pill draws `currentTrack` only (a last listen
 * has no url, so a play key under it would start a different song), and the
 * full player opens only from the pill — so the "last listen" fallback in the
 * player and the hype seeded from it could never be on screen. Row 503 keyed
 * the player's HYPE on the PLAYING track through `GET /api/hype?slug=` for
 * exactly that reason, which left this resolution feeding nothing. Deleted
 * rather than moved to the client: a client fetch for a surface nobody can
 * reach is the same defect one hop later. A resume-last-listen affordance
 * needs an endpoint that carries a playable url, not this.
 */
export default async function MmmLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/map');

  /**
   * The ADMIN MODE affordance is resolved HERE, from the session, and never
   * from anything the client can set. It is visibility only — `/admin` keeps
   * its own gate (session, role, and the device-cookie check), exactly like
   * every other role-gated destination in this codebase.
   */
  return <MmmShell isAdmin={isAdminSession(session)}>{children}</MmmShell>;
}
