import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const profiles = await db.profile.findMany({
    where: { verified: true, type: { in: ['ARTIST', 'DJ'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true, slug: true, bio: true, createdAt: true, genres: true }
  });

  const baseUrl = getBaseUrl();
  const items = profiles.map((p) => `
  <item>
    <title><![CDATA[${p.name}]]></title>
    <link>${baseUrl}/artists/${p.slug}</link>
    <guid isPermaLink="true">${baseUrl}/artists/${p.slug}</guid>
    <pubDate>${p.createdAt.toUTCString()}</pubDate>
    <description><![CDATA[${p.bio ?? ''}]]></description>
    ${(p.genres as string[] | null ?? []).map((g) => `<category>${g}</category>`).join('')}
  </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>iHYPE — Verified Artists</title>
    <link>${baseUrl}/artists</link>
    <description>Verified artists and DJs on iHYPE</description>
    <language>en</language>
    <atom:link href="${baseUrl}/artists/verified.rss" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
  });
}
