import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vetAdvertisement } from '@/lib/ad-vetting';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  // Validate campaignWebsite is a proper http/https URL
  try {
    const parsed = new URL(campaignWebsite);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Campaign website must be an http or https URL.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Campaign website must be a valid URL.' }, { status: 400 });
  }

  let creativeAssetUrl: string | undefined;
  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Creative asset must be under 5 MB.' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Creative asset must be a JPEG, PNG, GIF, or WebP image.' }, { status: 400 });
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

  // Fire-and-forget admin alert
  import('@/lib/mailer').then(({ sendGenericEmail }) =>
    sendGenericEmail({ to: process.env.ADMIN_ALERT_EMAIL ?? 'admin@ihype.org', subject: `[iHYPE] New ad submission: ${advertiserName}`, text: `Tier: ${tier}\nType: ${advertiserType}\nWebsite: ${campaignWebsite}`, html: `<p><strong>${advertiserName}</strong> submitted a <strong>${tier}</strong> ad.</p><p>Website: ${campaignWebsite}</p><p><a href="${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org'}/admin/ads">Review in admin</a></p>` }).catch(() => {})
  );

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
