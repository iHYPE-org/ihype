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

function isAllowedStorageUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (R2_STORAGE_HOST_RE.test(url.hostname)) return true;

  const configuredBase =
    process.env.R2_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL;
  if (!configuredBase) return false;

  try {
    const base = new URL(configuredBase);
    return url.origin === base.origin && url.pathname.startsWith('/cdn/');
  } catch {
    return false;
  }
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

  const upstream = await fetch(asset.storageUrl, {
    headers: rangeHeader ? { range: rangeHeader } : undefined,
    redirect: 'error',
  }).catch(() => null);

  if (!upstream || ![200, 206].includes(upstream.status) || !upstream.body) {
    return Response.json({ error: 'Media storage is temporarily unavailable.' }, { status: 502 });
  }

  const headers = new Headers({
    'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
    'Cache-Control': cacheControl,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Content-Type': upstream.headers.get('content-type') ?? asset.mimeType,
  });
  for (const header of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
