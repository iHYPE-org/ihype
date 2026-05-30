import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';

const ALLOWED_STORAGE_HOSTS_RE = /^[a-z0-9-]+\.r2\.cloudflarestorage\.com$|^[a-z0-9-]+\.r2\.dev$/i;

function buildRangeHeaders(start: number, end: number, totalBytes: number, mimeType: string, fileName: string) {
  return {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Content-Length': String(end - start + 1),
    'Content-Range': `bytes ${start}-${end}/${totalBytes}`,
    'Content-Type': mimeType,
    ETag: `"${fileName}-${totalBytes}-${start}-${end}"`
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hexId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { hexId } = await params;

  const asset = await withDbRetry(() =>
    db.artistMediaAsset.findUnique({
      where: { hexId },
      select: {
        originalFileName: true,
        mimeType: true,
        fileDataBase64: true,
        storageUrl: true
      }
    })
  );

  if (!asset) {
    return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
  }

  if (!asset.fileDataBase64) {
    if (asset.storageUrl) {
      let parsedUrl: URL;
      try { parsedUrl = new URL(asset.storageUrl); } catch {
        return NextResponse.json({ error: 'Media storage is not available for this asset.' }, { status: 410 });
      }
      if (parsedUrl.protocol !== 'https:' || !ALLOWED_STORAGE_HOSTS_RE.test(parsedUrl.hostname)) {
        return NextResponse.json({ error: 'Media storage is not available for this asset.' }, { status: 410 });
      }
      return NextResponse.redirect(asset.storageUrl);
    }

    return NextResponse.json({ error: 'Media storage is not available for this asset.' }, { status: 410 });
  }

  const bytes = Buffer.from(asset.fileDataBase64, 'base64');
  const totalBytes = bytes.length;
  const rangeHeader = request.headers.get('range');
  const safeFileName = asset.originalFileName.replace(/[^\w.\-]+/g, '-');

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes */${totalBytes}`
        }
      });
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : totalBytes - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= totalBytes) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes */${totalBytes}`
        }
      });
    }

    const normalizedEnd = Math.min(end, totalBytes - 1);

    return new NextResponse(bytes.subarray(start, normalizedEnd + 1), {
      status: 206,
      headers: buildRangeHeaders(start, normalizedEnd, totalBytes, asset.mimeType, safeFileName)
    });
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(safeFileName)}`,
      'Content-Length': String(totalBytes),
      'Content-Type': asset.mimeType,
      ETag: `"${safeFileName}-${totalBytes}"`
    }
  });
}
