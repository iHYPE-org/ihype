/**
 * The shell's own words, translated at the one place each is drawn.
 *
 * Why this exists (2026-09-05, owner: "Some languages don't actually change
 * anything"). Every destination the shell draws — the dock's four tabs, the
 * section strip's pills, the ME account rows — is declared ONCE as English in a
 * dependency-light manifest (`mmm-nav.ts`, `profile-tabs.ts`,
 * `mmm-me-panels.ts`) and rendered by a component that never translated it.
 * The manifests are the right shape: they are read by tests, by the route
 * resolver and by the strip's fallback, none of which has a locale. So the
 * translation happens at the DRAW, keyed on the English the manifest carries,
 * and the manifests stay pure.
 *
 * Every call here is a literal `t('key', 'English')`, because
 * `scripts/extract-i18n-keys.mjs` reads the source for exactly that shape and
 * `apply-i18n-batch.mjs` refuses a key the extractor cannot see. A
 * `t(row.labelKey, row.label)` would be tidier and would be invisible to both.
 *
 * `t` is passed in rather than imported: the same switch serves a client
 * component's `useI18n().t` and a server page's `getServerT()`.
 */

export type Translate = (key: string, fallback?: string) => string;

/** The dock's four engraved tab labels. */
export function translateTabLabel(t: Translate, moduleId: string, fallback: string): string {
  switch (moduleId) {
    case 'music': return t('mmmDock.tab.listen', 'Listen');
    case 'map': return t('mmmDock.tab.map', 'Map');
    case 'tickets': return t('mmmDock.tab.tickets', 'Tickets');
    case 'me': return t('mmmDock.tab.me', 'Me');
    default: return fallback;
  }
}

/**
 * A section-strip pill, by the English label the manifest declared for it.
 *
 * Keyed on the label rather than the id because ids collide across screens
 * (`info` is "Info" on ME and "Venue Info" on a venue) while the label is what
 * the member reads. A label this switch does not know renders as it was
 * declared, so a new section is never blanked — it is merely English until a
 * case is added here.
 */
export function translateStationLabel(t: Translate, label: string): string {
  switch (label) {
    // MUSIC
    case 'Discover': return t('mmmStrip.discover', 'Discover');
    case 'Radio': return t('mmmStrip.radio', 'Radio');
    case 'Charts': return t('mmmStrip.charts', 'Charts');
    case 'Recommended': return t('mmmStrip.recommended', 'Recommended');
    case 'Playlists': return t('mmmStrip.playlists', 'Playlists');
    // MAP layers
    case 'Events': return t('mmmStrip.events', 'Events');
    case 'Venues': return t('mmmStrip.venues', 'Venues');
    case 'Artists': return t('mmmStrip.artists', 'Artists');
    // ME
    case 'Profiles': return t('mmmStrip.profiles', 'Profiles');
    case 'Info': return t('mmmStrip.info', 'Info');
    case 'Settings': return t('mmmStrip.settings', 'Settings');
    // A public artist
    case 'Albums': return t('mmmStrip.albums', 'Albums');
    case 'Tour': return t('mmmStrip.tour', 'Tour');
    case 'Bio': return t('mmmStrip.bio', 'Bio');
    case 'Merch': return t('mmmStrip.merch', 'Merch');
    case 'Contact': return t('mmmStrip.contact', 'Contact');
    case 'Press Kit': return t('mmmStrip.pressKit', 'Press Kit');
    // A public venue
    case 'Event Calendar': return t('mmmStrip.eventCalendar', 'Event Calendar');
    case 'Venue Info': return t('mmmStrip.venueInfo', 'Venue Info');
    case 'Rules & FAQs': return t('mmmStrip.rulesFaqs', 'Rules & FAQs');
    // The profile editor's sections (PagesHome)
    case 'About': return t('mmmStrip.about', 'About');
    case 'Media': return t('mmmStrip.media', 'Media');
    case 'Press kit': return t('mmmStrip.pressKitLower', 'Press kit');
    case 'Stats': return t('mmmStrip.stats', 'Stats');
    case 'Event Info': return t('mmmStrip.eventInfo', 'Event Info');
    default: return label;
  }
}

/** The strip's accessible name for a screen that registered no set of its own. */
export function translateStripName(t: Translate, moduleId: string | null): string {
  switch (moduleId) {
    case 'music': return t('mmmStrip.sectionsInMusic', 'Sections in MUSIC');
    case 'map': return t('mmmStrip.sectionsInMap', 'Sections in MAP');
    case 'tickets': return t('mmmStrip.sectionsInTickets', 'Sections in TICKETS');
    case 'me': return t('mmmStrip.sectionsInMe', 'Sections in ME');
    default: return t('mmmStrip.sectionsInScreen', 'Sections in this screen');
  }
}

