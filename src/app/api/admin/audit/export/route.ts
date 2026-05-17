import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const action = url.searchParams.get('action')?.trim() || undefined;
  const actor = url.searchParams.get('actor')?.trim() || undefined;
  const entity = url.searchParams.get('entity')?.trim() || undefined;
  const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : undefined;
  const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (entity) where.entityType = entity;
  if (actor) {
    where.actor = {
      OR: [
        { email: { contains: actor, mode: 'insensitive' } },
        { username: { contains: actor, mode: 'insensitive' } }
      ]
    };
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {})
    };
  }

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
    include: { actor: { select: { email: true, username: true } } }
  });

  const lines: string[] = [
    ['createdAt', 'actor', 'action', 'entityType', 'entityId', 'ipAddress', 'metadata'].join(',')
  ];
  for (const r of rows) {
    lines.push([
      csvEscape(r.createdAt.toISOString()),
      csvEscape(r.actor?.username ?? r.actor?.email ?? 'system'),
      csvEscape(r.action),
      csvEscape(r.entityType),
      csvEscape(r.entityId ?? ''),
      csvEscape(r.ipAddress ?? ''),
      csvEscape(r.metadata ?? '')
    ].join(','));
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
