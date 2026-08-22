/**
 * The Music · Map · Me navigation manifest, and the station sets the dock's
 * tuner tunes.
 *
 * Source: `design/handoff-console-2026-08-21/README.md` ("The navigation
 * model") and `templates/console-shell/`. The whole of the app's navigation is
 * one walnut dock at the bottom of every screen: a `RotaryNav` knob stepping
 * MAP · MUSIC · ME, a `TunerDial` tuning the sections of whatever you are
 * looking at, and a `JoystickTransport` for playback.
 *
 * **The radial arc is retired** (2026-08-22, owner decision: "I don't want any
 * previous design … Bottom hifi nav system is the only thing I want"). The arc
 * tables, `arcTransform`, `arcSlotsFor`, `ARC_NARROW_MAX_WIDTH` and `navHint`
 * went with it — they described a fan of discs opening from a logo trigger that
 * no longer exists. Do not restore them: two ways to switch module is the thing
 * the dock replaces, and the knob reports the module itself, so the hint chip
 * has nothing left to say.
 *
 * Two rules from the handoff shape what is here:
 *
 *   1. **One dial per screen, and it is the dock's.** A page must not render a
 *      selector of its own beside it — "an in-page tab strip alongside it puts
 *      two identical-looking dials on screen meaning different things". A page
 *      with its own section set hands it to the dock through
 *      `MmmStationsProvider` instead.
 *   2. **Module, tab and panel are ROUTES, not state.** Every station carries
 *      an href, so the dial is navigation and Back walks it.
 *
 * Pure and dependency-light (no `@/lib/db`, no `next/*`): imported by client
 * components and by tests.
 */

export const MMM_BASE = '/app';

export const MMM_MODULES = ['map', 'music', 'me'] as const;
export type MmmModuleId = (typeof MMM_MODULES)[number];

export type MmmNavItem = { id: string; label: string; href: string };

export type MmmModule = {
  id: MmmModuleId;
  /** Level-1 pill label — Bricolage Grotesque 800, 19px, as drawn. */
  label: string;
  href: string;
  /** Level-2 fan-out items. Empty means the pill navigates directly. */
  items: MmmNavItem[];
};

export const MMM_NAV: readonly MmmModule[] = [
  { id: 'map', label: 'MAP', href: `${MMM_BASE}/map`, items: [] },
  {
    id: 'music',
    label: 'MUSIC',
    href: `${MMM_BASE}/music/discover`,
    items: [
      { id: 'discover', label: 'Discover', href: `${MMM_BASE}/music/discover` },
      { id: 'radio', label: 'Radio', href: `${MMM_BASE}/music/radio` },
      { id: 'charts', label: 'Charts', href: `${MMM_BASE}/music/charts` },
      { id: 'recommended', label: 'Recommended', href: `${MMM_BASE}/music/recommended` },
      { id: 'playlists', label: 'Playlists', href: `${MMM_BASE}/music/playlists` },
    ],
  },
  // No submenu, by design — see the header note.
  { id: 'me', label: 'ME', href: `${MMM_BASE}/me`, items: [] },
];

export const MMM_MUSIC_TABS = MMM_NAV.find((module) => module.id === 'music')!.items;

/**
 * The ME surface's in-page rows. These are panels within `/app/me`, not
 * fan-out destinations — the redesign moved them off the radial nav.
 */
export const MMM_ME_PANELS: ReadonlyArray<MmmNavItem & { detail: string }> = [
  { id: 'info', label: 'Info', detail: 'How iHYPE works · legal', href: `${MMM_BASE}/me/info` },
  { id: 'settings', label: 'Settings', detail: 'Account · notifications · accessibility', href: `${MMM_BASE}/me/settings` },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Route resolution
 * ──────────────────────────────────────────────────────────────────────────── */

export function isMmmRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === MMM_BASE || pathname.startsWith(`${MMM_BASE}/`);
}

