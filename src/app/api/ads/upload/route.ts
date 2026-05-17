import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vetAdvertisement } from '@/lib/ad-vetting';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`ad-upload:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many submissions. Please wait before trying again.' }, { status: 429 });
  }

  const formData = await request.formData();
  const advertiserName = formData.get('advertiserName') as string | null;
  const advertiserType = formData.get('advertiserType') as string | null;
  const campaignWebsite = formData.get('campaignWebsite') as string | null;
  const adTextCopy = formData.get('adTextCopy') as string | null;
  const file = formData.get('creativeAsset') as File | null;
  const tierRaw = formData.get('tier') as string | null;
  const tier = ['standard', 'featured', 'premium'].includes(tierRaw ?? '') ? (tierRaw as string) : 'standard';

  if (!advertiserName || !adTextCopy || !campaignWebsite) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  if (adTextCopy.length > 280) {
    return NextResponse.json({ error: 'Ad copy must be 280 characters or fewer.' }, { status: 400 });
  }

  let creativeAssetUrl: string | undefined;
  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Creative asset must be under 5 MB.' }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    creativeAssetUrl = `data:${file.type};base64,${base64}`;
  }

  const vettingResult = await vetAdvertisement({
    advertiserName,
    advertiserType: advertiserType ?? 'other',
    campaignWebsite,
    adTextCopy,
  });

  let status: string;
  if (vettingResult.requiresManualReview) {
    status = 'manual_review';
  } else if (vettingResult.isApproved) {
    status = 'approved';
  } else {
    status = 'rejected';
  }

  const submission = await db.adSubmission.create({
    data: {
      advertiserName,
      advertiserType: advertiserType ?? 'other',
      campaignWebsite,
      adTextCopy,
      creativeAssetUrl,
      status,
      aiReasoning: vettingResult.reasoning,
      tier,
    },
  });

  if (status === 'rejected') {
    return NextResponse.json({
      status: 'REJECTED',
      message: 'Submission did not meet our music-industry supporter policy.',
      reason: vettingResult.reasoning,
    }, { status: 403 });
  }

  return NextResponse.json({
    status: status === 'manual_review' ? 'UNDER_REVIEW' : 'APPROVED',
    message: status === 'manual_review'
      ? 'Your submission is under review and will be processed within 48 hours.'
      : 'Submission passed automated vetting and is now live.',
    reasoning: vettingResult.reasoning,
    adId: submission.id,
  }, { status: 201 });
}
