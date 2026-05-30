import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/utils';

// Only allow safe URL path characters — no quotes, angle brackets, or JS-breaking chars.
// Note: ' is excluded so single-quote JS strings stay safe; " is excluded for HTML attributes.
const SAFE_PATH_RE = /^[a-zA-Z0-9\-._~!$&()*+,;=:@/%?#[\]]*$/;

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path') ?? '/';

  // Reject paths that don't match the safe allowlist to prevent XSS.
  if (!SAFE_PATH_RE.test(rawPath) || rawPath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
  }

  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  // Do NOT encode the path — deep link schemes need the raw slashes intact.
  const appScheme = `ihype://${path.replace(/^\//, '')}`;
  const webUrl = `${getBaseUrl()}${path}`;

  const ua = request.headers.get('user-agent') ?? '';
  const isMobile = /iPhone|iPad|Android/i.test(ua);
  if (isMobile) {
    // Encode as a JS string literal with < > / escaped so no </script> sequence
    // can ever appear, even if JSON.stringify leaves slashes unescaped.
    const toJsLiteral = (s: string) =>
      JSON.stringify(s)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\//g, '\\u002f');
    const jsAppScheme = toJsLiteral(appScheme);
    const jsWebUrl = toJsLiteral(webUrl);
    // In the HTML attribute, only & needs encoding (< > " are excluded by SAFE_PATH_RE).
    const attrWebUrl = webUrl.replace(/&/g, '&amp;');
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="1;url=${attrWebUrl}"><script>window.location=${jsAppScheme};setTimeout(function(){window.location=${jsWebUrl}},1000)</script></head><body></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
  return NextResponse.redirect(webUrl);
}
