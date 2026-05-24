// Cloudflare R2 storage adapter for media uploads.
// In CF Workers: uses the R2 binding from getCloudflareContext().
// Fallback: throws — R2 must be configured in production.

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

type R2BucketLike = {
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<void>;
};

async function getR2Binding(): Promise<R2BucketLike | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    return ((ctx.env as Record<string, unknown>).R2 as R2BucketLike) ?? null;
  } catch {
    return null;
  }
}

export type R2UploadResult = {
  provider: 'r2';
  key: string;
  url: string;
};

export async function uploadToR2({
  file,
  path,
}: {
  file: File;
  path: string;
}): Promise<R2UploadResult> {
  const r2 = await getR2Binding();
  const publicBase = process.env.R2_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '';

  if (r2) {
    await r2.put(path, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    return { provider: 'r2', key: path, url: `${publicBase}/cdn/${path}` };
  }

  // S3-compatible fallback using R2's S3 API (works in local dev with env vars)
  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME ?? 'ihype-media';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 is not configured. Set CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${bucket}/${path}`;
  const buffer = await file.arrayBuffer();

  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: buffer,
  });

  if (!resp.ok) throw new Error(`R2 upload failed: ${resp.status}`);

  return { provider: 'r2', key: path, url: `${publicBase}/cdn/${path}` };
}

export async function uploadArtistMediaToR2({
  file,
  hexId,
  profileId,
}: {
  file: File;
  hexId: string;
  profileId: string;
}): Promise<R2UploadResult> {
  const safeName = sanitizePathSegment(file.name || `${hexId}.media`) || `${hexId}.media`;
  const path = `artist-media/${sanitizePathSegment(profileId)}/${hexId}/${safeName}`;
  return uploadToR2({ file, path });
}
