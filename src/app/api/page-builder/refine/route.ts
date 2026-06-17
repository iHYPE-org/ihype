import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { runAI } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const SYSTEM = `You are a page design assistant for iHYPE, a music platform. Given the current theme and a user instruction, return ONLY a JSON object containing the fields to update.

Valid theme fields:
- mood: "dark" or "light"
- font: "editorial", "grotesk", "serif", or "mono"
- layout: "spotlight", "zine", "poster", or "gallery"
- tagline: string (short tagline shown on the page)
- bio: string (bio paragraph)
- palette: object with any of these hex color fields: bg, surface, line, ink, ink2, accent, accent2

Color rules:
- Dark mood: bg very dark (#06–#18), surface slightly lighter, ink very light (#e8–#ff)
- Light mood: bg very light (#ee–#ff), surface white, ink very dark (#08–#20)
- Accent colors must be vivid and saturated
- All colors as 6-digit hex strings (e.g. "#b983ff")

Return ONLY valid JSON. No markdown, no explanation, no extra text.`;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }

  const rate = await consumeRateLimit(`page-refine:${session.user.id}`, {
    limit: 20,
    windowMs: 5 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests — try again in a moment.' }, { status: 429 });
  }

  let body: { instruction?: unknown; theme?: unknown; role?: unknown };
  try {
    body = await request.json() as { instruction?: unknown; theme?: unknown; role?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body.instruction || typeof body.instruction !== 'string') {
    return NextResponse.json({ error: 'instruction is required.' }, { status: 400 });
  }

  const instruction = body.instruction.slice(0, 500);
  const currentTheme = JSON.stringify(body.theme ?? {}).slice(0, 2000);
  const role = typeof body.role === 'string' ? body.role : 'artist';

  const aiResponse = await runAI([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Role: ${role}\nCurrent theme: ${currentTheme}\n\nUser instruction: "${instruction}"\n\nReturn JSON with only the fields to change:`,
    },
  ], 512);

  if (!aiResponse) {
    return NextResponse.json({ aiAvailable: false });
  }

  let changes: Record<string, unknown>;
  try {
    const match = aiResponse.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    changes = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ aiAvailable: false });
  }

  return NextResponse.json({ changes });
}
