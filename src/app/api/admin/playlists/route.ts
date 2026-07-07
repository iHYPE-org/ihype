import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const playlists = await db.curatedPlaylist.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ playlists });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
