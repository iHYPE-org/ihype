/**
 * The Music · Map · Me navigation manifest and radial-arc geometry.
 *
 * Source: `design/design-system-v8/templates/simplified-app/SimplifiedApp.dc.html`,
 * locked by `design/design-system-v8/SHELL_LOCK_2026-08-08.md`. It supersedes both
 * retired bundles, and differs from the pre-v8 generation on three points that
 * matter here:
 *
 *   1. **The nav is a true radial arc**, not a vertical pill column. Items fan
 *      out to specific offsets from the logo, listed in ARC below.
 *   2. **MUSIC's items changed**: Search is gone and **Recommended** is new —
 *      Discover · Radio · Charts · Recommended · Playlists.
 *   3. **ME has no submenu at all.** It navigates straight to the ME surface,
 *      which carries Settings · Info · Legal · Accessibility as in-page rows.
 *      The earlier seven-item ME fan-out is retired — which also disposes of
 *      `FRONTEND_GOTCHAS.md` §4's clipping bug at the source, since there is no
 *      longer a seven-item wrapping submenu to clip.
 *
 * The handoff's own note on state still holds: module, tab and panel are
 * ROUTES, not component state — "the module structure is a natural URL
 * hierarchy". Only `navOpen`, `sheet`, `playing` and `hyped` are ephemeral.
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
  /** Level-1 pill label — Syne 800, 19px, as drawn. */
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
export const ARC: Record<'wide' | 'narrow', { level1: ArcOffset[]; level2: ArcOffset[] }> = {
  wide: {
    level1: [
      { x: 6, y: -186, delayMs: 60 },   // MAP
      { x: 118, y: -132, delayMs: 30 }, // MUSIC
      { x: 182, y: -14, delayMs: 0 },   // ME
    ],
    level2: [
      { x: 2, y: -330, delayMs: 40 },
      { x: 140, y: -296, delayMs: 70 },
      { x: 248, y: -224, delayMs: 100 },
      { x: 318, y: -124, delayMs: 130 },
      { x: 340, y: -12, delayMs: 160 },
    ],
  },
  narrow: {
    level1: [
      { x: 4, y: -158, delayMs: 60 },
      { x: 92, y: -112, delayMs: 30 },
      { x: 138, y: -12, delayMs: 0 },
    ],
    level2: [
      { x: 2, y: -278, delayMs: 40 },
      { x: 104, y: -246, delayMs: 70 },
      { x: 178, y: -186, delayMs: 100 },
      { x: 214, y: -108, delayMs: 130 },
      { x: 226, y: -18, delayMs: 160 },
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
 * The arc has exactly five level-2 slots. A module with more items than that
 * would silently lose the overflow, so this is asserted rather than trusted —
 * `FRONTEND_GOTCHAS.md` §4 is the same class of bug (items present in the
 * manifest but unreachable on screen).
 */
export function arcSlotsFor(level: 1 | 2, breakpoint: 'wide' | 'narrow' = 'wide'): number {
  return ARC[breakpoint][level === 1 ? 'level1' : 'level2'].length;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Route resolution
 * ──────────────────────────────────────────────────────────────────────────── */

export function isMmmRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === MMM_BASE || pathname.startsWith(`${MMM_BASE}/`);
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
