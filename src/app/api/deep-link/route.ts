import { NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') ?? '/';
  const appUrl = `ihype://${path.replace(/^\//, '')}`;
  const webUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org'}${path}`;
  const ua = request.headers.get('user-agent') ?? '';
  const isMobile = /iPhone|iPad|Android/i.test(ua);
  if (isMobile) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="1;url=${webUrl}"><script>window.location='${appUrl}';setTimeout(()=>{window.location='${webUrl}'},1000)</script></head><body></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
  return NextResponse.redirect(webUrl);
}
