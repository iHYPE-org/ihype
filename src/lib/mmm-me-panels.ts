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
    { label: 'Account and privacy', detail: 'Profile, payouts, visibility and data export', href: '/app/me/settings' },
    { label: 'Notifications', detail: 'Email and push, per category', href: '/app/me/settings#notifications' },
    { label: 'Accessibility', detail: 'Appearance, text size, contrast, motion and language', href: '/app/me/accessibility' },
  ],
  info: [
    { label: 'The charter', detail: '70% artist · 20% venue · 10% promoters · $0 iHYPE', href: '/app/me/info/charter' },
    { label: 'Transparency report', detail: 'Financial, moderation and safety stats', href: '/app/me/info/transparency' },
    { label: 'Terms of service', detail: 'The agreement you signed up under', href: '/app/me/info/terms' },
    { label: 'Privacy policy', detail: 'What is collected, and what never is', href: '/info?tab=privacy' },
    { label: 'DMCA', detail: 'Takedown and counter-notice process', href: '/info?tab=dmca' },
  ],
};
