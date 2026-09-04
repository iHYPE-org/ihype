/**
 * The Music · Map · Me navigation manifest, and the section sets each surface
 * renders for itself.
 *
 * Source: `design/handoff-console-2026-08-21/README.md` ("The navigation
 * model"), as amended by the MIDDLE ROAD (2026-09-04, owner: "let's do it —
 * build and implement the middle ground").
 *
 * ## What the middle road changed here, and what it did not
 *
 * The dock's HARDWARE is retired. A `RotaryNav` knob stepping the modules and
 * a `TunerDial` tuning the sections of the current screen are both gone; the
 * cabinet survives as a walnut TAB BAR carrying four labelled destinations, and
 * a screen with its own sections draws its own strip. See `MmmDock.tsx`.
 *
 * **The rule this reverses was load-bearing and its reasoning is worth keeping,
 * because it was right about the thing it was solving.** The handoff said "one
 * dial per screen, and it is the dock's" — an in-page tab strip alongside the
 * dock's dial "puts two identical-looking dials on screen meaning different
 * things", which really did ship (a profile drew its own dial ten pixels above
 * the dock's). That hazard is a consequence of the dial EXISTING. With no dial
 * in the chrome there is no second control to collide with, so a page drawing
 * its own strip is now the correct answer rather than the forbidden one. Do not
 * re-derive the old rule from the old reasoning: check whether the chrome still
 * carries a section control first. It does not.
 *
 * **The radial arc stays retired** (2026-08-22). The arc tables, `arcTransform`,
 * `arcSlotsFor`, `ARC_NARROW_MAX_WIDTH` and `navHint` are gone and are not
 * coming back — two ways to switch module is exactly what a single bar
 * replaces, whether the bar is knurled or labelled.
 *
 * The one rule that survives untouched:
 *
 *   **Module, tab and panel are ROUTES, not state.** Every destination carries
 *   an href, so navigation is navigation and Back walks it.
 *
 * Pure and dependency-light (no `@/lib/db`, no `next/*`): imported by client
 * components and by tests.
 */

export const MMM_BASE = '/app';

/* The tab bar's four destinations, in the order it draws them. TICKETS is new
   with the middle road: the dock used to carry three controls and no room for a
   fourth destination, so the door credential lived as a section inside ME, two
   taps and a drag away from a fan standing at a door. A labelled bar has room,
   and this is the surface with the least tolerance for being hard to find. */
export const MMM_MODULES = ['music', 'map', 'tickets', 'me'] as const;
export type MmmModuleId = (typeof MMM_MODULES)[number];

export type MmmNavItem = { id: string; label: string; href: string };

export type MmmModule = {
  id: MmmModuleId;
  /** The historic all-caps module name. Still what analytics and the tests
   *  identify a module by; not what the bar draws. */
  label: string;
  /** What the tab bar engraves under the glyph, in tracked mono.
   *
   *  MUSIC is labelled **Listen**, and the difference is a product statement
   *  rather than a synonym: "Music" names a category the app contains, "Listen"
   *  names the thing a member came to do. It is also the one tab whose job is
   *  not obvious from its glyph. */
  tabLabel: string;
  href: string;
  /** Level-2 fan-out items. Empty means the pill navigates directly. */
  items: MmmNavItem[];
};

export const MMM_NAV: readonly MmmModule[] = [
  {
    id: 'music',
    label: 'MUSIC',
    tabLabel: 'Listen',
    href: `${MMM_BASE}/music/discover`,
    items: [
      { id: 'discover', label: 'Discover', href: `${MMM_BASE}/music/discover` },
      { id: 'radio', label: 'Radio', href: `${MMM_BASE}/music/radio` },
      { id: 'charts', label: 'Charts', href: `${MMM_BASE}/music/charts` },
      { id: 'recommended', label: 'Recommended', href: `${MMM_BASE}/music/recommended` },
      { id: 'playlists', label: 'Playlists', href: `${MMM_BASE}/music/playlists` },
      /* There were SIX stations here. Library was retired 2026-08-25 ("Remove
         library as it's already contained in playlists") and its whole content
         — liked tracks, liked artists, liked venues — moved into Playlists
         rather than going with it. Do not re-add a station for likes: the
         surface exists, one tab to the left. */
    ],
  },
  { id: 'map', label: 'MAP', tabLabel: 'Map', href: `${MMM_BASE}/map`, items: [] },
  { id: 'tickets', label: 'TICKETS', tabLabel: 'Tickets', href: `${MMM_BASE}/tickets`, items: [] },
  // No submenu, by design — see the header note.
  { id: 'me', label: 'ME', tabLabel: 'Me', href: `${MMM_BASE}/me`, items: [] },
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
  /* Before `${MMM_BASE}/me`, and the order is the whole of it: the ticket LIST
     is `/app/tickets` and a single ticket is still `/app/me/tickets/<id>`, so a
     prefix test on `/app/me` first would answer 'me' for the list too if the
     paths ever converge. Tested in both directions. */
  if (pathname === `${MMM_BASE}/tickets` || pathname.startsWith(`${MMM_BASE}/tickets/`)) return 'tickets';
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
 * The section set a surface draws for itself, and which one is lit.
 *
 * This used to answer "what does the dock's dial tune here"; with the dial
 * retired it answers the same question for the page's own strip, which is why
 * it survived the middle road unchanged in behaviour.
 *
 * `active` is resolved here rather than in the component because the answer is
 * not always in the path: a module's own root (`/app/music` with no tab) is the
 * FIRST section, not "no section", and a strip handed an `active` naming
 * nothing lights nothing — a control that looks broken on the one route people
 * arrive at by typing. Resolving it once, in a tested pure function, is what
 * keeps exactly one pill lit.
 *
 * TICKETS has no sections and returns an EMPTY set with an empty `active`
 * rather than falling through to another module's list. The old version had no
 * branch for it because there was no such module; without one it would have
 * handed the ticket list ME's panels, and a strip reading "Info · Settings"
 * above a wallet is the kind of wrong that looks deliberate.
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

  if (module === 'tickets') return { stations: [], active: '' };

  const stations: readonly MmmNavItem[] = module === 'music' ? MMM_MUSIC_TABS : MMM_ME_PANELS;
  const found = itemForPath(pathname) ?? panelForPath(pathname);
  const active = stations.find((station) => station.id === found)?.id ?? stations[0].id;
  return { stations, active };
}
