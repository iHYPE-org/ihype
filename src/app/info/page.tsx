import type { Metadata } from 'next';
import { InfoTabsShell } from '@/components/InfoTabs';
import { TrustSafetyPanel } from '@/components/info/TrustSafetyPanel';
import { TransparencyPanel } from '@/components/info/TransparencyPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Info | iHYPE.org',
  description: 'Trust & safety, transparency, privacy, terms, the charter and DMCA — the public record of how iHYPE operates.',
};

/**
 * Single home for Trust & Safety, Transparency, Privacy and Legal, replacing
 * four separate destinations in the footer and menu. /audit, /transparency,
 * /legal and /privacy are now redirects into the matching tab.
 *
 * This stays a server component so the two data-driven panels keep running
 * their Prisma aggregates on the server; only the tab strip is client-side,
 * and it receives those panels as already-rendered slots.
 */
export default function InfoPage() {
  return (
    <InfoTabsShell
      trustPanel={<TrustSafetyPanel />}
      transparencyPanel={<TransparencyPanel />}
    />
  );
}
