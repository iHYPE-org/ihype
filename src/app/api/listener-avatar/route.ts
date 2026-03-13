import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

const generateSchema = z.object({
  profileId: z.string().cuid(),
  prompt: z.string().trim().max(600).optional().default(''),
  variantCount: z.number().int().min(1).max(4).optional().default(4)
});

const saveSchema = z.object({
  action: z.literal('save'),
  profileId: z.string().cuid(),
  avatarImage: z.string().startsWith('data:image/').max(8_000_000)
});

function buildAvatarPrompt({
  name,
  city,
  country,
  genres,
  topFiveContent,
  userPrompt
}: {
  name: string;
  city: string | null;
  country: string | null;
  genres: string[];
  topFiveContent: string | null;
  userPrompt: string;
}) {
  const location = [city, country].filter(Boolean).join(', ');
  const genreLine = genres.length ? `Music taste cues: ${genres.join(', ')}.` : '';
  const locationLine = location ? `Location inspiration: ${location}.` : '';
  const topFiveLine = topFiveContent ? `Top five notes: ${topFiveContent.slice(0, 220)}.` : '';

  return [
    `Create an original simple cartoon avatar portrait for the music listener profile "${name}".`,
    'Single original character only, head-and-shoulders composition, centered character, clean silhouette, playful expression.',
    'Simple illustrated finish, nightlife energy, music-discovery personality, bold but limited color palette, no text, no watermark, no logos.',
    'Avoid matching any copyrighted character or celebrity likeness.',
    genreLine,
    locationLine,
    topFiveLine,
    `User direction: ${userPrompt}`
  ]
    .filter(Boolean)
    .join(' ');
}

const avatarHairChoices = [
  'soft curls',
  'short blunt bob',
  'shaved sides with a bright top',
  'messy wave cut',
  'braided crown',
  'rounded afro silhouette'
];

const avatarAccessoryChoices = [
  'chunky headphones',
  'star earrings',
  'small tinted glasses',
  'a subtle nose ring',
  'a simple chain necklace',
  'no accessory'
];

const avatarPaletteChoices = [
  'neon coral and cyan',
  'electric blue and cream',
  'lime and midnight',
  'peach and indigo',
  'silver and hot pink',
  'sunset orange and teal'
];

const avatarMoodChoices = [
  'curious smile',
  'laid-back grin',
  'daydreaming look',
  'confident stage-ready stare',
  'soft friendly expression',
  'excited music-fan energy'
];

const avatarOutfitChoices = [
  'oversized hoodie',
  'bomber jacket',
  'graphic tee',
  'cropped windbreaker',
  'minimal clubwear top',
  'vintage denim jacket'
];

const avatarBackdropChoices = [
  'flat pastel background',
  'simple abstract club lights',
  'minimal gradient halo',
  'clean circle backdrop',
  'tiny music-wave accents',
  'subtle starburst backdrop'
];

function pickRandom<T>(values: readonly T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function buildRandomVariantPrompt() {
  const hair = pickRandom(avatarHairChoices);
  const accessory = pickRandom(avatarAccessoryChoices);
  const palette = pickRandom(avatarPaletteChoices);
  const mood = pickRandom(avatarMoodChoices);
  const outfit = pickRandom(avatarOutfitChoices);
  const backdrop = pickRandom(avatarBackdropChoices);

  return {
    label: mood,
    prompt: `Make the character feel like a music fan with ${hair}, ${accessory}, ${outfit}, ${mood}, and a ${palette} palette. Use a ${backdrop}. Keep it simple, original, and cute.`
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Avatar generation is not configured yet. Add OPENAI_API_KEY first.' },
      { status: 503 }
    );
  }

  try {
    const rawBody = await request.json();
    const isSaveRequest = rawBody?.action === 'save';
    const baseBody = isSaveRequest ? saveSchema.parse(rawBody) : generateSchema.parse(rawBody);

    const profile = await db.profile.findUnique({
      where: { id: baseBody.profileId },
      select: {
        id: true,
        ownerId: true,
        type: true,
        name: true,
        city: true,
        country: true,
        genres: true,
        topFiveContent: true,
        avatarImage: true
      }
    });

    if (!profile || profile.type !== 'LISTENER') {
      return NextResponse.json({ error: 'Listener page not found' }, { status: 404 });
    }

    if (profile.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Only the listener who owns this page can generate an avatar' }, { status: 403 });
    }

    if (isSaveRequest) {
      const body = saveSchema.parse(rawBody);

      await db.profile.update({
        where: { id: profile.id },
        data: { avatarImage: body.avatarImage }
      });

      return NextResponse.json({
        avatarImage: body.avatarImage
      });
    }

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const body = generateSchema.parse(rawBody);

    const options: Array<{
      id: string;
      label: string;
      avatarImage: string;
      revisedPrompt: string | null;
    }> = [];

    for (let index = 0; index < body.variantCount; index += 1) {
      const variant = buildRandomVariantPrompt();
      const result = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: buildAvatarPrompt({
          name: profile.name,
          city: profile.city,
          country: profile.country,
          genres: profile.genres,
          topFiveContent: profile.topFiveContent,
          userPrompt: [body.prompt, variant.prompt].filter(Boolean).join(' ')
        }),
        size: '1024x1024',
        quality: 'medium',
        background: 'transparent',
        output_format: 'png',
        user: `${session.user.id}-listener-avatar-${index + 1}`
      });

      const image = result.data?.[0];
      if (!image?.b64_json) {
        continue;
      }

      options.push({
        id: `option-${index + 1}`,
        label: variant.label,
        avatarImage: `data:image/png;base64,${image.b64_json}`,
        revisedPrompt: image.revised_prompt ?? null
      });
    }

    if (!options.length) {
      return NextResponse.json({ error: 'The avatar service returned empty options' }, { status: 502 });
    }

    return NextResponse.json({
      options,
      savedAvatarImage: profile.avatarImage ?? null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not generate avatar right now' }, { status: 500 });
  }
}
