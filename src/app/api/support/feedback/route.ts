import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await auth();

  let body: { message?: string; category?: string; url?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const category = body.category ?? 'other';

  await db.supportRequest.create({
    data: {
      requesterUserId: session?.user?.id ?? null,
      type: category === 'bug' ? 'BUG_REPORT' : category === 'suggestion' ? 'SUGGESTION' : 'FEEDBACK',
      email: session?.user?.email ?? null,
      subject: `[${category}] In-app feedback`,
      details: `${message}\n\nURL: ${body.url ?? 'unknown'}`,
      priority: category === 'bug' ? 'HIGH' : 'NORMAL',
    },
  });

  return NextResponse.json({ submitted: true });
}
