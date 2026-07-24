import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { getHypeHeatmap } from '@/lib/hype-heatmap';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const ip = readClientAddress(request);
    const rl = await consumeRateLimit(`hype-heatmap:ip:${ip}`, { limit: 60, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

    const cities = await getHypeHeatmap(20);

    return NextResponse.json(
      { cities },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      },
    );
  } catch (err) {
    console.error('[api/hype/heatmap] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
