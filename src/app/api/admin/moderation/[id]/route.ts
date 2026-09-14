import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { log } from '@/lib/logger';
import { enforceRemoval } from '@/lib/moderation-enforcement';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isAdminSession(session) || !session?.user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step-up auth: `approve` takes real, largely irreversible enforcement
    // action (cancels a show, unpublishes a track, soft-deletes a comment,
    // rejects an ad, clears a profile image) — a stolen admin session
    // shouldn't be able to tear down content without a fresh passkey check.
    // This is the ONLY route that decides a content report as of 2026-09-14
    // (DESIGN_SYNC row 458); every console surface posts here.
    const reauthed = await requireRecentAdminReauth(session.user.id);
    if (!reauthed) {
      return NextResponse.json({ requiresReauth: true }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await request.json() as { action?: unknown };
    if (action !== 'approve' && action !== 'dismiss') {
      // Previously any unrecognised value silently fell through to DISMISSED,
      // quietly closing a report nobody had actually decided on.
      return NextResponse.json({ error: 'action must be "approve" or "dismiss".' }, { status: 400 });
    }

    const report = await db.contentReport.findUnique({ where: { id }, select: { targetType: true, targetId: true, reason: true } });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'approve') {
      const outcome = await enforceRemoval(report.targetType, report.targetId, report.reason);
      if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: 409 });
    }

    await db.contentReport.update({ where: { id }, data: { status: action === 'approve' ? 'ACTIONED' : 'DISMISSED' } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[api/admin/moderation]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
