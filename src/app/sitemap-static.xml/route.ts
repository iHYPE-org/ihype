import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';

const STATIC: Array<{ path: string; freq: string; priority: number }> = [
  { path: '/', freq: 'weekly', priority: 1 },
  { path: '/shows', freq: 'hourly', priority: 0.9 },
  { path: '/artists', freq: 'daily', priority: 0.9 },
  { path: '/venues', freq: 'weekly', priority: 0.8 },
  { path: '/promoters', freq: 'weekly', priority: 0.7 },
  { path: '/fans', freq: 'weekly', priority: 0.6 },
  { path: '/about', freq: 'monthly', priority: 0.5 },
  { path: '/transparency', freq: 'monthly', priority: 0.4 },
  { path: '/journal', freq: 'weekly', priority: 0.7 }
];

export async function GET() {
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    STATIC.map(
      (s) =>
        `  <url><loc>${base}${s.path}</loc><changefreq>${s.freq}</changefreq><priority>${s.priority}</priority></url>`
    ).join('\n') +
    '\n</urlset>';

  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
  });
}
