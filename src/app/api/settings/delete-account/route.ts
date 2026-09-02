import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { executeAccountErasure } from '@/lib/privacy-actions';
import { log } from '@/lib/logger';
import { readClientAddress } from '@/lib/request-meta';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(rateLimitKey('delete-account', session.user.id, ip), { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  let body: { confirm?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  if (body.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
  }

  /* ERASURE, NOT `db.user.delete()` (second security scan, 2026-09-02).
     `Show.creator`, `TicketOrder.show`, `Ticket.show` and
     `AccountsPayableEntry.show` all cascade, so a hard delete of an organiser
     destroyed every buyer's order and ticket for their shows and every other
     party's payable — money captured on Stripe with no row left to refund
     against. `executeAccountErasure` is the path privacy-actions.ts wrote for
     exactly this: personal rows go, PII in retained records is scrubbed, and
     the User row stays as an empty shell so the money records survive. It
     also drops every session, which is what signs the member out. */
  try {
    await executeAccountErasure(session.user.id, session.user.id);
  } catch (error) {
    log.error('[settings/delete-account]', error instanceof Error ? error : { error: String(error) }, 'account erasure failed');
    return NextResponse.json({ error: 'We could not delete the account. Please contact admin@ihype.org.' }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
