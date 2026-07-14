import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vetAdvertisement, vetAdAudioContent, adCampaignStatusFromVetting } from '@/lib/ad-vetting';
import { isTrustedStorageUrl } from '@/lib/object-storage';
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
    title?: unknown; audioUrl?: unknown; audioDurationSecs?: unknown; clickUrl?: unknown;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title is required.' }, { status: 400 });

  // iHYPE only ever runs radio-style audio spots — no visual/image ad
  // placements — so a campaign isn't a campaign without one. Uploaded via
  // POST /api/advertise/audio-upload first.
  const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl.trim() : '';
  if (!audioUrl) return NextResponse.json({ error: 'audioUrl is required — upload your ad audio first.' }, { status: 400 });
  // Must be a URL this app itself generated (POST /api/advertise/audio-upload)
  // — never fetch an arbitrary client-submitted URL server-side (SSRF).
  if (!isTrustedStorageUrl(audioUrl)) {
    return NextResponse.json({ error: 'audioUrl must come from /api/advertise/audio-upload.' }, { status: 400 });
  }

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
  let status = adCampaignStatusFromVetting(vetting);
  let reasoning = vetting.reasoning;

  // Also screen what's actually said in the spot — vetAdvertisement above
  // only judges the declared title, never the audio content itself.
  // audioUrl is already confirmed trusted-storage-only above (SSRF guard),
  // so fetching it back is safe. Best-effort beyond that: a fetch failure
  // (e.g. the inline data: URL fallback used when object storage isn't
  // configured) fails open, same as every other vetting call in this
  // codebase.
  let audioVetting: { isApproved: boolean; reasoning: string; requiresManualReview: boolean } | null = null;
  try {
    const audioRes = await fetch(audioUrl);
    if (audioRes.ok) {
      const audioBytes = new Uint8Array(await audioRes.arrayBuffer());
      audioVetting = await vetAdAudioContent(audioBytes);
    }
  } catch {
    // Fail open — audio vetting is best-effort, not a hard gate.
  }
  if (audioVetting && (!audioVetting.isApproved || audioVetting.requiresManualReview) && status !== 'REJECTED') {
    status = 'PENDING';
    reasoning = `${reasoning} Audio spot flagged: ${audioVetting.reasoning}`;
  }

  const ad = await db.ad.create({
    data: {
      slotId: slot.id,
      advertiserId: session.user.id,
      title,
      scope: body.scope,
      audioUrl,
      audioDurationSecs: typeof body.audioDurationSecs === 'number' && Number.isFinite(body.audioDurationSecs)
        ? Math.max(0, Math.round(body.audioDurationSecs))
        : undefined,
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
    metadata: { reasoning, quote },
  }).catch(() => {});

  if (audioVetting && (!audioVetting.isApproved || audioVetting.requiresManualReview)) {
    await db.contentReport.create({
      data: {
        targetType: 'ad-audio',
        targetId: ad.id,
        reason: 'auto_flag_audio',
        details: audioVetting.reasoning,
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    ad,
    quote,
    vetting: {
      status,
      reasoning,
      message:
        status === 'APPROVED' ? 'Campaign passed automated vetting and is live.'
        : status === 'REJECTED' ? 'Campaign did not meet the music-industry supporter policy.'
        : 'Campaign is queued for manual review (within 48 hours).',
    },
  }, { status: 201 });
}
