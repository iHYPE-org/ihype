import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MMM_ME_PANELS } from '@/lib/mmm-nav';

export const dynamic = 'force-dynamic';

/**
 * The four ME panels. Each is a short bridge to the real, already-built surface
 * rather than a reimplementation of it: `/settings`, `/info`, `/info?tab=legal`
 * and `/settings/accessibility` all exist, are wired, and carry their own
 * server-side checks. Rebuilding them inside the shell would fork the settings
 * store, which the app-shell handoff's own note warns against.
 */
const DESTINATIONS: Record<string, Array<{ label: string; detail: string; href: string }>> = {
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

export default async function MmmMePanelPage({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  const definition = MMM_ME_PANELS.find((entry) => entry.id === panel);
  const rows = DESTINATIONS[panel];
  if (!definition || !rows) notFound();

  return (
    <>
      <Link className="mmm-eyebrow" href="/app/me" style={{ display: 'inline-block', marginBottom: 12 }}>
        <span aria-hidden="true">◂ </span>ME
      </Link>
      <h1 className="mmm-title" style={{ marginBottom: 5 }}>{definition.label}</h1>
      <p style={{ fontSize: '0.84rem', color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 18 }}>{definition.detail}</p>
      <div>
        {rows.map((row) => (
          <Link className="mmm-row" href={row.href} key={row.href + row.label} style={{ display: 'flex' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{row.label}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{row.detail}</span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
          </Link>
        ))}
      </div>
    </>
  );
}
