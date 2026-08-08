/**
 * The signed-in app shell's single navigation source of truth.
 *
 * Backlog items 1 and 2 of the "iHYPE signed-in App Shell" handoff:
 *
 *   1. "Make navigation data, not markup. One manifest (section → items →
 *      route → role gate → badge) feeding both the drawer and the context
 *      strip. The prototype repeats the structure per section."
 *   2. "Route registry (route → section, title, eyebrow, allowed roles)
 *      replacing the per-route booleans."
 *
 * Everything here is pure and dependency-light on purpose: it is imported by
 * client components (the drawer, the context strip) AND by tests. Never add a
 * `@/lib/db` / Prisma import — see the same rule on
 * `src/lib/profile-stats-catalog.ts`.
 *
 * The hrefs are the REAL product routes that the previous NavDrawer already
 * pointed at. The design prototype invented its own flat route ids
 * ('discover', 'nearme', 'pagecreator'…); those are kept only as stable item
 * ids so the design and the code can be talked about in the same words.
 */

export const SHELL_SECTIONS = ['LISTEN', 'EVENTS', 'PAGES', 'SETTINGS'] as const;
export type ShellSectionId = (typeof SHELL_SECTIONS)[number];

/**
 * Which account type a nav item needs. `null` means every signed-in member
 * sees it. These gate VISIBILITY only — every destination keeps its own
 * server-side authorization check, exactly as the old drawer did.
 */
export type ShellRoleGate = 'ARTIST' | 'DJ' | 'VENUE' | 'ADVERTISER' | 'PROMOTER';

/** Badge tone → the design token that paints it (never a hex literal). */
export type ShellBadgeTone = 'muted' | 'venue' | 'promoter' | 'artist' | 'advertiser';

export type ShellBadge = { text: string; tone: ShellBadgeTone };

export type ShellNavItem = {
  /** Stable id, matching the prototype's route names where one exists. */
  id: string;
  section: ShellSectionId;
  href: string;
  labelKey: string;
  labelFallback: string;
  badge?: ShellBadge;
  gate?: ShellRoleGate;
  /** Shown as a drawer row. */
  inDrawer: boolean;
  /** Shown as a context-strip pill. */
  inTabs: boolean;
};

/**
 * What the shell knows about the viewer. Assembled server-side in the root
 * layout from the session and the member's own profiles — no fabricated
 * numbers, and an absent value simply hides its badge.
 */
export type ShellAccount = {
  name: string;
  /** Owned profile (id + name) per creator type, when one exists. */
  artistProfileId?: string;
  djProfileSlug?: string;
  venueProfileId?: string;
  isAdvertiser: boolean;
  canPromote: boolean;
  /** Upcoming ticket orders. Omitted (not zeroed) when the count is unknown. */
  upcomingTicketCount?: number;
};

/**
 * Route registry: every route the shell owns, and the section that owns it.
 * Sub-routes that are not nav destinations (a show detail, an artist page)
 * still need a section so the context strip and the drawer's open accordion
 * resolve correctly when a member lands on one.
 *
 * Order matters: the first entry whose `match` accepts the path wins, so
 * more specific prefixes are listed before their parents.
 */
export type ShellRouteEntry = {
  /** Path prefix or exact path. */
  path: string;
  /** `exact` = only this pathname; `prefix` = this pathname and anything under it. */
  kind: 'exact' | 'prefix';
  section: ShellSectionId;
  /** The nav item id this route reads as active for, when it is a nav destination. */
  itemId?: string;
  /** Query param that discriminates sibling routes sharing one pathname. */
  tabParam?: string;
};

