import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function proofBytesMatchType(bytes: Buffer, type: string): boolean {
  if (type === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'application/pdf') return bytes.length > 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-';
  return false;
}

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
    /* The bytes have to BE the type the client declared. Every other upload in
       the app sniffs its magic bytes and this one trusted `file.type` — the
       one field a client sets freely — so anything at all could be stored as
       "a PDF" and later opened by the admin (security sweep, 2026-09-02). */
    if (!proofBytesMatchType(buffer, file.type)) {
      return NextResponse.json({ error: 'File content does not match its type — upload the original JPEG, PNG or PDF.' }, { status: 400 });
    }
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    /* DELIBERATELY INLINE, AND NOT IN R2 (2026-08-31).
     *
     * This file is an identity or ownership document — a licence, a lease, a
     * passport page. Every other upload in this app is public by nature
     * (avatars, cover art, ad spots) and is served from `/cdn/<key>`, where the
     * key IS the credential: anyone holding it gets the bytes. That is fine for
     * a hero image and wrong for someone's ID.
     *
     * The route's own `/cdn` allowlist already refuses the `verification/`
     * prefix, but that is not sufficient on its own: this project's routes are
     * managed in the Cloudflare dashboard, and if an edge rule maps `/cdn/*`
     * straight to the bucket it answers before any code here runs. So the
     * document does not go into the bucket at all.
     *
     * Cost of keeping it inline: an ≤8 MB base64 column on the Profile row,
     * readable only by whoever can already read that row (the admin review
     * queue). Worth it. The upgrade, when someone wants it, is R2 plus an
     * admin-authenticated read route — not a public prefix. */
    proofUrl = dataUrl;
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
