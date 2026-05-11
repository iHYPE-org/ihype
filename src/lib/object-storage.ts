// Abstraction for media file storage.
// When R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME
// are set, uploads go to Cloudflare R2. Otherwise, files are base64-encoded
// and stored inline (development/fallback only).

export type StoredObject = {
  key: string;
  url: string;
  storageType: 'r2' | 'inline';
};

async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<string> {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const bucket = process.env.R2_BUCKET_NAME!;
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;

  // Cloudflare R2 supports S3-compatible PUT uploads
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}`, // placeholder — use @aws-sdk/client-s3 in production
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
    },
    body: data as unknown as BodyInit
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.status} ${response.statusText}`);
  }

  const publicBase = process.env.R2_PUBLIC_URL ?? `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  return `${publicBase}/${key}`;
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export async function storeMediaFile(
  key: string,
  dataUrl: string,
  contentType: string
): Promise<StoredObject> {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const buffer = Buffer.from(base64, 'base64');

  if (isObjectStorageConfigured()) {
    const url = await uploadToR2(key, buffer, contentType);
    return { key, url, storageType: 'r2' };
  }

  // Inline fallback — store the original dataUrl
  return { key, url: dataUrl, storageType: 'inline' };
}

export async function deleteMediaFile(key: string): Promise<void> {
  if (!isObjectStorageConfigured()) return;

  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const bucket = process.env.R2_BUCKET_NAME!;
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;

  await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}`,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
    }
  });
}