export const SHELL_ROUTES: ShellRouteEntry[] = [
  // ── LISTEN ────────────────────────────────────────────────────────────
  // `/listen`, `/radio`, `/discover` and `/search` are gone: they were the
  // pre-shell three-tab app, and each is now a redirect into `/app/music/*`.
  // A redirect needs no shell chrome, so it needs no registry entry — and
  // leaving one behind would have this shell briefly resolve a section for a
  // page that is on its way somewhere else.
  //
  // `/tracks` and `/playlist` stay: both are real routes the MUSIC module links
  // out to, so a member can land on one and the strip has to resolve a section.
  { path: '/tracks', kind: 'prefix', section: 'LISTEN' },
  { path: '/playlist', kind: 'prefix', section: 'LISTEN', itemId: 'playlists' },

  // ── EVENTS ────────────────────────────────────────────────────────────
  { path: '/shows', kind: 'exact', section: 'EVENTS', tabParam: 'tab' },
  { path: '/shows', kind: 'prefix', section: 'EVENTS' },
  { path: '/tickets', kind: 'prefix', section: 'EVENTS', itemId: 'tickets' },
  { path: '/events', kind: 'prefix', section: 'EVENTS', itemId: 'eventcreator' },
  { path: '/this-weekend', kind: 'prefix', section: 'EVENTS', itemId: 'nearme' },
  { path: '/for-you', kind: 'prefix', section: 'EVENTS', itemId: 'recommended' },
  { path: '/me/promote', kind: 'prefix', section: 'EVENTS', itemId: 'promote' },
  { path: '/payout', kind: 'prefix', section: 'EVENTS' },
  { path: '/payouts', kind: 'prefix', section: 'EVENTS' },

  // ── PAGES ─────────────────────────────────────────────────────────────
  { path: '/pages', kind: 'exact', section: 'PAGES', tabParam: 'tab' },
  { path: '/me/dashboard', kind: 'prefix', section: 'PAGES', itemId: 'dashboard' },
  { path: '/me/analytics', kind: 'prefix', section: 'PAGES' },
  { path: '/me/booking', kind: 'prefix', section: 'PAGES' },
  { path: '/artists', kind: 'prefix', section: 'PAGES' },
  { path: '/promoters', kind: 'prefix', section: 'PAGES' },
  { path: '/venues', kind: 'prefix', section: 'PAGES' },
  { path: '/fans', kind: 'prefix', section: 'PAGES' },
  { path: '/advertise', kind: 'prefix', section: 'PAGES', itemId: 'adcreator' },
  { path: '/settings', kind: 'exact', section: 'PAGES', itemId: 'account' },

  // ── SETTINGS ──────────────────────────────────────────────────────────
  // /settings/accessibility is a SETTINGS route even though bare /settings is
  // the PAGES "Account" destination — listed above the prefix entry it would
  // otherwise fall into.
  { path: '/settings/accessibility', kind: 'exact', section: 'SETTINGS', itemId: 'a11y' },
  { path: '/community', kind: 'prefix', section: 'SETTINGS', itemId: 'community' },
  { path: '/community-rules', kind: 'prefix', section: 'SETTINGS' },
  { path: '/info', kind: 'prefix', section: 'SETTINGS', itemId: 'info' },
  { path: '/legal', kind: 'prefix', section: 'SETTINGS', itemId: 'legal' },
  { path: '/support', kind: 'prefix', section: 'SETTINGS' },
];

/** Fallback section for a shell route with no registry entry. */
export const DEFAULT_SHELL_SECTION: ShellSectionId = 'LISTEN';

/**
 * Builds the manifest for one member. Role-gated items are dropped, not
 * disabled — the prototype's `sc-if`s, expressed as data.
 */
