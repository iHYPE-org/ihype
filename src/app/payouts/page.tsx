import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isStripeConfigured } from '@/lib/stripe';
import { PayoutsHistoryPanel } from '@/components/payouts/PayoutsHistoryPanel';
import { PayoutSettingsPanel } from '@/components/payouts/PayoutSettingsPanel';
import { PayoutShowsPanel } from '@/components/payouts/PayoutShowsPanel';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payouts · iHYPE',
  robots: { index: false, follow: false },
};

type Tab = 'history' | 'settings' | 'show';
const TABS: { id: Tab; label: string }[] = [
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
  { id: 'show', label: 'This show' },
];

/**
 * Real tabbed Payouts hub (DESIGN_SYNC row 245) — consolidates the three
 * previously separate payout pages into one screen per Payouts.dc.html,
 * without losing any of their auth gates or real Prisma queries: each tab
 * reuses the exact same panel component the standalone page used to render
 * (PayoutsHistoryPanel/PayoutSettingsPanel/PayoutShowsPanel), just fed from
 * this page's own data fetch. `/me/payouts` and `/me/payout-settings` are
 * now thin redirects here; `/payout/[id]` (per-event breakdown) stays its
 * own route since it needs a specific show id the hub can only link to,
 * not render inline without one.
 */
export default async function PayoutsHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const t = await getServerT();
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/payouts');
  }

  const params = searchParams ? await searchParams : undefined;
  const requestedTab = params?.tab;
  const tab: Tab = requestedTab === 'settings' ? 'settings' : requestedTab === 'show' ? 'show' : 'history';

  const profiles = await db.profile.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, slug: true, type: true, name: true, stripeConnectAccountId: true, stripeConnectOnboarded: true },
    orderBy: { createdAt: 'asc' },
  });
  const profileIds = profiles.map((p) => p.id);

  const [released, pending, shows] = await Promise.all([
    tab === 'history' && profileIds.length
      ? db.accountsPayableEntry.findMany({
          where: { profileId: { in: profileIds }, status: 'RELEASED' },
          include: { show: { select: { title: true, slug: true } } },
          orderBy: { paidAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),
    tab === 'history' && profileIds.length
      ? db.accountsPayableEntry.findMany({
          where: { profileId: { in: profileIds }, status: 'PENDING' },
          include: { show: { select: { title: true, slug: true, status: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),
    tab === 'show'
      ? db.show.findMany({
          where: { creatorId: session.user.id },
          select: { id: true, slug: true, title: true, status: true, startsAt: true, isTicketed: true },
          orderBy: { startsAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const stripeReady = isStripeConfigured();
  const settingsProfiles = profiles.filter((p) => p.type === 'ARTIST' || p.type === 'VENUE');

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 640 }}>
      <h1>{t('payoutsPage.heading', 'Payouts')}</h1>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0 24px', borderBottom: '1px solid var(--line)' }}>
        {TABS.map((tabDef) => (
          <Link
            key={tabDef.id}
            href={`/payouts?tab=${tabDef.id}`}
            style={{
              padding: '10px 4px', marginRight: 16, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
              textDecoration: 'none', color: tab === tabDef.id ? 'var(--accent)' : 'var(--ink-a55)',
              borderBottom: tab === tabDef.id ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t(`payoutsPage.tab.${tabDef.id}`, tabDef.label)}
          </Link>
        ))}
      </div>

      {tab === 'history' && <PayoutsHistoryPanel pending={pending} released={released} />}
      {tab === 'settings' && <PayoutSettingsPanel profiles={settingsProfiles} stripeReady={stripeReady} />}
      {tab === 'show' && <PayoutShowsPanel shows={shows} />}
    </div>
  );
}
