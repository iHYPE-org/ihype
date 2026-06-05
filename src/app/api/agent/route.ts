import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const client = new Anthropic();

type AgentAction =
  | { type: 'NAVIGATE'; view: string }
  | { type: 'OPEN_SEARCH' }
  | { type: 'DISMISS' };

type AgentResponse = {
  reply: string;
  action: AgentAction | null;
  chips: string[];
};

const VIEW_DESCRIPTIONS = `
Available views (use exact key in NAVIGATE action):
- me: Home / profile page — stats, recent activity, tracks
- seeds: Music discovery — swipe and hype tracks you love
- radio: Radio shows and mixes
- tickets: Live events and shows near you
- studio: Recording tools, DJ studio
- artistpage: Artist page manager — library, insights, media uploads (artists only)
- venuepage: Venue page manager — show calendar, bookings (venues only)
- pagestudio: Fan page customizer — design your public page
- tour: Tour planner (artists only)
`.trim();

function buildSystemPrompt(context: {
  view: string;
  userName: string;
  city: string;
  activeProfileTypes: string[];
  mode: string;
  upcomingShows?: string;
  trendingArtists?: string;
}) {
  const roles = context.activeProfileTypes.length
    ? context.activeProfileTypes.join(', ').toLowerCase()
    : 'listener';

  const showsSection = context.upcomingShows
    ? `\nUpcoming shows the user can see:\n${context.upcomingShows}\n`
    : '';
  const artistsSection = context.trendingArtists
    ? `\nTrending artists (use slug for NAVIGATE_URL):\n${context.trendingArtists}\n`
    : '';

  return `You are iHYPE's friendly guide — a music app assistant that helps users navigate and enjoy the platform.

User: ${context.userName}, based in ${context.city || 'unknown city'}.
Their roles: ${roles}.
Current mode: ${context.mode}.
Currently viewing: ${context.view}.
${showsSection}${artistsSection}
${VIEW_DESCRIPTIONS}

ALWAYS respond with valid JSON in this exact shape:
{
  "reply": "short friendly message (1-2 sentences max)",
  "action": { "type": "NAVIGATE", "view": "<viewKey>" } | { "type": "NAVIGATE_URL", "url": "<absolute-path-like-/artists/slug>" } | { "type": "OPEN_SEARCH" } | { "type": "DISMISS" } | null,
  "chips": ["chip 1", "chip 2", "chip 3"]
}

Rules:
- Keep replies short and warm. Never use jargon like "hex ID" or "workbench".
- Chips are quick-tap follow-ups (2-4 words each, max 3 chips).
- If the user wants to go somewhere in the app, set a NAVIGATE action with the view key.
- If the user wants to see a specific artist or show page, use NAVIGATE_URL with the path (e.g. /artists/slug-name).
- If the user says done / bye / thanks / got it, use DISMISS.
- If the user asks to search for something, use OPEN_SEARCH.
- For listeners: focus on discovery, shows, and artists they might like.
- For artists: focus on their page, uploads, and reaching fans.
- For venues: focus on shows, bookings, and promotion.
- Never make up shows, artists, or data — only describe what the app can do.`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  let body: {
    message: string;
    context: {
      view: string;
      userName: string;
      city: string;
      activeProfileTypes: string[];
      mode: string;
      upcomingShows?: string;
      trendingArtists?: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { message, context } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(context);

  // Build message history (last 6 turns max to keep tokens low)
  const history = (context.history ?? []).slice(-6).map(m => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: message.trim().slice(0, 500) },
      ],
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '';

    let parsed: AgentResponse;
    try {
      // Extract JSON from the response (Claude sometimes adds prose before/after)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { reply: raw, action: null, chips: [] };
    } catch {
      parsed = { reply: raw || "I'm here to help! What would you like to do?", action: null, chips: [] };
    }

    return NextResponse.json({
      reply: String(parsed.reply ?? '').slice(0, 300),
      action: parsed.action ?? null,
      chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 3).map(String) : [],
    });
  } catch (err) {
    console.error('Agent API error', err);
    return NextResponse.json({ error: 'Could not reach the guide right now.' }, { status: 500 });
  }
}
