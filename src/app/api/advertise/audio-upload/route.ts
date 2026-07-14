import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { validateAudioMagicBytes } from '@/lib/validate-upload';
import { parseAudioDuration } from '@/lib/audio-duration';
import { storeMediaFile, isObjectStorageConfigured } from '@/lib/object-storage';

export const dynamic = 'force-dynamic';

const MAX_AUDIO_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];

/**
 * Uploads the audio spot for a self-serve ad campaign (src/components/
 * AdvertisePage.tsx's Coverage Builder). Returns a URL the campaign create
 * call (POST /api/advertise/campaigns) then persists as Ad.audioUrl — this
 * is a separate step so the campaign route's existing JSON request shape
 * doesn't have to change.
 *
 * No AI content vetting here (unlike image/track uploads elsewhere) — there
 * is no audio-transcription/content-scan pipeline in this codebase yet.
 * Magic-byte + size validation only. This is a known, documented gap, not
 * an oversight.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const rl = await consumeRateLimit(`ad-audio-upload:${session.user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many uploads. Please wait before trying again.' }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_AUDIO_FILE_BYTES) return NextResponse.json({ error: 'Audio must be under 10 MB' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Must be MP3, WAV, OGG, FLAC, M4A, or AAC' }, { status: 400 });

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  if (!validateAudioMagicBytes(fileBytes)) {
    return NextResponse.json({ error: 'File content does not match a supported audio format' }, { status: 400 });
  }

  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: 'Ad audio storage is not configured.' }, { status: 503 });
  }

  const durationSecs = parseAudioDuration(fileBytes);
  const ext = file.type.split('/')[1]?.replace('x-', '') ?? 'audio';
  const key = `ads/audio/${crypto.randomUUID()}.${ext}`;
  const base64 = Buffer.from(fileBytes).toString('base64');
  const stored = await storeMediaFile(key, `data:${file.type};base64,${base64}`, file.type);

  return NextResponse.json({ url: stored.url, durationSecs });
}
