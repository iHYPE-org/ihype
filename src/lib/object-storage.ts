// Abstraction for media file storage.
// When R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME
// are set, uploads go to Cloudflare R2 via AWS Signature Version 4.
// Otherwise, files are base64-encoded and stored inline (dev/fallback only).

export type StoredObject = {
  key: string;
  url: string;
  storageType: 'r2' | 'inline';
};

// ── AWS Signature Version 4 helpers (Web Crypto — works on Cloudflare Workers) ──

const enc = new TextEncoder();

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signingKey(secretKey: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate    = await hmac(enc.encode(`AWS4${secretKey}`), date);
  const kRegion  = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function buildAuthHeader(
  method: string,
  url: URL,
  headers: Record<string, string>,
  payloadHash: string,
  accessKeyId: string,
  secretKey: string,
  region: string
): Promise<string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // yyyymmddTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  // Add required headers
  headers['x-amz-date'] = amzDate;
  headers['x-amz-content-sha256'] = payloadHash;
  headers['host'] = url.host;

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k.toLowerCase()}:${headers[k].trim()}\n`).join('');
  const signedHeaders = sortedKeys.map(k => k.toLowerCase()).join(';');

  const canonicalRequest = [
    method,
    url.pathname,
    url.search.slice(1), // remove leading '?'
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256hex(canonicalRequest)].join('\n');

  const key = await signingKey(secretKey, dateStamp, region, 's3');
  const signature = toHex(await hmac(key, stringToSign));

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// ── R2 operations ────────────────────────────────────────────────────────────

async function r2Request(
  method: string,
  key: string,
  body?: Buffer,
  contentType?: string
): Promise<Response> {
  const accountId   = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretKey   = process.env.R2_SECRET_ACCESS_KEY!;
  const bucket      = process.env.R2_BUCKET_NAME!;
  const region      = 'auto'; // R2 S3-compatible endpoint always uses 'auto'
  const endpoint    = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);

  const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const payloadHash  = body ? toHex(await crypto.subtle.digest('SHA-256', new Uint8Array(body))) : EMPTY_SHA256;

  const reqHeaders: Record<string, string> = {};
  if (contentType) reqHeaders['content-type'] = contentType;

  const authorization = await buildAuthHeader(method, endpoint, reqHeaders, payloadHash, accessKeyId, secretKey, region);

  return fetch(endpoint.toString(), {
    method,
    headers: { ...reqHeaders, Authorization: authorization },
    body: body as unknown as BodyInit | undefined
  });
}

async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<string> {
  const response = await r2Request('PUT', key, data, contentType);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 upload failed: ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }

  const accountId  = process.env.R2_ACCOUNT_ID!;
  const bucket     = process.env.R2_BUCKET_NAME!;
  const publicBase = process.env.R2_PUBLIC_URL ?? `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  return `${publicBase}/${key}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

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

  return { key, url: dataUrl, storageType: 'inline' };
}

export async function deleteMediaFile(key: string): Promise<void> {
  if (!isObjectStorageConfigured()) return;
  await r2Request('DELETE', key).catch(() => {});
}
