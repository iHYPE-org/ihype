// Abstraction for media file storage.
//
// Uploads go to the Cloudflare R2 bucket through the Worker's `R2` BINDING —
// declared in wrangler.toml as `[[r2_buckets]] binding = "R2"`. When the
// binding is absent (local dev, build, tests, plain Node) files are
// base64-encoded and returned inline instead.
//
// THIS USED TO SIGN S3 REQUESTS WITH SIGV4 AND FOUR R2_* CREDENTIALS, AND THAT
// PATH WAS DEAD IN PRODUCTION THE ENTIRE TIME (rewritten 2026-08-31).
// `wrangler secret list` on the live Worker returns 22 secrets and not one of
// them is an R2 credential; none is a `[vars]` entry either. So
// `isObjectStorageConfigured()` had always answered false, and the failure was
// silent by construction: every caller has a fallback, so profile images,
// track artwork and verification documents were being base64'd into Postgres
// rows, while `/api/advertise/audio-upload` — the one caller with no fallback —
// answered 503 and made ad campaigns impossible to create.
//
// The binding needs no credentials at all, and the app already had one: the
// sibling `src/lib/r2.ts` has been using it successfully for track audio the
// whole time. Two storage implementations where one worked and one was dead is
// what made this survive so long — the big files went through the live one.
//
// Do not reintroduce the credential path. If R2 ever needs reaching from
// outside a Worker request, that is a different module with a different name.

import { readRuntimeBinding } from '@/lib/runtime-env';

export type StoredObject = {
  key: string;
  url: string;
  storageType: 'r2' | 'inline';
};

/** The subset of Cloudflare's R2Bucket this module uses. */
type R2BucketLike = {
  put(
    key: string,
    value: ArrayBuffer,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

function getBucket(): R2BucketLike | null {
  const binding = readRuntimeBinding('R2');
  if (!binding || typeof binding !== 'object') return null;
  const candidate = binding as Partial<R2BucketLike>;
  return typeof candidate.put === 'function' && typeof candidate.delete === 'function'
    ? (binding as R2BucketLike)
    : null;
}

/**
 * The origin public object URLs are built on.
 *
 * `R2_PUBLIC_BASE_URL`, not `R2_PUBLIC_URL` — the old code read the latter,
 * which is not set anywhere in this project and never was, while the former is
 * a real `[vars]` entry in wrangler.toml and is what `src/lib/r2.ts` already
 * uses. Two names for one value, one of them fictional.
 */
function publicBase(): string {
  return (
    process.env.R2_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    ''
  ).replace(/\/$/, '');
}

/** The path objects are served from — see src/app/cdn/[...key]/route.ts. */
export const CDN_PREFIX = '/cdn/';

export function objectPublicUrl(key: string): string {
  return `${publicBase()}${CDN_PREFIX}${key}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Whether a real bucket is reachable. Synchronous on purpose: every call site
 * branches on it inline, and `readRuntimeBinding` resolves the Cloudflare
 * context synchronously the same way `readRuntimeEnv` does.
 */
export function isObjectStorageConfigured(): boolean {
  return getBucket() !== null;
}

/**
 * True only for URLs this app itself generated via storeMediaFile() — an
 * object served from our own `/cdn/` path, a direct R2 host, or an inline
 * `data:` URL. Used to gate any server-side fetch() of a client-submitted
 * "url" field (e.g. re-fetching an uploaded ad's audio for content vetting) so
 * a client can never point the server at an arbitrary internal/external URL
 * (SSRF).
 *
 * The `/cdn/` arm is new with the binding rewrite; the R2 host arm is kept
 * because rows written before it still carry those URLs.
 */
export function isTrustedStorageUrl(url: string): boolean {
  if (url.startsWith('data:')) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // A bucket's own hostname: <account>.r2.cloudflarestorage.com or *.r2.dev.
  // Always https — these are public Cloudflare endpoints and nothing else.
  if (
    parsed.protocol === 'https:' &&
    /^[a-z0-9-]+\.r2\.(?:cloudflarestorage\.com|dev)$/i.test(parsed.hostname)
  ) {
    return true;
  }

  const base = publicBase();
  if (!base) return false;
  try {
    const baseUrl = new URL(base);
    /* Exact ORIGIN match, which includes the scheme — so this trusts our own
       site and nothing else: https in production, http on a dev box, and
       `http://ihype.org/...` still refused when the configured base is https.
       An earlier version rejected every non-https URL before reaching here,
       which was correct for the R2 arm above and wrong for this one: it made
       the app distrust its own uploads in local development, so a campaign
       could not be created against a locally uploaded spot.
       The `/cdn/` requirement is the important half — origin alone would trust
       every route on the site, which is most of the SSRF surface this exists
       to close. */
    return parsed.origin === baseUrl.origin && parsed.pathname.startsWith(CDN_PREFIX);
  } catch {
    return false;
  }
}

export async function storeMediaFile(
  key: string,
  dataUrl: string,
  contentType: string
): Promise<StoredObject> {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const buffer = Buffer.from(base64, 'base64');

  const bucket = getBucket();
  if (!bucket) return { key, url: dataUrl, storageType: 'inline' };

  await bucket.put(key, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, {
    httpMetadata: { contentType },
  });
  return { key, url: objectPublicUrl(key), storageType: 'r2' };
}

export async function deleteMediaFile(key: string): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  // Best-effort: a delete that fails must not fail the caller's request, which
  // is usually a moderation or cleanup action that has already succeeded.
  await Promise.resolve(bucket.delete(key)).catch(() => {});
}
