import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
import { db } from '@/lib/db';
import { z } from 'zod';
// One generator, shared with the approve action on the access-request queue,
// so a code minted for a named requester and one minted in a batch here can
// never drift into different alphabets or lengths.
import { generateInviteCode } from '@/lib/access-requests';

export async function GET(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

  const codes = await db.inviteCode.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ codes });
}

const postSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const codes = await Promise.all(
    Array.from({ length: body.count }, () =>
      db.inviteCode.create({
        data: {
          code: generateInviteCode(),
          createdBy: session.user?.id,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
      })
    )
  );

  return NextResponse.json({ codes });
}
