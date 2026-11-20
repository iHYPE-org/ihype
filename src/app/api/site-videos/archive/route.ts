import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { isR2VideoArchiveEnabled } from '@/lib/mux-video';
import { readRuntimeBinding } from '@/lib/runtime-env';
import { readMediaBucket, serveR2Object } from '@/lib/r2-object-response';

export const dynamic = 'force-dynamic';
const CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_PARTS = 256; // 2 GiB, same as the Mux uploader
const safeMime = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

type R2Multipart = {
  uploadId: string;
  uploadPart(part: number, body: ArrayBuffer): Promise<{ partNumber: number; etag: string }>;
  complete(parts: Array<{ partNumber: number; etag: string }>): Promise<unknown>;
  abort(): Promise<void>;
};
type ArchiveBucket = {
  createMultipartUpload(key: string, options?: { httpMetadata?: { contentType?: string } }): Promise<R2Multipart>;
  resumeMultipartUpload(key: string, uploadId: string): R2Multipart;
};
function archiveBucket(): ArchiveBucket | null {
  const bucket = readRuntimeBinding('R2') as ArchiveBucket | null;
  return bucket && typeof bucket.createMultipartUpload === 'function'
    && typeof bucket.resumeMultipartUpload === 'function' ? bucket : null;
}
async function ownedVideo(videoId: string, session: Awaited<ReturnType<typeof auth>>) {
  const video = await withDbRetry(() => db.profileVideo.findUnique({
    where: { id: videoId },
    include: { profile: { select: { ownerId: true, type: true } } },
  }));
  return video && ['ARTIST','VENUE'].includes(video.profile.type)
    && canManageOwnedResource(session, video.profile.ownerId) ? video : null;
}
const startSchema = z.object({
  action: z.literal('start'), videoId: z.string().min(1),
  mimeType: z.string().max(80),
}).strict();
const completeSchema = z.object({
  action: z.literal('complete'), videoId: z.string().min(1),
  parts: z.array(z.object({
    partNumber: z.number().int().min(1).max(MAX_PARTS),
    etag: z.string().min(1).max(100),
  }).strict()).min(1).max(MAX_PARTS),
}).strict();
const abortSchema = z.object({
  action: z.literal('abort'), videoId: z.string().min(1),
}).strict();
const postSchema = z.discriminatedUnion('action', [startSchema, completeSchema, abortSchema]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  if (!isR2VideoArchiveEnabled()) return NextResponse.json({ error: 'Original-file archiving is disabled.' }, { status: 503 });
  const bucket = archiveBucket();
  if (!bucket) return NextResponse.json({ error: 'R2 archive storage is unavailable.' }, { status: 503 });
  let body: z.infer<typeof postSchema>;
  try { body = postSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: 'Invalid archive request.' }, { status: 400 }); }
  const video = await ownedVideo(body.videoId, session);
  if (!video) return NextResponse.json({ error: 'Video unavailable.' }, { status: 404 });
  if (body.action === 'start') {
    if (video.archiveKey || video.archiveUploadId) {
      return NextResponse.json({ error: 'An original archive already exists. Abort an incomplete archive first.' }, { status: 409 });
    }
    if (!safeMime.includes(body.mimeType)) {
      return NextResponse.json({ error: 'Unsupported original file format.' }, { status: 400 });
    }
    const extension = body.mimeType === 'video/mp4' ? 'mp4' : body.mimeType === 'video/quicktime' ? 'mov'
      : body.mimeType === 'video/webm' ? 'webm' : 'mkv';
    const key = `video-originals/${video.profileId}/${video.id}.${extension}`;
    // This namespace is intentionally NOT present in PUBLIC_CDN_PREFIXES.
    const multipart = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: body.mimeType } });
    const claim = await db.profileVideo.updateMany({
      where: { id: video.id, archiveKey: null, archiveUploadId: null },
      data: { archiveKey: key, archiveUploadId: multipart.uploadId },
    });
    if (!claim.count) {
      await multipart.abort().catch(() => {});
      return NextResponse.json({ error: 'Archive already started.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }
  if (!video.archiveKey || !video.archiveUploadId) return NextResponse.json({ error: 'No archive is in progress.' }, { status: 409 });
  const multipart = bucket.resumeMultipartUpload(video.archiveKey, video.archiveUploadId);
  if (body.action === 'abort') {
    await multipart.abort();
    await db.profileVideo.update({
      where: { id: video.id }, data: { archiveKey: null, archiveUploadId: null },
    });
    return NextResponse.json({ ok: true });
  }
  // Require all parts in ascending consecutive order, and let R2 validate ETags.
  if (body.parts.some((part, index) => part.partNumber !== index + 1)) {
    return NextResponse.json({ error: 'Missing or unordered original-file chunks.' }, { status: 400 });
  }
  try {
    await multipart.complete(body.parts);
    await db.profileVideo.update({
      where: { id: video.id }, data: { archiveUploadId: null },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'R2 could not finish this archive. Retry or discard the incomplete copy.' }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  if (!isR2VideoArchiveEnabled()) return NextResponse.json({ error: 'Original-file archiving is disabled.' }, { status: 503 });
  const bucket = archiveBucket();
  if (!bucket) return NextResponse.json({ error: 'R2 unavailable.' }, { status: 503 });
  const url = new URL(request.url);
  const videoId = url.searchParams.get('videoId') ?? '';
  const partText = url.searchParams.get('part') ?? '';
  if (!/^\d{1,3}$/.test(partText)) return NextResponse.json({ error: 'Invalid chunk number.' }, { status: 400 });
  const part = Number(partText);
  if (part < 1 || part > MAX_PARTS) return NextResponse.json({ error: 'Invalid chunk number.' }, { status: 400 });
  const lengthText = request.headers.get('content-length');
  if (lengthText && Number(lengthText) > CHUNK_BYTES) {
    return NextResponse.json({ error: 'Archive chunks must be 8 MiB or less.' }, { status: 413 });
  }
  const video = await ownedVideo(videoId, session);
  if (!video || !video.archiveKey || !video.archiveUploadId) {
    return NextResponse.json({ error: 'No authorized archive.' }, { status: 404 });
  }
  // Bounded 8MiB chunk; never buffer an entire 4K video in a Worker.
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > CHUNK_BYTES) {
    return NextResponse.json({ error: 'Invalid chunk size.' }, { status: 413 });
  }
  try {
    const uploaded = await bucket.resumeMultipartUpload(video.archiveKey, video.archiveUploadId).uploadPart(part, bytes);
    return NextResponse.json({ partNumber: uploaded.partNumber, etag: uploaded.etag });
  } catch {
    return NextResponse.json({ error: 'This original-file chunk could not be stored.' }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const videoId = new URL(request.url).searchParams.get('videoId') ?? '';
  const video = await ownedVideo(videoId, session);
  if (!video || !video.archiveKey || video.archiveUploadId) {
    return NextResponse.json({ error: 'Original file not available.' }, { status: 404 });
  }
  const bucket = readMediaBucket();
  if (!bucket) return NextResponse.json({ error: 'Storage unavailable.' }, { status: 503 });
  return serveR2Object(bucket, video.archiveKey, request.headers.get('range'), object => ({
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="ihype-original-${video.id}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  }));
}
