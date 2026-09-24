import { log } from '@/lib/logger';
import { isPublicCdnKey, readMediaBucket, serveR2Object } from '@/lib/r2-object-response';

const R2_STORAGE_HOST_RE = /^[a-z0-9-]+\.r2\.(?:cloudflarestorage\.com|dev)$/i;

type MediaAssetPayload = {
  originalFileName: string;
  mimeType: string;
  fileDataBase64: string | null;
  storageUrl: string | null;
};

type MediaResponseOptions = {
  cacheControl: string;
};

function safeFileName(value: string) {
  return value.replace(/[^\w.\-]+/g, '-');
}

function configuredStorageOrigin(): string | null {
  const configuredBase =
    process.env.R2_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL;
  if (!configuredBase) return null;
  try {
    return new URL(configuredBase).origin;
  } catch {
    return null;
  }
}

/**
 * The bucket key behind a storage URL this app itself serves at `/cdn/<key>`,
 * or null for anything else (a legacy r2.dev host, a foreign origin, a key
 * outside the public prefixes).
 */
function ownCdnKey(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.pathname.startsWith('/cdn/')) return null;
  const origin = configuredStorageOrigin();
  if (!origin || url.origin !== origin) return null;
  let key: string;
  try {
    key = url.pathname.slice('/cdn/'.length).split('/').map((segment) => decodeURIComponent(segment)).join('/');
  } catch {
    return null;
  }
  return isPublicCdnKey(key) ? key : null;
}

/* How long the storage fetch may take to answer with HEADERS. Not the body:
   an AbortSignal.timeout on the fetch would also cut a long track mid-stream,
   so the timer is cleared the moment the response arrives. */
const STORAGE_HEADERS_TIMEOUT_MS = 15_000;

function isAllowedStorageUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (R2_STORAGE_HOST_RE.test(url.hostname)) return true;

  const origin = configuredStorageOrigin();
  return Boolean(origin) && url.origin === origin && url.pathname.startsWith('/cdn/');
}

function parseRange(rangeHeader: string, totalBytes: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  if (!match[1] && !match[2]) return null;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(0, totalBytes - suffixLength),
      end: totalBytes - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : totalBytes - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= totalBytes
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, totalBytes - 1) };
}

export async function serveMediaAsset(
  request: Request,
  asset: MediaAssetPayload,
  { cacheControl }: MediaResponseOptions,
) {
  const fileName = safeFileName(asset.originalFileName);
  const rangeHeader = request.headers.get('range');

  if (asset.fileDataBase64) {
    const bytes = Buffer.from(asset.fileDataBase64, 'base64');
    const totalBytes = bytes.length;

    if (rangeHeader) {
      const range = parseRange(rangeHeader, totalBytes);
      if (!range) {
        return new Response(null, {
          status: 416,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes */${totalBytes}`,
            'Cache-Control': cacheControl,
          },
        });
      }

      return new Response(bytes.subarray(range.start, range.end + 1), {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Cache-Control': cacheControl,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Content-Length': String(range.end - range.start + 1),
          'Content-Range': `bytes ${range.start}-${range.end}/${totalBytes}`,
          'Content-Type': asset.mimeType,
          ETag: `"${fileName}-${totalBytes}"`,
        },
      });
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': String(totalBytes),
        'Content-Type': asset.mimeType,
        ETag: `"${fileName}-${totalBytes}"`,
      },
    });
  }

  if (!asset.storageUrl || !isAllowedStorageUrl(asset.storageUrl)) {
    return Response.json({ error: 'Media storage is not available for this asset.' }, { status: 410 });
  }

  const disposition = `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;

  /* OUR OWN `/cdn` OBJECT IS READ FROM THE BUCKET, NOT FETCHED (2026-09-24,
     DESIGN_SYNC row 513). This proxy used to fetch `https://ihype.org/cdn/...`
     like any other URL, and under `global_fetch_strictly_public` that request
     left the Worker and came back in as a second invocation, which then read
     the same R2 binding this one already holds. Every play and every seek on
     the deck paid two invocations and an extra public round trip. */
  const ownKey = ownCdnKey(asset.storageUrl);
  const bucket = ownKey ? readMediaBucket() : null;
  if (ownKey && bucket) {
    const served = await serveR2Object(bucket, ownKey, rangeHeader, (object) => ({
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'Content-Disposition': disposition,
      'Content-Type': object.httpMetadata?.contentType ?? asset.mimeType,
      ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
    }));
    if (served.status !== 404) return served;
    log.error('[media]', new Error(`R2 has no object at ${ownKey}`), 'Stored media is missing from the bucket');
    return Response.json({ error: 'Media storage is temporarily unavailable.' }, { status: 502 });
  }

  const controller = new AbortController();
  const headersTimer = setTimeout(() => controller.abort(), STORAGE_HEADERS_TIMEOUT_MS);
  const upstream = await fetch(asset.storageUrl, {
    headers: rangeHeader ? { range: rangeHeader } : undefined,
    redirect: 'error',
    signal: controller.signal,
  }).catch((error: unknown) => {
    log.error('[media]', error instanceof Error ? error : new Error(String(error)), 'Media storage fetch failed');
    return null;
  }).finally(() => clearTimeout(headersTimer));

  if (!upstream || ![200, 206].includes(upstream.status) || !upstream.body) {
    if (upstream) {
      log.error('[media]', new Error(`storage answered HTTP ${upstream.status}`), 'Media storage refused the read');
    }
    return Response.json({ error: 'Media storage is temporarily unavailable.' }, { status: 502 });
  }

  const headers = new Headers({
    'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
    'Cache-Control': cacheControl,
    'Content-Disposition': disposition,
    'Content-Type': upstream.headers.get('content-type') ?? asset.mimeType,
  });
  for (const header of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
