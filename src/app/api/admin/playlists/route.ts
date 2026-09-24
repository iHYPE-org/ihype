import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

  let body: { title?: string; description?: string; tracks?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const playlist = await db.curatedPlaylist.create({
    data: {
      title: String(body.title).slice(0, 200),
      description: body.description ? String(body.description).slice(0, 1000) : null,
      createdBy: session!.user!.id!,
      tracks: Array.isArray(body.tracks) ? (body.tracks as Prisma.InputJsonArray) : [],
      published: false
    }
  });

  return NextResponse.json({ playlist }, { status: 201 });
}
