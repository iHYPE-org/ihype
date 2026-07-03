import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { AdminAdsClient } from '@/components/AdminAdsClient';

const PAGE_SIZE = 20;

export default async function AdminAdsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!isAdminSession(session)) redirect('/');

  const sp = searchParams ? await searchParams : {};
  const status = sp.status ?? '';
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) where.OR = [
    { advertiserName: { contains: q, mode: 'insensitive' } },
    { campaignWebsite: { contains: q, mode: 'insensitive' } },
  ];

  const [ads, total] = await Promise.all([
    db.adSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.adSubmission.count({ where }),
  ]);

  return (
    <main className="container section">
      <h1 className="title">Supporter Submissions <span className="meta">({total})</span></h1>
      <AdminAdsClient ads={ads} status={status} q={q} page={page} total={total} pageSize={PAGE_SIZE} />
    </main>
  );
}
