import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { isAdminSession } from '@/lib/permissions';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['update', 'announcement'] as const;

/**
 * Publishes a Community update — mirrors /api/journal/editorial's pattern
 * exactly (editorial posts already write to AuditLog "so we don't need new
 * tables", per that route's own admin page copy). Powers /community, the
 * "communications + changes" half of the Menu > Community section — voting
 * is the existing /feedback feature-request board, linked from that page
 * rather than duplicated here.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { slug?: string; title?: string; summary?: string; body?: string; category?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 100) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const content = typeof body.body === 'string' ? body.body.trim().slice(0, 20000) : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 400) : '';
  const category = CATEGORIES.includes(body.category as (typeof CATEGORIES)[number]) ? body.category : 'update';

  if (!slug || !title || !content) {
    return NextResponse.json({ error: 'slug, title, and body are required.' }, { status: 400 });
  }

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'community_update',
    entityType: 'community',
    entityId: slug,
    ipAddress: readClientAddress(request),
    metadata: {
      slug,
      title,
      summary,
      body: content,
      category,
      author: session.user.name ?? 'iHYPE',
      publishedAt: new Date().toISOString()
    }
  });

  return NextResponse.json({ ok: true, slug });
}
