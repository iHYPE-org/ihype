import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

type LinkItem = { label: string; url: string };

function isValidLink(item: unknown): item is LinkItem {
  if (typeof item !== 'object' || item === null) return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.label === 'string' &&
    o.label.length > 0 &&
    o.label.length <= 100 &&
    typeof o.url === 'string' &&
    o.url.startsWith('https://')
  );
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { profileId?: string; links?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  if (!profileId) {
    return NextResponse.json({ error: 'profileId required.' }, { status: 400 });
  }

  if (!Array.isArray(body.links)) {
    return NextResponse.json({ error: 'links must be an array.' }, { status: 400 });
  }

  if (body.links.length > 5) {
    return NextResponse.json({ error: 'Maximum 5 links allowed.' }, { status: 400 });
  }

  for (const item of body.links) {
    if (!isValidLink(item)) {
      return NextResponse.json(
        { error: 'Each link must have a label and a url starting with https://.' },
        { status: 400 }
      );
    }
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, ownerId: true }
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

  if (!isAdminSession(session) && session.user.id !== profile.ownerId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const links = body.links as LinkItem[];
  await db.profile.update({
    where: { id: profileId },
    data: { links: JSON.stringify(links) }
  });

  return NextResponse.json({ ok: true, links });
}
