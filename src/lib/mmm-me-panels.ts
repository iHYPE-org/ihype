/**
 * What each ME account panel contains.
 *
 * Lifted out of `src/app/app/me/[panel]/page.tsx` so the same rows can render
 * as a drawer on `/app/me` and, from that one definition, keep the old URLs
 * working. Two copies of this list would drift the moment a row was added to
 * one of them.
 *
 * ## Bridges, not reimplementations
 *
 * Every row points at a surface that already exists and carries its own
 * server-side checks — `/settings`, `/payouts`, `/info?tab=…`,
 * `/settings/accessibility`. Rebuilding any of them inside the shell would fork
 * the settings store, which the app-shell handoff explicitly warns against. So
 * a panel is a menu, which is also why it can be a drawer at all: there is no
 * form state to preserve across opening and closing one.
 *
 * Dependency-light on purpose (no `@/lib/db`, no `next/*`): `MmmMe` is a client
 * component and imports this directly.
 */

export const ME_PANEL_IDS = ['settings', 'info'] as const;
export type MePanelId = (typeof ME_PANEL_IDS)[number];

export type MePanelRow = { label: string; detail: string; href: string };

export function isMePanelId(value: string | null | undefined): value is MePanelId {
  return typeof value === 'string' && (ME_PANEL_IDS as readonly string[]).includes(value);
}

/** Keep retired panel deep links useful while enforcing the two canonical homes. */
export function canonicalMePanelId(value: string | null | undefined): MePanelId | null {
  if (isMePanelId(value)) return value;
  if (value === 'accessibility') return 'settings';
  if (value === 'legal') return 'info';
  return null;
}

export const ME_PANEL_ROWS: Record<MePanelId, readonly MePanelRow[]> = {
  settings: [
    // Accessibility leads this panel deliberately. It is the row a reader who
    // cannot read the app needs, and it was second — under a row about payouts
    // and data export, which nobody reaches this panel to find in a hurry.
    // Text size is named first in the detail for the same reason.
    { label: 'Accessibility', detail: 'Text size, appearance, contrast, motion and language', href: '/app/me/accessibility' },
    { label: 'Account and privacy', detail: 'Profile, payouts, visibility and data export', href: '/app/me/settings' },
  ],
  info: [
    /* Support leads this panel. It is here because the sitewide footer that
       used to carry it was deleted as old-design chrome, and ME had no other
       route to it — a ROW in an existing panel rather than a panel of its own,
       since a panel is a drawer of destinations and Support is one. (Advertise
       needed nothing; `MmmMe` already links it.)

       First, not last: everything below is reference material a member reads
       once, and this is the row someone opens Info to find when something has
       actually gone wrong. */
    { label: 'Support', detail: 'Get help, report a problem, or check a request you filed', href: '/app/me/support' },
    { label: 'The charter', detail: '70% artist · 20% venue · 10% promoters · $0 iHYPE', href: '/app/me/info/charter' },
    { label: 'Transparency report', detail: 'Financial, moderation and safety stats', href: '/app/me/info/transparency' },
    { label: 'Terms of service', detail: 'The agreement you signed up under', href: '/app/me/info/terms' },
    { label: 'Privacy policy', detail: 'What is collected, and what never is', href: '/app/me/info/privacy' },
    { label: 'DMCA', detail: 'Takedown and counter-notice process', href: '/app/me/info/dmca' },
  ],
};
