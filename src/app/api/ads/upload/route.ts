import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vetAdvertisement, adSubmissionStatusFromVetting } from '@/lib/ad-vetting';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { getBaseUrl } from '@/lib/utils';
import { ADMIN_EMAIL } from '@/lib/env';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function validateImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4) return false;
  if (mimeType === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mimeType === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mimeType === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (mimeType === 'image/webp') return buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  return false;
}

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
  } catch (err) {
    console.error('[ads/upload]', err);
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
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateImageMagicBytes(buffer, file.type)) {
      return NextResponse.json({ error: 'Creative asset content does not match the declared image type.' }, { status: 400 });
    }
    const { storeMediaFile, isObjectStorageConfigured } = await import('@/lib/object-storage');
    if (!isObjectStorageConfigured()) {
      return NextResponse.json({ error: 'Creative asset storage is not configured.' }, { status: 503 });
    }
    const ext = file.type.split('/')[1] ?? 'bin';
    const key = `ads/${crypto.randomUUID()}.${ext}`;
    const base64 = buffer.toString('base64');
    const stored = await storeMediaFile(key, `data:${file.type};base64,${base64}`, file.type);
    creativeAssetUrl = stored.url;
  }

  const vettingResult = await vetAdvertisement({
    advertiserName,
    advertiserType: advertiserType ?? 'other',
    campaignWebsite,
    adTextCopy,
  });

  const status = adSubmissionStatusFromVetting(vettingResult);

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
    sendGenericEmail({ to: ADMIN_EMAIL, subject: `[iHYPE] New ad submission: ${advertiserName}`, text: `Tier: ${tier}\nType: ${advertiserType}\nWebsite: ${campaignWebsite}`, html: `<p><strong>${advertiserName}</strong> submitted a <strong>${tier}</strong> ad.</p><p>Website: ${campaignWebsite}</p><p><a href="${getBaseUrl()}/admin/ads">Review in admin</a></p>` }).catch(() => {})
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
