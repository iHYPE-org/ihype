import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { AdminNav } from '@/components/AdminNav';
import { ModerationActions } from '@/components/ModerationActions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type SearchParams = { status?: string; type?: string; page?: string };

export default async function ModerationPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/');

  const sp = (await searchParams) ?? {};
  const status = sp.status ?? 'OPEN';
  const type = sp.type ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  const where: Record<string, unknown> = { status };
  if (type) where.targetType = type;

  const [reports, total] = await Promise.all([
    db.contentReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: { id: true, reason: true, details: true, targetType: true, targetId: true, status: true, createdAt: true, reporter: { select: { username: true } } },
    }),
    db.contentReport.count({ where }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ status, ...(type ? { type } : {}), page: String(page), ...overrides });
    return `/admin/moderation?${p}`;
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <AdminNav active="moderation" />
      <h1>Content Moderation <span className="meta">({total} {status.toLowerCase()})</span></h1>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <select name="status" defaultValue={status} className="input" style={{ width: 140 }}>
          <option value="OPEN">Open</option>
          <option value="ACTIONED">Actioned</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        <select name="type" defaultValue={type} className="input" style={{ width: 140 }}>
          <option value="">All types</option>
          <option value="profile">Profile</option>
          <option value="show">Show</option>
          <option value="comment">Comment</option>
          <option value="track">Track</option>
        </select>
        <input type="hidden" name="page" value="1" />
        <button className="button" type="submit">Filter</button>
        {(status !== 'OPEN' || type) && <Link className="button secondary" href="/admin/moderation">Reset</Link>}
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports.length === 0 && <p className="meta">No reports found.</p>}
        {reports.map(r => (
          <div key={r.id} className="panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.targetType} · <span className="meta">{r.reason}</span></div>
                <div className="meta">{r.details}</div>
                <div className="meta">Reported by {r.reporter?.username ?? 'anonymous'} · {new Date(r.createdAt).toLocaleDateString()}</div>
                <div className="meta">Content ID: {r.targetId}</div>
              </div>
              {r.status === 'OPEN' && <ModerationActions reportId={r.id} />}
              {r.status !== 'OPEN' && <span className="badge">{r.status}</span>}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          {page > 1 && <Link className="button small secondary" href={qs({ page: String(page - 1) })}>← Prev</Link>}
          <span className="meta">Page {page} of {pages}</span>
          {page < pages && <Link className="button small secondary" href={qs({ page: String(page + 1) })}>Next →</Link>}
        </div>
      )}
    </div>
  );
}
