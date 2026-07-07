import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  let body: { title?: string; description?: string; tracks?: unknown; published?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updated = await db.curatedPlaylist.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title).slice(0, 200) } : {}),
      ...(body.description !== undefined ? { description: String(body.description).slice(0, 1000) } : {}),
      ...(body.tracks !== undefined
        ? { tracks: Array.isArray(body.tracks) ? (body.tracks as Prisma.InputJsonArray) : [] }
        : {}),
      ...(body.published !== undefined ? { published: Boolean(body.published) } : {})
    }
  });

  return NextResponse.json({ playlist: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await db.curatedPlaylist.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
