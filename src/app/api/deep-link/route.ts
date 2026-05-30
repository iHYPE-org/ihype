import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/utils';

// Only allow safe URL path characters — no quotes, angle brackets, or JS-breaking chars.
const SAFE_PATH_RE = /^[a-zA-Z0-9\-._~!$&'()*+,;=:@/%?#[\]]*$/;

function htmlEncode(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path') ?? '/';

  // Reject paths that don't match the safe allowlist to prevent XSS.
  if (!SAFE_PATH_RE.test(rawPath) || rawPath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
  }

  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const appScheme = `ihype://${encodeURIComponent(path.replace(/^\//, ''))}`;
  const webUrl = `${getBaseUrl()}${path}`;
  const safeWebUrl = htmlEncode(webUrl);
  const safeAppScheme = htmlEncode(appScheme);

  const ua = request.headers.get('user-agent') ?? '';
  const isMobile = /iPhone|iPad|Android/i.test(ua);
  if (isMobile) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="1;url=${safeWebUrl}"><script>window.location="${safeAppScheme}";setTimeout(function(){window.location="${safeWebUrl}"},1000)</script></head><body></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
  return NextResponse.redirect(webUrl);
}
