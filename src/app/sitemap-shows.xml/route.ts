import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';

export async function GET() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const shows = await db.show.findMany({
    where: {
      status: { not: 'DRAFT' },
      startsAt: { gte: ninetyDaysAgo }
    },
    select: { slug: true, updatedAt: true },
    take: 50000,
    orderBy: { updatedAt: 'desc' }
  });

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    shows
      .map(
        (s) =>
          `  <url><loc>${base}/shows/${s.slug}</loc><lastmod>${s.updatedAt.toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.85</priority></url>`
      )
      .join('\n') +
    '\n</urlset>';

  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' }
  });
}