export function buildShellNav(account: ShellAccount): ShellNavItem[] {
  const items: ShellNavItem[] = [
    // ── LISTEN ──────────────────────────────────────────────────────────
    // These five point INTO the Music · Map · Me shell at `/app`, not at this
    // shell's own `/listen` deck, and that is the whole of the "one-way door"
    // fix (DESIGN_SYNC row 273).
    //
    // `/app/map` is where sign-in and `/` already land, so a member starts in
    // MMM. But MMM has no Events or Pages module, so it links out to `/tickets`,
    // `/pages` and `/shows/[slug]`, which render in THIS shell — and every
    // destination here used to point back at `/listen?tab=…`. One tap on a
    // ticket therefore dropped a member into the legacy deck with no route
    // back, and they stayed there for the rest of the session. That is why the
    // new design "was not showing up" despite being live and being the landing
    // surface.
    //
    // Only the destinations MMM genuinely implements are moved. Events, Pages,
    // advertise and account keep their own routes below, because pointing them
    // at a module that does not exist would trade a stale shell for a dead end.
    // `/app/me/settings` is deliberately NOT the Account destination either: it
    // is a bridge menu of links to `/settings`, so routing there would add a
    // hop and still land back in this shell.
    //
    // No MAP entry is added here. The destinations change; the drawer's
    // STRUCTURE does not, because it is the app-shell handoff's and is asserted
    // as such in app-nav.test.ts. MMM's own arc nav carries MAP, so arriving at
    // any of these four puts the map one tap away without inventing a row the
    // design never drew.
    {
      id: 'discover', section: 'LISTEN', href: '/app/music/discover',
      labelKey: 'appShell.nav.discover', labelFallback: 'Discover',
      badge: { text: 'SEEDS', tone: 'muted' }, inDrawer: true, inTabs: true,
    },
    {
      id: 'radio', section: 'LISTEN', href: '/app/music/radio',
      labelKey: 'appShell.nav.radio', labelFallback: 'Radio',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'charts', section: 'LISTEN', href: '/app/music/charts',
      labelKey: 'appShell.nav.charts', labelFallback: 'Charts',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'playlists', section: 'LISTEN', href: '/app/music/playlists',
      labelKey: 'appShell.nav.playlists', labelFallback: 'Playlists',
      inDrawer: true, inTabs: true,
    },

    // ── EVENTS ──────────────────────────────────────────────────────────
    {
      id: 'nearme', section: 'EVENTS', href: '/shows?tab=local',
      labelKey: 'appShell.nav.nearMe', labelFallback: 'Near Me',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'recommended', section: 'EVENTS', href: '/shows?tab=foryou',
      labelKey: 'appShell.nav.recommended', labelFallback: 'Recommended',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'tickets', section: 'EVENTS', href: '/shows?tab=tickets',
      labelKey: 'appShell.nav.myTickets', labelFallback: 'My Tickets',
      // The design's static "2" is a real count here, and disappears at zero
      // rather than rendering a badge that says nothing.
      ...(account.upcomingTicketCount
        ? { badge: { text: String(account.upcomingTicketCount), tone: 'venue' as const } }
        : {}),
      inDrawer: true, inTabs: true,
    },
    {
      id: 'promote', section: 'EVENTS', href: '/me/promote',
      labelKey: 'appShell.nav.promote', labelFallback: 'Promote',
      badge: { text: '10% POOL', tone: 'promoter' }, gate: 'PROMOTER',
      inDrawer: true, inTabs: true,
    },

    // ── PAGES ───────────────────────────────────────────────────────────
    {
      id: 'dashboard', section: 'PAGES', href: '/me/dashboard',
      labelKey: 'appShell.nav.dashboard', labelFallback: 'My Dashboard',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'pagecreator', section: 'PAGES', href: '/pages?tab=creator',
      labelKey: 'appShell.nav.pageCreator', labelFallback: 'Page Creator',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'tourcreator', section: 'PAGES',
      href: account.artistProfileId
        ? `/pages?tab=mypage&profile=${encodeURIComponent(account.artistProfileId)}&tool=tour`
        : '/pages?tab=mypage',
      labelKey: 'appShell.nav.tourCreator', labelFallback: 'Tour Creator',
      badge: { text: 'ARTIST', tone: 'artist' }, gate: 'ARTIST',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'eventcreator', section: 'PAGES',
      href: account.venueProfileId
        ? `/events/new?venue=${encodeURIComponent(account.venueProfileId)}`
        : '/events/new',
      labelKey: 'appShell.nav.eventCreator', labelFallback: 'Event Creator',
      badge: { text: 'VENUE', tone: 'venue' }, gate: 'VENUE',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'adcreator', section: 'PAGES', href: '/advertise',
      labelKey: 'appShell.nav.adCreator', labelFallback: 'Ad Creator',
      badge: { text: 'ADVERTISER', tone: 'advertiser' }, gate: 'ADVERTISER',
      inDrawer: true, inTabs: true,
    },
    {
      // The design ends the PAGES tab row with the member's own name, routing
      // to Account. Drawer-invisible, exactly as in the prototype.
      id: 'account', section: 'PAGES', href: '/settings',
      labelKey: 'appShell.nav.account', labelFallback: account.name,
      inDrawer: false, inTabs: true,
    },

    // ── SETTINGS ────────────────────────────────────────────────────────
    {
      id: 'community', section: 'SETTINGS', href: '/community',
      labelKey: 'appShell.nav.community', labelFallback: 'Community',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'a11y', section: 'SETTINGS', href: '/settings/accessibility',
      labelKey: 'appShell.nav.accessibility', labelFallback: 'Accessibility',
      inDrawer: true, inTabs: true,
    },
    {
      id: 'info', section: 'SETTINGS', href: '/info',
      labelKey: 'appShell.nav.info', labelFallback: 'Info',
      inDrawer: true, inTabs: true,
    },
    // No 'legal' destination: /legal is a thin redirect into /info's Terms
    // tab, so it sat beside Info in the same drawer section pointing at a
    // subset of the page Info already opens. The /legal route stays (it is
    // referenced by signup consent copy, the cookie banner and emails) and
    // keeps its entry in SHELL_ROUTES so the shell still resolves a section
    // while the redirect runs — it just is not offered twice in the nav.
  ];

  return items.filter((item) => passesGate(item.gate, account));
}

