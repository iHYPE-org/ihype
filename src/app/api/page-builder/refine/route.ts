import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';
import { runAIJson } from '@/lib/ai';
import { aiTextFieldLimits, sanitizeAiChanges, themeFieldValues } from '@/lib/page-refine';

export const dynamic = 'force-dynamic';

const SYSTEM = `You are the page customization engine for iHYPE, a grassroots music platform. A page owner gives you a natural-language instruction; you reorganize and polish their page content to match it.

You receive the page's current content as "current" (field name → current value, null when empty) and the page's role (ARTIST, DJ, VENUE, or LISTENER/fan).

Rules:
- Return a JSON object containing ONLY the fields you are changing, with their complete new string values. Never return fields you aren't changing.
- Only use field names that appear in "editableFields". Anything else is discarded.
- Work with what's there: reorganize, rewrite, tighten, and reformat the owner's existing content. Never invent facts, links, dates, venues, or achievements that aren't in the provided content or instruction.
- "links" is one link per line, most important first. "topFiveContent" is one item per line, exactly 5 lines or fewer.
- Keep the owner's voice. Copy style: terse, high-energy, second person where natural. No emoji.
- Theme fields (themePreset, themeAccentTone, themeBackdropTone) must use one of the ids listed in "themeOptions" — pick ones matching the mood the instruction asks for, and only change them when the instruction is about look/feel/vibe.`;

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

  let body: { instruction?: unknown; profileId?: unknown };
  try {
    body = await request.json() as { instruction?: unknown; profileId?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body.instruction || typeof body.instruction !== 'string' || !body.instruction.trim()) {
    return NextResponse.json({ error: 'instruction is required.' }, { status: 400 });
  }
  if (!body.profileId || typeof body.profileId !== 'string' || body.profileId.length > 64) {
    return NextResponse.json({ error: 'profileId is required.' }, { status: 400 });
  }

  const instruction = body.instruction.trim().slice(0, 500);

  let profile: Record<string, unknown> | null;
  try {
    profile = await withDbRetry(() => db.profile.findUnique({
      where: { id: body.profileId as string },
      select: {
        id: true, ownerId: true, type: true, name: true,
        headline: true, bio: true, aboutContent: true, topFiveContent: true,
        mediaContent: true, nowPlaying: true, links: true,
        tourContent: true, upcomingContent: true, requestContent: true,
        previousShowHighlights: true, merchContent: true,
        hoursText: true, parkingDetails: true, stayRecommendations: true,
        themePreset: true, themeAccentTone: true, themeBackdropTone: true,
      },
    }));
  } catch {
    return NextResponse.json({ error: 'Database unavailable — please try again in a moment.' }, { status: 503 });
  }

  if (!profile || !canManageOwnedResource(session, profile.ownerId as string)) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  const profileType = profile.type as string;
  const textLimits = aiTextFieldLimits(profileType);
  const current: Record<string, string | null> = {};
  for (const field of Object.keys(textLimits)) {
    const v = profile[field];
    current[field] = typeof v === 'string' && v.trim() ? v.slice(0, textLimits[field]) : null;
  }
  for (const field of Object.keys(themeFieldValues)) {
    const v = profile[field];
    current[field] = typeof v === 'string' ? v : null;
  }

  const raw = await runAIJson<Record<string, unknown>>({
    system: SYSTEM,
    input: {
      role: profileType,
      pageName: profile.name,
      instruction,
      editableFields: Object.keys(current),
      themeOptions: themeFieldValues,
      current,
    },
    maxTokens: 2048,
  });

  if (!raw) {
    return NextResponse.json({ aiAvailable: false });
  }

  const changes = sanitizeAiChanges(profileType, raw);
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ aiAvailable: false });
  }

  return NextResponse.json({ changes });
}
