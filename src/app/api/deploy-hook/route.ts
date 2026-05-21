import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/utils';

const SITEMAP_URL = `${getBaseUrl()}/sitemap.xml`;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.DEPLOY_HOOK_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fire-and-forget sitemap pings
  const sitemapParam = encodeURIComponent(SITEMAP_URL);
  Promise.all([
    fetch(`https://www.google.com/ping?sitemap=${sitemapParam}`),
    fetch(`https://www.bing.com/ping?sitemap=${sitemapParam}`),
  ]).catch(() => {});

  return NextResponse.json({ ok: true });
}
