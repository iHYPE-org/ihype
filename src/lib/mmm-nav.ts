/**
 * The Music · Map · Me navigation manifest and radial-arc geometry.
 *
 * Source: `design/design-system-8/templates/simplified-app/` and the shell
 * contracts in `components/shell/` — `ArcNav.jsx` carries this geometry, and
 * `SHELL_LOCK_2026-08-08.md` is the signed-off figures.
 *
 * Three things the structure asserts, each of which an earlier draft got wrong:
 *
 *   1. **The nav is a true radial arc**, not a vertical pill column. Items fan
 *      out to specific offsets from the logo, listed in ARC below.
 *   2. **MUSIC's items are** Discover · Radio · Charts · Recommended ·
 *      Playlists. There is no Search item.
 *   3. **ME has no submenu at all.** It navigates straight to the ME surface,
 *      which carries Settings · Info · Legal · Accessibility as in-page rows.
 *
 * Module, tab and panel are ROUTES, not component state — the module structure
 * is a natural URL hierarchy. Only `navOpen`, `sheet`, `playing` and `hyped`
 * are ephemeral.
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
  { id: 'settings', label: 'Settings', detail: 'Account · notifications · payments', href: `${MMM_BASE}/me/settings` },
  { id: 'info', label: 'Info', detail: 'How iHYPE works', href: `${MMM_BASE}/me/info` },
  { id: 'legal', label: 'Legal', detail: 'Charter · terms · privacy', href: `${MMM_BASE}/me/legal` },
  { id: 'accessibility', label: 'Accessibility', detail: 'Motion · contrast · text', href: `${MMM_BASE}/me/accessibility` },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Radial-arc geometry
 * ──────────────────────────────────────────────────────────────────────────── */

export type ArcOffset = { x: number; y: number; delayMs: number };

/**
 * Where each item lands, measured from the logo's own origin (`left: 0;
 * bottom: 0` inside a zero-size fixed container at the frame's lower left).
 * These are the design's literal values, not a formula fitted to them: the arc
 * is hand-placed so no two pills collide at either breakpoint, and a computed
 * arc drifted off it. Two breakpoints, as drawn.
 *
 * Level-1 delays run ME → MUSIC → MAP (0 / 30 / 60ms), so the fan unfurls
 * upward from the thumb rather than downward into it.
 */
/**
 * Where each module disc lands, measured from the logo's own origin.
 *
 * These are the design system's tables verbatim
 * (`components/shell/ArcNav.jsx`), not values fitted by eye — the two
 * breakpoints are separately hand-placed so no two discs collide, and the
 * previous values here disagreed with the design in every slot while the
 * breakpoint and the delays happened to match. That is the signature of
 * numbers tuned locally rather than copied.
 *
 * There is NO second level. `ArcNav.d.ts` is explicit: "There is no second
 * level: Music's sections are tabs at the top of the Music pane. `items` is
 * ignored here and kept only so the shell can hold the route table in one
 * place." The five-item Music arc this file used to carry was a navigation
 * layer the design does not have, duplicating the tab strip `MmmMusic`
 * already renders.
 */
export const ARC: Record<'wide' | 'narrow', { level1: ArcOffset[] }> = {
  wide: {
    level1: [
      { x: 5, y: -192, delayMs: 60 },   // MAP
      { x: 115, y: -152, delayMs: 30 }, // MUSIC
      { x: 182, y: -48, delayMs: 0 },   // ME
    ],
  },
  narrow: {
    level1: [
      { x: 4, y: -176, delayMs: 60 },
      { x: 100, y: -132, delayMs: 30 },
      { x: 165, y: -43, delayMs: 0 },
    ],
  },
};

/** The breakpoint the arc switches at — the design's own `max-width: 720px`. */
export const ARC_NARROW_MAX_WIDTH = 720;

/** Resting transform for a closed item: tucked behind the logo, scaled down. */
export const ARC_CLOSED_TRANSFORM = 'translate(14px, -6px) scale(0.55)';

export function arcTransform(offset: ArcOffset): string {
  return `translate(${offset.x}px, ${offset.y}px)`;
}

/**
 * How many discs the arc has room for. Three, at both breakpoints — a module
 * added to `MMM_NAV` without a slot would silently never appear, which is the
 * `FRONTEND_GOTCHAS.md` §4 class of bug (present in the manifest, unreachable
 * on screen), so the count is asserted rather than trusted.
 */
export function arcSlotsFor(breakpoint: 'wide' | 'narrow' = 'wide'): number {
  return ARC[breakpoint].level1.length;
}

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
  const match = [...MMM_ME_PANELS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((panel) => pathname === panel.href || pathname.startsWith(`${panel.href}/`));
  return match?.id ?? null;
}

/**
 * The hint chip under the logo. With no header and no tab bar, this is the only
 * thing on screen that says where you are.
 */
export function navHint(pathname: string): string {
  return MMM_NAV.find((module) => module.id === moduleForPath(pathname))!.label;
}
