import { NextResponse } from 'next/server';
import { db, withDbRetry } from '@/lib/db';

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
  const { hexId } = await params;

  const asset = await withDbRetry(() =>
    db.artistMediaAsset.findUnique({
      where: { hexId },
      select: {
        originalFileName: true,
        mimeType: true,
        fileDataBase64: true
      }
    })
  );

  if (!asset) {
    return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
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
