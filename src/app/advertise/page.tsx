import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { AdvertisePage } from '@/components/AdvertisePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Advertise · iHYPE',
  description: 'Reach music fans on iHYPE. Open to music-industry entities only — AI-vetted, transparent pricing.',
};

export default async function Page() {
  const now = new Date();
  const [activeCampaigns, decided, approved] = await Promise.all([
    db.ad.count({ where: { status: 'APPROVED', startsAt: { lte: now }, endsAt: { gte: now } } }).catch(() => 0),
    db.ad.count({ where: { status: { in: ['APPROVED', 'REJECTED'] } } }).catch(() => 0),
    db.ad.count({ where: { status: 'APPROVED' } }).catch(() => 0),
  ]);

  // Real numbers only — a young platform may have few campaigns yet, and
  // that's the honest state to show rather than inventing a bigger number.
  const clearedPct = decided > 0 ? Math.round((approved / decided) * 100) : null;

  return <AdvertisePage stats={{ activeCampaigns, clearedPct }} />;
}
