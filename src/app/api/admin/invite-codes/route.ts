import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { z } from 'zod';

function generateCode() {
  return randomBytes(6).toString('hex').toUpperCase();
}

export async function GET() {
  const session = await auth();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
  const session = await auth();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
          code: generateCode(),
          createdBy: session.user?.id,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
      })
    )
  );

  return NextResponse.json({ codes });
}
