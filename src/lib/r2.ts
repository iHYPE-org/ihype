function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

type R2BucketLike = {
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<void>;
  delete(key: string): Promise<void>;
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

export async function isR2StorageAvailable(): Promise<boolean> {
  return Boolean(await getR2Binding());
}

export type R2UploadResult = {
  provider: 'r2';
  key: string;
  url: string;
};

export async function uploadToR2({ file, path }: { file: File; path: string }): Promise<R2UploadResult> {
  const r2 = await getR2Binding();
  const publicBase = process.env.R2_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '';

  if (!r2) {
    throw new Error('R2 binding is not configured.');
  }

  await r2.put(path, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return { provider: 'r2', key: path, url: `${publicBase}/cdn/${path}` };
}

export async function deleteFromR2(key: string) {
  const r2 = await getR2Binding();
  if (!r2) throw new Error('R2 binding is not configured.');
  await r2.delete(key);
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
