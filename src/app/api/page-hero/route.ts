import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const genre = req.nextUrl.searchParams.get('genre') || 'music';
  const key = process.env.UNSPLASH_ACCESS_KEY;

  if (!key) return NextResponse.json({ url: null });

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(genre + ' music performance')}&per_page=5&orientation=landscape&client_id=${key}`,
      { headers: { 'Accept-Version': 'v1' } },
    );
    if (!res.ok) return NextResponse.json({ url: null });
    const body = await res.json() as { results?: Array<{ urls?: { regular?: string }; user?: { name?: string; links?: { html?: string } } }> };
    const photos = body.results ?? [];
    if (!photos.length) return NextResponse.json({ url: null });
    const pick = photos[Math.floor(Math.random() * photos.length)];
    return NextResponse.json({
      url: pick.urls?.regular ?? null,
      attribution: pick.user ? { name: pick.user.name ?? '', link: pick.user.links?.html ?? '' } : null,
    });
  } catch {
    return NextResponse.json({ url: null });
  }
}
