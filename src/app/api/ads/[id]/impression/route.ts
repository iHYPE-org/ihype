import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// CPM rates in fractional cents per impression by tier
const CPM_CENTS: Record<string, number> = { premium: 32, featured: 16, standard: 9 };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  // Per-user 24h frequency cap: 3 impressions per ad per day
  if (userId) {
    const rl = await consumeRateLimit(`ad-sub-imp:${userId}:${id}`, { limit: 3, windowMs: 24 * 60 * 60 * 1000 });
    if (!rl.allowed) return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const ad = await db.adSubmission.findUnique({
      where: { id },
      select: { tier: true, budgetCents: true, spentCents: true },
    });
    if (!ad) return NextResponse.json({ ok: false }, { status: 404 });

    // Budget enforcement — skip if budget exhausted (0 = unlimited)
    if (ad.budgetCents > 0 && ad.spentCents >= ad.budgetCents) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'budget_exhausted' });
    }

    const spend = CPM_CENTS[ad.tier] ?? CPM_CENTS.standard;
    await db.adSubmission.update({
      where: { id },
      data: { impressions: { increment: 1 }, spentCents: { increment: spend } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
