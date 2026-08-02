import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { log } from '@/lib/logger';
import { z } from 'zod';

const diagnosticsSchema = z.object({
  appVersion: z.string().trim().min(1).max(40),
  errorId: z.string().trim().regex(/^[a-z0-9]{8,16}$/i),
  module: z.enum(['map', 'discover', 'radio', 'dashboard', 'settings', 'community', 'other']),
  platform: z.enum(['ios', 'android', 'windows', 'macos', 'linux', 'other']),
  viewport: z.enum(['compact', 'phone', 'tablet', 'desktop']),
}).strict();

const reportSchema = z.object({
  description: z.string().trim().min(1).max(2500),
  diagnostics: diagnosticsSchema.optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const ip = readClientAddress(request);
    const rl = await consumeRateLimit(`bug-report:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit.' }, { status: 429 });
    const session = await auth();
    const parsed = reportSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid bug report.' }, { status: 400 });
    await recordAuditEvent({
      actorUserId: session?.user?.id,
      action: 'bug_report',
      entityType: 'bug_report',
      entityId: parsed.data.diagnostics?.errorId,
      ipAddress: ip,
      metadata: {
        description: parsed.data.description,
        diagnostics: parsed.data.diagnostics,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[api/bug-report]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