/**
 * The ME account rows, by href. `ME_PANEL_ROWS` keeps the English beside the
 * href because two tests and the route resolver read it; this is the same text
 * for a member who reads something else. `mmm-me-panels.test.ts` asserts the
 * two agree under an identity `t`, so the copies cannot drift.
 */
export function translateMeRow(t: Translate, row: { href: string; label: string; detail: string }): { label: string; detail: string } {
  switch (row.href) {
    case '/app/me/notifications':
      return { label: t('mmmMe.row.notifications', 'Notifications'), detail: t('mmmMe.row.notificationsDetail', 'What has happened on your account') };
    case '/app/me/accessibility':
      return { label: t('mmmMe.row.accessibility', 'Accessibility'), detail: t('mmmMe.row.accessibilityDetail', 'Text size, appearance, contrast, motion and language') };
    case '/app/me/settings':
      return { label: t('mmmMe.row.account', 'Account and privacy'), detail: t('mmmMe.row.accountDetail', 'Profile, payouts, visibility and data export') };
    case '/app/me/support/tickets':
      return { label: t('mmmMe.row.support', 'Support'), detail: t('mmmMe.row.supportDetail', 'Get help, report a problem, or check a request you filed') };
    case '/app/me/info/charter':
      return { label: t('mmmMe.row.charter', 'The charter'), detail: t('mmmMe.row.charterDetail', '70% artist · 20% venue · 10% promoters · $0 iHYPE') };
    case '/app/me/info/community':
      return { label: t('mmmMe.row.community', 'Community roadmap'), detail: t('mmmMe.row.communityDetail', 'See what members have asked for, add one, vote') };
    case '/app/me/info/transparency':
      return { label: t('mmmMe.row.transparency', 'Transparency report'), detail: t('mmmMe.row.transparencyDetail', 'Financial, moderation and safety stats') };
    case '/app/me/info/terms':
      return { label: t('mmmMe.row.terms', 'Terms of service'), detail: t('mmmMe.row.termsDetail', 'The agreement you signed up under') };
    case '/app/me/info/privacy':
      return { label: t('mmmMe.row.privacy', 'Privacy policy'), detail: t('mmmMe.row.privacyDetail', 'What is collected, and what never is') };
    case '/app/me/info/dmca':
      return { label: t('mmmMe.row.dmca', 'DMCA'), detail: t('mmmMe.row.dmcaDetail', 'Takedown and counter-notice process') };
    default:
      return { label: row.label, detail: row.detail };
  }
}

/** The role chips and the "<Role> stats" eyebrow on ME. */
export function translateRoleLabel(t: Translate, role: string): string {
  switch (role) {
    case 'fan': return t('mmmMe.role.fan', 'Fan');
    case 'artist': return t('mmmMe.role.artist', 'Artist');
    case 'venue': return t('mmmMe.role.venue', 'Venue');
    default: return role;
  }
}

/**
 * The ME stat tiles and activity headings that `mmm-me.ts` labels in English.
 * That loader runs before the locale is known to it and is read by a unit
 * suite with no request; the label travels as English and is translated here.
 */
export function translateMeStatLabel(t: Translate, label: string): string {
  switch (label) {
    case 'Hypes cast': return t('mmmMe.stat.hypesCast', 'Hypes cast');
    case 'Shows attended': return t('mmmMe.stat.showsAttended', 'Shows attended');
    case 'Promoter earnings': return t('mmmMe.stat.promoterEarnings', 'Promoter earnings');
    case 'Following': return t('mmmMe.stat.following', 'Following');
    case 'Total hypes': return t('mmmMe.stat.totalHypes', 'Total hypes');
    case 'Paid out 30d': return t('mmmMe.stat.paidOut30d', 'Paid out 30d');
    case 'Upcoming shows': return t('mmmMe.stat.upcomingShows', 'Upcoming shows');
    case 'Followers': return t('mmmMe.stat.followers', 'Followers');
    case 'Avg fill rate': return t('mmmMe.stat.avgFillRate', 'Avg fill rate');
    case 'Gate 30d': return t('mmmMe.stat.gate30d', 'Gate 30d');
    case 'Shows booked': return t('mmmMe.stat.showsBooked', 'Shows booked');
    case 'Capacity': return t('mmmMe.stat.capacity', 'Capacity');
    case 'Verified': return t('mmmMe.status.verified', 'Verified');
    case 'Unverified': return t('mmmMe.status.unverified', 'Unverified');
    default: return label;
  }
}
