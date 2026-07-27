import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { AdminAdsClient } from '@/components/AdminAdsClient';
import { getLocale, getT } from '@/lib/i18n/server';

const PAGE_SIZE = 20;

// Reviews real, purchased self-serve radio ad campaigns (the Ad/AdSlot
// Coverage Builder pipeline — src/app/api/advertise/campaigns). This used to
// review the separate AdSubmission "Supporter" pipeline (text/image banner
// ads), which was retired — iHYPE only ever runs radio-style audio spots.
export default async function AdminAdsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!isAdminSession(session)) redirect('/');
  const t = getT(await getLocale());

  const sp = searchParams ? await searchParams : {};
  const status = sp.status ?? '';
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) where.OR = [
    { title: { contains: q, mode: 'insensitive' } },
    { clickUrl: { contains: q, mode: 'insensitive' } },
  ];

  const [ads, total] = await Promise.all([
    db.ad.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { advertiser: { select: { name: true, email: true } }, slot: { select: { name: true } } },
    }),
    db.ad.count({ where }),
  ]);

  return (
    <div className="container section">
      <h1 className="title">{t('adminAdsPage.title', 'Radio Ad Campaigns')} <span className="meta">({total})</span></h1>
      <AdminAdsClient ads={ads} status={status} q={q} page={page} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
