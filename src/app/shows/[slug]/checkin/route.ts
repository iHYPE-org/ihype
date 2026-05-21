import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return NextResponse.redirect(
    new URL(`/shows/${slug}?checkin=1`, getBaseUrl())
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to check in.' }, { status: 401 });
  }

  const { slug } = await params;
  const show = await db.show.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'show_checkin',
    entityType: 'show',
    entityId: show.id,
    metadata: { showSlug: slug }
  });

  return NextResponse.json({ ok: true, showId: show.id });
}