/**
 * Detail surfaces inside the shell — a show, and whatever follows it.
 *
 * They are NOT modules: the arc carries three and only three, and a show is
 * something you reach FROM the map rather than a fourth destination. But they
 * must render as a pane, and `moduleForPath` answers `map` for anything it does
 * not recognise, which is what makes the shell hide its children. Without this
 * predicate a `/app/shows/<slug>` route mounts and renders nothing at all.
 *
 * Kept as a prefix list rather than a regex so adding one is a one-line change
 * that reads as a list of surfaces.
 *
 * **Adding a route under `/app/` and forgetting this list is the single
 * easiest way to ship a page that renders nothing**, and it has happened: the
 * artist, venue, track and playlist panes were all built, reviewed and merged
 * while every one of them rendered a blank shell, because they were missing
 * here. Nothing failed — the route returns 200, the frame paints, and only the
 * content is absent. `mmm-nav.test.ts` now derives the expected list from the
 * route directories on disk so it cannot drift again.
 */
const MMM_DETAIL_PREFIXES = [
  `${MMM_BASE}/shows/`,
  `${MMM_BASE}/artists/`,
  `${MMM_BASE}/fans/`,
  `${MMM_BASE}/venues/`,
  `${MMM_BASE}/tracks/`,
  `${MMM_BASE}/playlists/`,
] as const;

export function isMmmDetailPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return MMM_DETAIL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function moduleForPath(pathname: string): MmmModuleId {
  if (pathname.startsWith(`${MMM_BASE}/music`)) return 'music';
  if (pathname.startsWith(`${MMM_BASE}/me`)) return 'me';
  return 'map';
}

/** The active MUSIC tab id, or null outside MUSIC. */
export function itemForPath(pathname: string): string | null {
  const module = MMM_NAV.find((entry) => entry.id === moduleForPath(pathname));
  if (!module || module.items.length === 0) return null;
  const match = [...module.items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.id ?? null;
}

/** The active ME panel id, or null when the ME surface is at its root. */
export function panelForPath(pathname: string): string | null {
  if (moduleForPath(pathname) !== 'me') return null;
  if (pathname === `${MMM_BASE}/me/accessibility`) return 'settings';
  if (pathname === `${MMM_BASE}/me/legal`) return 'info';
  const match = [...MMM_ME_PANELS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((panel) => pathname === panel.href || pathname.startsWith(`${panel.href}/`));
  return match?.id ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The dock's stations
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * MAP's stations are the map's LAYERS, not its dates.
 *
 * The console template gives MAP four date stations (Tonight · This Week ·
 * Weekend · All Dates) and they are not adoptable here: the shipped date strip
 * is a multi-select day picker — a member can pick Thursday and Saturday — and
 * a dial names exactly one station at a time, so wiring the dial to dates would
 * quietly delete a working filter. The layer is the set that really behaves
 * like a section: three values, mutually exclusive, already a URL parameter
 * (`?layer=`), and already authoritative over the map's own state. So the dial
 * takes the layer, the date strip stays where it is, and nothing is lost.
 */
export const MMM_MAP_LAYERS: readonly MmmNavItem[] = [
  { id: 'events', label: 'Events', href: `${MMM_BASE}/map?layer=events` },
  { id: 'venues', label: 'Venues', href: `${MMM_BASE}/map?layer=venues` },
  { id: 'artists', label: 'Artists', href: `${MMM_BASE}/map?layer=artists` },
];

/**
 * What the dock's dial tunes on this route, and which station is lit.
 *
 * `active` is resolved here rather than in the component because the answer is
 * not always in the path: a module's own root (`/app/music` with no tab) is the
 * FIRST station, not "no station", and the vendored `TunerDial` warns and falls
 * back to index 0 when handed an `active` naming nothing — a confident, wrong
 * readout. Resolving it once, in a tested pure function, is what keeps the
 * needle on a real station.
 */
export function stationsForPath(
  pathname: string,
  search?: { layer?: string | null },
): { stations: readonly MmmNavItem[]; active: string } {
  const module = moduleForPath(pathname);

  if (module === 'map') {
    const requested = search?.layer ?? null;
    const active = MMM_MAP_LAYERS.find((layer) => layer.id === requested)?.id ?? MMM_MAP_LAYERS[0].id;
    return { stations: MMM_MAP_LAYERS, active };
  }

  const stations: readonly MmmNavItem[] = module === 'music' ? MMM_MUSIC_TABS : MMM_ME_PANELS;
  const found = itemForPath(pathname) ?? panelForPath(pathname);
  const active = stations.find((station) => station.id === found)?.id ?? stations[0].id;
  return { stations, active };
}
