import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { storeMediaFile, isObjectStorageConfigured } from '@/lib/object-storage';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

// Applicant-facing proof-of-identity submission — distinct from the admin
// review side (GET/PATCH /api/admin/verifications/[profileId]). Sets the
// same Profile.verificationStatus/verificationSubmittedAt fields the admin
// queue already reads, so no new review-side wiring was needed.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const rl = await consumeRateLimit(rateLimitKey('verify-submit', session.user.id, null), { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many submissions — try again later.' }, { status: 429 });

  const formData = await request.formData();
  const profileId = formData.get('profileId') as string | null;
  const name = (formData.get('name') as string | null)?.trim();
  const city = (formData.get('city') as string | null)?.trim();
  const genresRaw = (formData.get('genres') as string | null)?.trim();
  const link = (formData.get('link') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim();
  const file = formData.get('file') as File | null;

  if (!profileId || !name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Evidence is mandatory. Until now `file` was optional and no wizard sent
  // one — the venue and DJ onboarding steps rendered a "what counts as proof"
  // card and then POSTed name and city, so the entire verification flow was a
  // status flip with nothing for a reviewer to look at. A queue of claims with
  // no evidence is worse than no queue: it looks like diligence.
  //
  // Either a document or a link is enough. A link is often the stronger proof
  // for an artist or DJ (a Bandcamp page with published tracks says more than
  // a screenshot), and requiring a file upload would push people into
  // fabricating one.
  const hasFile = Boolean(file && file.size > 0);
  const hasLink = Boolean(link);
  if (!hasFile && !hasLink) {
    return NextResponse.json(
      { error: 'Attach a document or provide a link so we can verify this account.' },
      { status: 400 },
    );
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, ownerId: true, type: true, verificationStatus: true },
  });
  if (!profile || profile.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (profile.type === 'LISTENER') {
    return NextResponse.json({ error: 'Fan accounts do not require verification' }, { status: 400 });
  }
  if (profile.verificationStatus === 'VERIFIED') {
    return NextResponse.json({ error: 'Already verified' }, { status: 400 });
  }

  let proofUrl: string | null = null;
  if (file && file.size > 0) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be under 8 MB' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Must be a JPEG, PNG, or PDF' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    if (isObjectStorageConfigured()) {
      const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1];
      const key = `verification/${profile.id}/${crypto.randomUUID()}.${ext}`;
      const stored = await storeMediaFile(key, dataUrl, file.type);
      proofUrl = stored.url;
    } else {
      proofUrl = dataUrl;
    }
  }

  const genres = genresRaw ? genresRaw.split(',').map((g) => g.trim()).filter(Boolean) : undefined;

  await db.profile.update({
    where: { id: profile.id },
    data: {
      name,
      city: city || undefined,
      ...(genres && genres.length > 0 ? { genres } : {}),
      contactInfo: link || undefined,
      verificationNotes: notes || undefined,
      verificationProofUrl: proofUrl ?? undefined,
      verificationStatus: 'PENDING',
      verificationRequested: true,
      verificationSubmittedAt: new Date(),
    },
  });

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'verification_submitted',
    entityType: 'profile',
    entityId: profile.id,
    metadata: { type: profile.type },
  });

  return NextResponse.json({ submitted: true });
}
