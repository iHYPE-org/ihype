import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const ip = readClientAddress(request);
    const rl = await consumeRateLimit(`bug-report:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit.' }, { status: 429 });
    const session = await auth();
    const { description, url, errors, viewport } = await request.json() as { description?: string; url?: string; errors?: string[]; viewport?: string };
    if (!description?.trim()) return NextResponse.json({ error: 'Description required.' }, { status: 400 });
    await recordAuditEvent({ actorUserId: session?.user?.id, action: 'bug_report', entityType: 'bug_report', ipAddress: ip, metadata: { description: description.trim(), url, errors, viewport } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/bug-report] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
