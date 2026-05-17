import { db } from '@/lib/db';
import { AdImpressionPing } from '@/components/AdImpressionPing';

export async function AdBanner() {
  // Prefer premium > featured > standard
  let ad = await db.adSubmission.findFirst({
    where: { status: 'approved', tier: 'premium' },
    select: { id: true, advertiserName: true, adTextCopy: true, campaignWebsite: true, tier: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!ad) {
    ad = await db.adSubmission.findFirst({
      where: { status: 'approved', tier: 'featured' },
      select: { id: true, advertiserName: true, adTextCopy: true, campaignWebsite: true, tier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!ad) {
    const count = await db.adSubmission.count({ where: { status: 'approved' } });
    if (count === 0) return null;
    const skip = Math.floor(Math.random() * count);
    ad = await db.adSubmission.findFirst({
      where: { status: 'approved' },
      skip,
      select: { id: true, advertiserName: true, adTextCopy: true, campaignWebsite: true, tier: true },
    });
  }

  if (!ad) return null;

  return (
    <aside className="panel" style={{ borderLeft: '3px solid var(--accent)', padding: '10px 14px' }}>
      <AdImpressionPing id={ad.id} />
      <p className="meta" style={{ marginBottom: 4 }}>Supporter{ad.tier !== 'standard' ? ` · ${ad.tier}` : ''}</p>
      <p style={{ margin: 0 }}>
        <a href={ad.campaignWebsite} rel="noopener noreferrer" target="_blank">
          <strong>{ad.advertiserName}</strong>
        </a>
        {' — '}
        {ad.adTextCopy}
      </p>
    </aside>
  );
}
