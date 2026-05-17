import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { isAdminSession } from '@/lib/permissions';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { slug?: string; title?: string; excerpt?: string; body?: string; author?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 100) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const content = typeof body.body === 'string' ? body.body.trim().slice(0, 20000) : '';
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim().slice(0, 400) : '';
  const author = typeof body.author === 'string' ? body.author.trim().slice(0, 80) : (session.user.name ?? 'iHYPE');

  if (!slug || !title || !content) {
    return NextResponse.json({ error: 'slug, title, and body are required.' }, { status: 400 });
  }

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'editorial_post',
    entityType: 'journal',
    entityId: slug,
    ipAddress: readClientAddress(request),
    metadata: { slug, title, excerpt, body: content, author, publishedAt: new Date().toISOString() }
  });

  return NextResponse.json({ ok: true, slug });
}
