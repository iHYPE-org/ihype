import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vetAdvertisement, vetAdAudioContent, adCampaignStatusFromVetting, type AdAudioVettingResult } from '@/lib/ad-vetting';
import { isTrustedStorageUrl } from '@/lib/object-storage';
import { checkAdSpotDuration } from '@/lib/ad-spot';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { recordAuditEvent } from '@/lib/audit';
import { notifyAdvertiser } from '@/lib/ad-campaign-notify';
import { createAdCampaignCheckoutSession, settleAdCampaign } from '@/lib/stripe';
import { describeSettlement, settlementRecord } from '@/lib/ad-settlement';
import { log } from '@/lib/logger';
import { deferWork } from '@/lib/defer-work';
import {
  isAdScope, isAdRunLengthDays, quoteAdCampaign,
  AD_SCOPE_LABELS, MIN_SPOTS_PER_DAY, MAX_SPOTS_PER_DAY,
} from '@/lib/ad-pricing';
import { isAdvertisingEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!(await isAdvertisingEnabledRuntime())) {
    return NextResponse.json({ error: 'New advertising campaigns are temporarily paused.' }, { status: 503 });
  }

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

  // The most expensive request in the application. A submission fetches the
  // spot's audio and runs vetAdAudioContent(): an ACRCloud identify call — a
  // paid, metered third-party API — plus Whisper transcription and a Llama
  // policy screen. /api/advertise/audio-upload is rate limited, but that only
  // caps how many files exist; a campaign can be submitted repeatedly against
  // the same already-uploaded, already-trusted URL, and each submission pays
  // for the whole pipeline again.
  //
  // 10/hour is generous for the real workflow — nobody legitimately files ten
  // campaigns in an hour — while leaving room to correct a rejected one.
  const rateLimit = await consumeRateLimit(
    rateLimitKey('advertise-campaign-create', session.user.id, readClientAddress(request)),
    { limit: 10, windowMs: 60 * 60 * 1000 },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many campaign submissions. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

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

  // Defence in depth. The authoritative length check is at upload, where the
  // file itself is measured; this only validates the duration the client then
  // declares. A spoofed value cannot smuggle a long spot past the upload gate,
  // but it could otherwise be STORED as a plausible-looking 20s on a campaign
  // whose audio is ninety — and `Ad.audioDurationSecs` is what the station
  // uses to size the break.
  const declaredDuration = typeof body.audioDurationSecs === 'number' ? body.audioDurationSecs : null;
  if (declaredDuration !== null) {
    const lengthCheck = checkAdSpotDuration(declaredDuration);
    if (!lengthCheck.ok) {
      return NextResponse.json({ error: lengthCheck.message }, { status: 400 });
    }
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

  // Budget is computed server-side from scope/spots/days — never trust a
  // client-submitted price for what it's about to be charged. startsAt/
  // endsAt are NOT resolved here — the campaign's purchased run starts when
  // the payment lands (see the AWAITING_PAYMENT handling below and the
  // webhook), so a campaign stuck in manual review or awaiting checkout
  // never loses run length to the wait.
  const quote = quoteAdCampaign(body.scope, spotsPerDay, body.runDays);

  // AI vetting (music-industry-only policy). Approvals go live without an
  // admin touch; only borderline submissions land in the manual queue.
  /* `clickUrl` is rendered as a link on the admin review screen and the
     advertiser's own dashboard, so it has to be an https URL of sane length —
     it was stored verbatim, any scheme, any size (security sweep, 2026-09-02). */
  const clickUrl = typeof body.clickUrl === 'string' ? body.clickUrl.trim() : '';
  if (clickUrl) {
    let parsedClick: URL | null = null;
    try { parsedClick = new URL(clickUrl); } catch { parsedClick = null; }
    if (!parsedClick || parsedClick.protocol !== 'https:' || clickUrl.length > 2048) {
      return NextResponse.json({ error: 'clickUrl must be an https URL.' }, { status: 400 });
    }
  }
  const vetting = await vetAdvertisement({
    advertiserName: session.user.name ?? session.user.email ?? 'Self-serve advertiser',
    advertiserType: `self-serve campaign in slot "${slot.name}"`,
    campaignWebsite: clickUrl,
    adTextCopy: title,
  });
  let status = adCampaignStatusFromVetting(vetting);
  let reasoning = vetting.reasoning;

  // Also screen what's actually said and played in the spot — vetAdvertisement
  // above only judges the declared title, which the advertiser writes.
  // audioUrl is already confirmed trusted-storage-only above (SSRF guard),
  // so fetching it back is safe.
  //
  // A fetch failure is NOT a pass. It used to be silently swallowed, leaving
  // audioVetting null and the campaign free to clear on its title alone —
  // and clearing is what authorises the budget on Stripe. If we cannot read
  // the file back, nobody has heard it, so it goes to /admin/ads.
  let audioVetting: AdAudioVettingResult;
  try {
    const audioRes = await fetch(audioUrl);
    if (audioRes.ok) {
      const audioBytes = new Uint8Array(await audioRes.arrayBuffer());
      audioVetting = await vetAdAudioContent(audioBytes);
    } else {
      audioVetting = {
        isApproved: false,
        requiresManualReview: true,
        reasoning: `Uploaded audio could not be read back for screening (HTTP ${audioRes.status}); it was never inspected.`,
        layers: [],
      };
    }
  } catch (error) {
    audioVetting = {
      isApproved: false,
      requiresManualReview: true,
      reasoning: `Uploaded audio could not be read back for screening (${
        error instanceof Error ? error.message : 'unknown error'
      }); it was never inspected.`,
      layers: [],
    };
  }
  if ((!audioVetting.isApproved || audioVetting.requiresManualReview) && status !== 'REJECTED') {
    status = 'PENDING';
    reasoning = `${reasoning} Audio spot flagged: ${audioVetting.reasoning}`;
  }

  // A vetting APPROVED doesn't mean live yet under pre-auth-then-capture
  // billing — it means "ready to authorize payment." Only the webhook
  // (on successful authorization) ever sets the stored status to APPROVED.
  // adCampaignStatusFromVetting only ever returns APPROVED/REJECTED/PENDING
  // in practice; narrow explicitly since its declared return type is the
  // full AdCampaignStatus union (which also covers CANCELLED/PAUSED, set
  // only by the PATCH handler below, never by vetting).
  const storedStatus = (status === 'APPROVED' ? 'AWAITING_PAYMENT' : status) as 'AWAITING_PAYMENT' | 'REJECTED' | 'PENDING';

  let ad = await db.ad.create({
    data: {
      slotId: slot.id,
      advertiserId: session.user.id,
      title,
      scope: body.scope,
      audioUrl,
      audioDurationSecs: typeof body.audioDurationSecs === 'number' && Number.isFinite(body.audioDurationSecs)
        ? Math.max(0, Math.round(body.audioDurationSecs))
        : undefined,
      clickUrl: clickUrl || undefined,
      budgetCents: quote.totalCostCents,
      runDays: quote.runDays,
      status: storedStatus,
    },
    include: { slot: { select: { name: true } } },
  });

  let checkoutUrl: string | null = null;
  if (storedStatus === 'AWAITING_PAYMENT') {
    try {
      const checkout = await createAdCampaignCheckoutSession({
        adId: ad.id,
        amountCents: quote.totalCostCents,
        title,
        advertiserEmail: session.user.email ?? null,
      });
      ad = await db.ad.update({
        where: { id: ad.id },
        data: { stripePaymentIntentId: checkout.paymentIntentId },
        include: { slot: { select: { name: true } } },
      });
      checkoutUrl = checkout.checkoutUrl;
    } catch (error) {
      log.error('[advertise/campaigns]', error instanceof Error ? error : null, 'Checkout session creation failed');
      // The Ad row stays AWAITING_PAYMENT with no stripePaymentIntentId —
      // the advertiser sees "pay for your campaign" fail rather than a
      // silently-live unpaid campaign. They can retry via the dashboard
      // (a future "Pay now" action) rather than losing the submission.
    }
  }

  recordAuditEvent({
    actorUserId: session.user.id,
    action: `ad.campaign.auto_vetting.${status.toLowerCase()}`,
    entityType: 'Ad',
    entityId: ad.id,
    metadata: { reasoning, quote },
  }).catch(() => {});

  if (!audioVetting.isApproved || audioVetting.requiresManualReview) {
    await db.contentReport.create({
      data: {
        targetType: 'ad-audio',
        targetId: ad.id,
        reason: 'auto_flag_audio',
        // Per-layer breakdown, not just the verdict: a reviewer needs to know
        // whether a layer objected or simply never ran.
        details: [
          audioVetting.reasoning,
          ...audioVetting.layers.map((l) => `[${l.name}] ${l.reasoning}`),
        ].join('\n').slice(0, 2000),
      },
    }).catch(() => {});
  }

  deferWork(notifyAdvertiser(
    session.user.id,
    session.user.email,
    title,
    storedStatus,
    reasoning,
    checkoutUrl ?? undefined,
  ), 'advertiser-campaign-notification');

  return NextResponse.json({
    ad,
    quote,
    checkoutUrl,
    vetting: {
      status: storedStatus,
      reasoning,
      message:
        storedStatus === 'AWAITING_PAYMENT'
          ? (checkoutUrl
              ? 'Campaign passed automated vetting — pay to go live. Unspent budget is refunded when the run ends.'
              : 'Campaign passed vetting, but starting checkout failed. Try again from your dashboard.')
        : storedStatus === 'REJECTED' ? 'Campaign did not meet the music-industry supporter policy.'
        : 'Campaign is queued for manual review (within 48 hours).',
    },
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: { id?: unknown; action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action;
  if (!id || (action !== 'cancel' && action !== 'pause' && action !== 'resume' && action !== 'retry-checkout')) {
    return NextResponse.json({ error: 'id and action: "cancel" | "pause" | "resume" | "retry-checkout" are required.' }, { status: 400 });
  }

  const ad = await db.ad.findUnique({
    where: { id },
    select: {
      advertiserId: true, status: true, endsAt: true, pausedAt: true, title: true,
      budgetCents: true, spentCents: true, stripePaymentIntentId: true, settledAt: true,
    },
  });
  if (!ad || ad.advertiserId !== session.user.id) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  }
  if (ad.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Campaign is already cancelled.' }, { status: 400 });
  }

  let updated;
  if (action === 'retry-checkout') {
    if (ad.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json({ error: 'Only a campaign awaiting payment can retry checkout.' }, { status: 400 });
    }
    // Always issues a fresh Checkout Session — the advertiser may be
    // retrying because they abandoned the first one, not just because
    // creation failed, so this must not be deduped against an earlier,
    // possibly-expired session with the same idempotency key.
    const checkout = await createAdCampaignCheckoutSession({
      adId: id,
      amountCents: ad.budgetCents,
      title: ad.title,
      advertiserEmail: session.user.email ?? null,
      idempotencyKey: `ad-checkout:${id}:${Date.now()}`,
    });
    updated = await db.ad.update({ where: { id }, data: { stripePaymentIntentId: checkout.paymentIntentId } });
    recordAuditEvent({
      actorUserId: session.user.id,
      action: 'ad.campaign.checkout_retried',
      entityType: 'Ad',
      entityId: id,
    }).catch(() => {});
    return NextResponse.json({ ad: updated, checkoutUrl: checkout.checkoutUrl });
  } else if (action === 'cancel') {
    // Cancelling early is a settlement, not just a status flip: the budget
    // was charged at checkout, so the unspent remainder goes back now (a
    // pre-2026-09-02 hold is captured for the spend or released instead —
    // see ad-settlement-plan.ts).
    let settlement: string | undefined;
    if (ad.stripePaymentIntentId && !ad.settledAt) {
      const { plan, refundId } = await settleAdCampaign(ad.stripePaymentIntentId, ad.spentCents, ad.budgetCents);
      settlement = describeSettlement(plan, false, refundId);
      updated = await db.ad.update({
        where: { id },
        data: { status: 'CANCELLED', pausedAt: null, settledAt: new Date(), ...settlementRecord(plan, refundId) },
      });
    } else {
      updated = await db.ad.update({ where: { id }, data: { status: 'CANCELLED', pausedAt: null } });
    }
    recordAuditEvent({
      actorUserId: session.user.id,
      action: 'ad.campaign.cancelled',
      entityType: 'Ad',
      entityId: id,
    }).catch(() => {});
    return NextResponse.json({ ad: updated, settlement });
  } else if (action === 'pause') {
    if (ad.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only a live campaign can be paused.' }, { status: 400 });
    }
    updated = await db.ad.update({ where: { id }, data: { status: 'PAUSED', pausedAt: new Date() } });
  } else {
    if (ad.status !== 'PAUSED') {
      return NextResponse.json({ error: 'Only a paused campaign can be resumed.' }, { status: 400 });
    }
    // Shift endsAt forward by exactly how long it was paused, so the
    // advertiser gets the full run length they paid for rather than losing
    // days to the pause.
    const pausedForMs = ad.pausedAt ? Date.now() - ad.pausedAt.getTime() : 0;
    const newEndsAt = ad.endsAt ? new Date(ad.endsAt.getTime() + pausedForMs) : undefined;
    updated = await db.ad.update({
      where: { id },
      data: { status: 'APPROVED', pausedAt: null, ...(newEndsAt ? { endsAt: newEndsAt } : {}) },
    });
  }

  recordAuditEvent({
    actorUserId: session.user.id,
    action: `ad.campaign.${action}d`,
    entityType: 'Ad',
    entityId: id,
  }).catch(() => {});

  return NextResponse.json({ ad: updated });
}
