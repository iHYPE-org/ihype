import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`dmca:${ip}`, { limit: 3, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });

  let body: { name?: string; email?: string; url?: string; description?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { name, email, url, description } = body;
  if (!name || !email || !url || !description) {
    return NextResponse.json({ error: 'name, email, url, and description are required.' }, { status: 400 });
  }

  const session = await auth();

  await recordAuditEvent({
    action: 'dmca_request',
    entityType: 'dmca',
    actorUserId: session?.user?.id ?? undefined,
    ipAddress: ip,
    metadata: {
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      url: String(url).slice(0, 500),
      description: String(description).slice(0, 5000)
    }
  });

  return NextResponse.json({ ok: true });
}
