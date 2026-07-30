import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { storeMediaFile, isObjectStorageConfigured } from '@/lib/object-storage';
import { vetImageUpload } from '@/lib/image-vetting';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { areUploadsEnabledRuntime } from '@/lib/runtime-flags';
import { exceedsDeclaredRequestSize } from '@/lib/request-size';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FIELDS = new Set(['heroImage', 'avatarImage', 'logoImage', 'galleryImage']);

function validateMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 4) return false;
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (mime === 'image/webp') return buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  return false;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  if (!(await areUploadsEnabledRuntime())) {
    return NextResponse.json({ error: 'Uploads are temporarily paused.' }, { status: 503 });
  }
  if (exceedsDeclaredRequestSize(request, MAX_BYTES + 1024 * 1024)) {
    return NextResponse.json({ error: 'Upload request is limited to 9MB.' }, { status: 413 });
  }

  const profile = await db.profile.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Every accepted upload runs vetImageUpload(), which calls a Workers AI
  // vision model, and then writes to R2. Both cost money per request, and
  // neither was metered — a signed-in account could loop 8 MB uploads
  // indefinitely. The sibling upload route (/api/artist-media) has always had
  // this guard; its absence here was an oversight, not a decision, so the
  // budget matches: 20/hour.
  //
  // Checked before request.formData() on purpose. Reading the body first
  // would mean buffering up to 8 MB before deciding to refuse it, which hands
  // back most of the protection.
  const rateLimit = await consumeRateLimit(
    rateLimitKey('profile-graphic-upload', session.user.id, readClientAddress(request)),
    { limit: 20, windowMs: 60 * 60 * 1000 },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const field = formData.get('field') as string | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be under 8 MB' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Must be JPEG, PNG, GIF, or WebP' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json({ error: 'File content does not match declared type' }, { status: 400 });
  }

  const knownField = field && ALLOWED_FIELDS.has(field) ? field : null;
  const vetting = await vetImageUpload(new Uint8Array(buffer), knownField ?? 'profile image');
  if (!vetting.cleared) {
    // Field name is folded into `reason` (rather than a schema change) so the
    // moderation "approve" action knows exactly which Profile column to
    // clear — see enforceRemoval() in the moderation PATCH route.
    await db.contentReport.create({
      data: {
        targetType: 'profile-image',
        targetId: profile.id,
        reason: knownField ? `auto_flag_image:${knownField}` : 'auto_flag_image',
        details: vetting.reasoning,
      },
    }).catch(() => {});
  }

  const base64 = buffer.toString('base64');
  const dataUrl = `data:${file.type};base64,${base64}`;

  let url: string;
  if (isObjectStorageConfigured()) {
    const ext = file.type.split('/')[1] ?? 'bin';
    const key = `profile/${profile.id}/graphics/${crypto.randomUUID()}.${ext}`;
    const stored = await storeMediaFile(key, dataUrl, file.type);
    url = stored.url;
  } else {
    url = dataUrl;
  }

  if (field && ALLOWED_FIELDS.has(field)) {
    await db.profile.update({
      where: { id: profile.id },
      data: { [field]: url },
    });
  }

  return NextResponse.json({ url });
}
