import { db } from '@/lib/db';
import { AdvertisePage } from '@/components/AdvertisePage';

export const dynamic = 'force-dynamic';

export default async function MmmNewCampaignPage() {
  const now = new Date();
  const [activeCampaigns, decided, approved] = await Promise.all([
    db.ad.count({ where: { status: 'APPROVED', startsAt: { lte: now }, endsAt: { gte: now } } }).catch(() => 0),
    db.ad.count({ where: { status: { in: ['APPROVED', 'REJECTED'] } } }).catch(() => 0),
    db.ad.count({ where: { status: 'APPROVED' } }).catch(() => 0),
  ]);
  const clearedPct = decided > 0 ? Math.round((approved / decided) * 100) : null;
  return <AdvertisePage stats={{ activeCampaigns, clearedPct }} />;
}
