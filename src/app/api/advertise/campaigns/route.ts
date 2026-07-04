import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vetAdvertisement, adCampaignStatusFromVetting } from '@/lib/ad-vetting';
import { recordAuditEvent } from '@/lib/audit';
import {
  isAdScope, isAdRunLengthDays, quoteAdCampaign,
  AD_SCOPE_LABELS, MIN_SPOTS_PER_DAY, MAX_SPOTS_PER_DAY,
} from '@/lib/ad-pricing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const campaigns = await db.ad.findMany({
    where: { advertiserId: session.user.id },
    include: { slot: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: {
    scope?: unknown; spotsPerDay?: unknown; runDays?: unknown;
    title?: unknown; audioUrl?: unknown; imageUrl?: unknown; clickUrl?: unknown;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title is required.' }, { status: 400 });

  if (!isAdScope(body.scope)) {
    return NextResponse.json({ error: 'scope must be one of LOCAL, REGIONAL, NATIONAL, GLOBAL.' }, { status: 400 });
  }
  const spotsPerDay = typeof body.spotsPerDay === 'number' ? body.spotsPerDay : NaN;
  if (!Number.isFinite(spotsPerDay) || spotsPerDay < MIN_SPOTS_PER_DAY || spotsPerDay > MAX_SPOTS_PER_DAY) {
    return NextResponse.json({ error: `spotsPerDay must be between ${MIN_SPOTS_PER_DAY} and ${MAX_SPOTS_PER_DAY}.` }, { status: 400 });
  }
  if (!isAdRunLengthDays(body.runDays)) {
    return NextResponse.json({ error: 'runDays must be one of 7, 14, 30, 90.' }, { status: 400 });
  }

  // Slot is resolved from the coverage tier, not chosen directly by the
  // client — the campaign builder only ever sells the four tier placements.
  const slot = await db.adSlot.findFirst({ where: { name: AD_SCOPE_LABELS[body.scope], active: true } });
  if (!slot) return NextResponse.json({ error: 'Ad slot not found for this coverage tier.' }, { status: 404 });

  // Budget and dates are computed server-side from scope/spots/days —
  // never trust a client-submitted price for what it's about to be charged.
  const quote = quoteAdCampaign(body.scope, spotsPerDay, body.runDays);
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + quote.runDays * 24 * 60 * 60 * 1000);

  // AI vetting (music-industry-only policy). Approvals go live without an
  // admin touch; only borderline submissions land in the manual queue.
  const clickUrl = typeof body.clickUrl === 'string' ? body.clickUrl : '';
  const vetting = await vetAdvertisement({
    advertiserName: session.user.name ?? session.user.email ?? 'Self-serve advertiser',
    advertiserType: `self-serve campaign in slot "${slot.name}"`,
    campaignWebsite: clickUrl,
    adTextCopy: title,
  });
  const status = adCampaignStatusFromVetting(vetting);

  const ad = await db.ad.create({
    data: {
      slotId: slot.id,
      advertiserId: session.user.id,
      title,
      scope: body.scope,
      audioUrl: typeof body.audioUrl === 'string' ? body.audioUrl : undefined,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
      clickUrl: typeof body.clickUrl === 'string' ? body.clickUrl : undefined,
      budgetCents: quote.totalCostCents,
      startsAt,
      endsAt,
      status,
    },
    include: { slot: { select: { name: true } } },
  });

  recordAuditEvent({
    actorUserId: session.user.id,
    action: `ad.campaign.auto_vetting.${status.toLowerCase()}`,
    entityType: 'Ad',
    entityId: ad.id,
    metadata: { reasoning: vetting.reasoning, quote },
  }).catch(() => {});

  return NextResponse.json({
    ad,
    quote,
    vetting: {
      status,
      reasoning: vetting.reasoning,
      message:
        status === 'APPROVED' ? 'Campaign passed automated vetting and is live.'
        : status === 'REJECTED' ? 'Campaign did not meet the music-industry supporter policy.'
        : 'Campaign is queued for manual review (within 48 hours).',
    },
  }, { status: 201 });
}
