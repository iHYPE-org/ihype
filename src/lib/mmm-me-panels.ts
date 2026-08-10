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

export const ME_PANEL_IDS = ['settings', 'info', 'legal', 'accessibility'] as const;
export type MePanelId = (typeof ME_PANEL_IDS)[number];

export type MePanelRow = { label: string; detail: string; href: string };

export function isMePanelId(value: string | null | undefined): value is MePanelId {
  return typeof value === 'string' && (ME_PANEL_IDS as readonly string[]).includes(value);
}

export const ME_PANEL_ROWS: Record<MePanelId, readonly MePanelRow[]> = {
  settings: [
    { label: 'Account and privacy', detail: 'Profile, visibility, data export', href: '/settings' },
    { label: 'Notifications', detail: 'Email and push, per category', href: '/settings#notifications' },
    { label: 'Payouts', detail: 'Stripe Connect status and history', href: '/payouts' },
    { label: 'Tickets and wallet', detail: 'Your tickets, transfers, QR codes', href: '/tickets' },
  ],
  info: [
    { label: 'How iHYPE works', detail: 'The walkthrough, start to finish', href: '/walkthrough' },
    { label: 'The charter', detail: '70% artist · 20% venue · 10% promoters · $0 iHYPE', href: '/info?tab=charter' },
    { label: 'Transparency report', detail: 'Live platform numbers', href: '/info?tab=transparency' },
    { label: 'Trust and safety', detail: 'Reporting, moderation, appeals', href: '/info?tab=trust' },
  ],
  legal: [
    { label: 'Terms of service', detail: 'The agreement you signed up under', href: '/info?tab=terms' },
    { label: 'Privacy policy', detail: 'What is collected, and what never is', href: '/info?tab=privacy' },
    { label: 'The charter', detail: 'The split, and why it cannot change', href: '/info?tab=charter' },
    { label: 'DMCA', detail: 'Takedown and counter-notice process', href: '/info?tab=dmca' },
  ],
  accessibility: [
    { label: 'Appearance, text size, motion', detail: 'Theme, 85–140% text scale, reduce motion, high contrast', href: '/settings/accessibility' },
    { label: 'Language', detail: 'The 12 locales iHYPE ships', href: '/settings/accessibility' },
  ],
};