export function passesGate(gate: ShellRoleGate | undefined, account: ShellAccount) {
  if (!gate) return true;
  if (gate === 'ARTIST') return Boolean(account.artistProfileId);
  if (gate === 'DJ') return Boolean(account.djProfileSlug);
  if (gate === 'VENUE') return Boolean(account.venueProfileId);
  if (gate === 'ADVERTISER') return account.isAdvertiser;
  return account.canPromote;
}

/** The `?tab=` value a nav href carries, if any. */
export function hrefTab(href: string): string | null {
  const query = href.split('?')[1];
  if (!query) return null;
  const value = new URLSearchParams(query).get('tab');
  return value ?? null;
}

export function hrefPathname(href: string): string {
  return href.split('?')[0].split('#')[0];
}

/**
 * Which registry entry owns a pathname. Exact entries are considered before
 * prefix entries at the same path so `/settings` (Account, PAGES) and
 * `/settings/accessibility` (SETTINGS) resolve independently.
 */
export function findShellRoute(pathname: string): ShellRouteEntry | null {
  for (const entry of SHELL_ROUTES) {
    if (entry.kind === 'exact') {
      if (pathname === entry.path) return entry;
    } else if (pathname === entry.path || pathname.startsWith(`${entry.path}/`)) {
      return entry;
    }
  }
  return null;
}

/** True when the shell chrome should wrap this pathname at all. */
export function isShellRoute(pathname: string): boolean {
  return findShellRoute(pathname) !== null;
}

export function resolveSection(pathname: string): ShellSectionId {
  return findShellRoute(pathname)?.section ?? DEFAULT_SHELL_SECTION;
}

/**
 * Which nav item is active. Two ways an item can win:
 *
 *  - the registry entry for the pathname names it (`/radio` → Radio), or
 *  - the pathname is a tabbed hub (`/listen`, `/shows`, `/pages`) and the
 *    item's own `?tab=` matches the current one. A hub visited with no tab
 *    param resolves to the section's first tabbed item, which is what those
 *    pages themselves default to.
 *
 * Returns null when nothing matches — a show detail page is inside EVENTS
 * but is not itself a nav destination, and no pill should light up.
 */
export function resolveActiveItemId(
  items: ShellNavItem[],
  pathname: string,
  tab?: string | null,
): string | null {
  const entry = findShellRoute(pathname);
  if (!entry) return null;
  if (entry.itemId) return entry.itemId;
  if (!entry.tabParam) return null;

  const siblings = items.filter((item) => hrefPathname(item.href) === pathname && hrefTab(item.href));
  if (!siblings.length) return null;
  if (!tab) return siblings[0].id;
  return siblings.find((item) => hrefTab(item.href) === tab)?.id ?? siblings[0].id;
}

/** The context strip's sibling pills for a section, in manifest order. */
export function sectionTabs(items: ShellNavItem[], section: ShellSectionId): ShellNavItem[] {
  return items.filter((item) => item.section === section && item.inTabs);
}

/** The drawer's rows for a section, in manifest order. */
export function sectionRows(items: ShellNavItem[], section: ShellSectionId): ShellNavItem[] {
  return items.filter((item) => item.section === section && item.inDrawer);
}

/** Token that paints a badge tone. Never a hex literal. */
export function badgeToneVar(tone: ShellBadgeTone): string {
  if (tone === 'venue') return 'var(--role-venue-text)';
  if (tone === 'promoter') return 'var(--role-promoter-text)';
  if (tone === 'artist') return 'var(--role-artist-text)';
  if (tone === 'advertiser') return 'var(--role-advertiser-text)';
  return 'var(--ink-3)';
}
