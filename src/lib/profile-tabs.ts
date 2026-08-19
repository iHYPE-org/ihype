import type { ProfileTab } from '@/components/profile/ProfileTabs';

/**
 * The fixed subnav for public profiles, specified by the owner 2026-08-19.
 *
 * Both sets are FIXED: the same tabs in the same order on every profile of
 * that type, filled in or not. See `ProfileTabs` for why an empty tab beats a
 * missing one.
 *
 * Every tab here is backed by something the schema already holds — this is a
 * presentation change, not a data model change:
 *
 *   ARTIST
 *     Albums     ArtistMediaAsset rows for the profile
 *     Tour       Show rows where the profile headlines (+ `tourContent`)
 *     Bio        `headline` and `bio`
 *     Merch      `merchContent`
 *     Contact    `contactInfo`, and the booking request flow
 *     Press Kit  `pressKitContent` (JSON: tagline, quotes, achievements)
 *
 *   VENUE
 *     Event Calendar  Show rows hosted at the venue
 *     Venue Info      `capacity`, `roomType`, `addressLine1`, `hoursText`
 *     Rules & FAQs    `requestContent` — see the note below
 *     Contact         `contactInfo`, and the booking request flow
 *
 * ## The one that has no home of its own
 *
 * "Rules & FAQs" has no dedicated column. `requestContent` is the closest
 * thing — it is the venue's own copy about how to approach them — so it is
 * what renders there, and when it is empty the panel says so plainly rather
 * than inventing house rules no venue agreed to. If this tab earns its keep,
 * it wants a real `rulesContent` column and a migration; it should not
 * quietly keep borrowing a field that means something else.
 */
export const ARTIST_TABS = [
  { id: 'albums', label: 'Albums' },
  { id: 'tour', label: 'Tour' },
  { id: 'bio', label: 'Bio' },
  { id: 'merch', label: 'Merch' },
  { id: 'contact', label: 'Contact' },
  { id: 'press', label: 'Press Kit' },
] as const satisfies readonly ProfileTab[];

export const VENUE_TABS = [
  { id: 'calendar', label: 'Event Calendar' },
  { id: 'info', label: 'Venue Info' },
  { id: 'rules', label: 'Rules & FAQs' },
  { id: 'contact', label: 'Contact' },
] as const satisfies readonly ProfileTab[];

/** Falls back to the first tab, so a stale or hand-typed `?tab=` still renders. */
export function resolveTab(tabs: readonly ProfileTab[], requested: string | undefined): string {
  return tabs.some((tab) => tab.id === requested) ? (requested as string) : tabs[0].id;
}
