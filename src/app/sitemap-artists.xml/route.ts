import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const base = getBaseUrl();

export async function GET() {
  const artists = await db.profile.findMany({
    where: { type: 'ARTIST' },
    select: { slug: true, updatedAt: true },
    take: 50000,
    orderBy: { updatedAt: 'desc' }
  });

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    artists
      .map(
        (a) =>
          `  <url><loc>${base}/artists/${a.slug}</loc><lastmod>${a.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      )
      .join('\n') +
    '\n</urlset>';

  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' }
  });
}
