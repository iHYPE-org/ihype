import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const TIERS = ['premium', 'featured', 'standard'] as const;

export async function AdBanner({ showId }: { showId?: string } = {}) {
  const session = await auth();
  const userId = session?.user?.id;

  // Per-show frequency cap: default 3 impressions/day per user
  let dailyCap = 3;
  if (showId) {
    const config = await db.showAdvertisingConfig.findUnique({ where: { showId }, select: { enabled: true, frequency: true } });
    if (config && !config.enabled) return null;
    if (config?.frequency) dailyCap = config.frequency;
  }

  // If user is known, check today's impression count — hide ad if cap reached
  if (userId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await db.adImpression.count({ where: { userId, createdAt: { gte: since } } });
    if (todayCount >= dailyCap) return null;
  }

  // Pick ad: premium > featured > standard, fewest impressions first within tier.
  // Fetch top 10 per tier and filter out budget-exhausted ads in JS (Prisma can't
  // compare two columns in a WHERE clause without raw SQL).
  let ad: { id: string; advertiserName: string; adTextCopy: string; campaignWebsite: string; tier: string } | null = null;
  for (const tier of TIERS) {
    const candidates = await db.adSubmission.findMany({
      where: { status: 'approved', tier },
      orderBy: { impressions: 'asc' },
      take: 10,
      select: { id: true, advertiserName: true, adTextCopy: true, campaignWebsite: true, tier: true, budgetCents: true, spentCents: true },
    });
    const viable = candidates.find(a => a.budgetCents === 0 || a.spentCents < a.budgetCents);
    if (viable) { ad = viable; break; }
  }

  if (!ad) return null;

  const adId = ad.id;

  return (
    <aside className="panel" style={{ borderLeft: '3px solid var(--accent)', padding: '10px 14px' }}>
      {/* Inline impression ping fires on page load */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){fetch('/api/ads/${adId}/impression',{method:'POST'}).catch(function(){});})();`
        }}
      />
      <p className="meta" style={{ marginBottom: 4 }}>Supporter{ad.tier !== 'standard' ? ` · ${ad.tier}` : ''}</p>
      <p style={{ margin: 0 }}>
        {/* Click goes through /api/ads/[id]/click to track CTR before redirect */}
        <a href={`/api/ads/${adId}/click`} rel="noopener noreferrer" target="_blank">
          <strong>{ad.advertiserName}</strong>
        </a>
        {' — '}
        {ad.adTextCopy}
      </p>
    </aside>
  );
}
