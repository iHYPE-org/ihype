import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { canManageOwnedResource } from '@/lib/permissions';

const generateSchema = z.object({
  profileId: z.string().cuid(),
  prompt: z.string().trim().min(3, 'Write a short phrase for your character first.').max(600),
  variantCount: z.number().int().min(1).max(4).optional().default(4)
});

const saveSchema = z.object({
  action: z.literal('save'),
  profileId: z.string().cuid(),
  profileHexId: z.string().regex(/^0x[a-f0-9]+$/i, 'A valid fan hex ID is required.'),
  avatarImage: z.string().startsWith('data:image/').max(8_000_000),
  spritePrompt: z.string().trim().min(3).max(2_000).optional(),
  spriteSheetImage: z.string().startsWith('data:image/').max(16_000_000).optional()
});

function buildAvatarPortraitPrompt({
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
    `Create one original high-definition animated character for the music fan profile "${name}".`,
    'Make it a family-friendly, full-body, original character only with a clean silhouette, expressive pose, polished cel-shaded detail, and game-ready readability.',
    'Animated illustration finish, nightlife energy, music-discovery personality, layered lighting, bold but curated color palette, transparent background, no text, no watermark, no logos.',
    'Keep it family friendly: no nudity, no sexualized styling, no gore, no horror, no alcohol, no smoking, no drugs, no weapons, and no hateful symbols.',
    'Avoid matching any copyrighted character or celebrity likeness.',
    genreLine,
    locationLine,
    topFiveLine,
    `Fan phrase: ${userPrompt}`
  ]
    .filter(Boolean)
    .join(' ');
}

function buildAvatarSpritePrompt({
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
    `Create one original family-friendly full-body sprite sheet for the music fan profile "${name}".`,
    'Use a 2x2 grid with four equal animation frames: idle bounce, wave hello, point toward music, and celebrate with a hype reaction.',
    'Keep the same character design, outfit, proportions, and palette across every frame so the sheet feels production-ready and consistent.',
    'Transparent background, clean readable silhouette, cel-shaded finish, polished 2D sprite art, no text, no watermark, no logos.',
    'Keep it family friendly: no nudity, no sexualized styling, no gore, no horror, no alcohol, no smoking, no drugs, no weapons, and no hateful symbols.',
    'Avoid matching any copyrighted character or celebrity likeness.',
    genreLine,
    locationLine,
    topFiveLine,
    `Fan phrase: ${userPrompt}`
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

function pickDeterministic<T>(values: readonly T[], seed: string, salt: string) {
  const digest = createHash('sha256').update(`${seed}:${salt}`).digest();
  return values[digest[0] % values.length];
}

function encodeSvgAsDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const fallbackSkinTones = ['#f7d7c4', '#f0c1a6', '#d89a73', '#9f6a47', '#6f4633'] as const;
const fallbackHairTones = ['#10121b', '#3d2b1f', '#6e4730', '#cab08b', '#6f4cff', '#1fd4c7'] as const;
const fallbackBackdropTones = ['#0f1728', '#1b2440', '#281947', '#102a34', '#2b1631'] as const;
const fallbackAccentTones = ['#23d0d8', '#ff6ea8', '#ffe066', '#8f5bff', '#7cf29c'] as const;

function buildFallbackAvatarDataUrl({
  seed,
  label
}: {
  seed: string;
  label: string;
}) {
  const skin = pickDeterministic(fallbackSkinTones, seed, 'skin');
  const hair = pickDeterministic(fallbackHairTones, seed, 'hair');
  const backdrop = pickDeterministic(fallbackBackdropTones, seed, 'backdrop');
  const accent = pickDeterministic(fallbackAccentTones, seed, 'accent');
  const eyeOffset = 18 + (createHash('sha256').update(`${seed}:eyes`).digest()[0] % 8);
  const mouthWidth = 34 + (createHash('sha256').update(`${seed}:mouth`).digest()[0] % 18);
  const blushOpacity = 0.18 + (createHash('sha256').update(`${seed}:blush`).digest()[0] % 6) * 0.02;
  const hoodieTone = pickDeterministic(['#f4f6ff', '#d7e7ff', '#f2d7ff', '#d8fff0'], seed, 'hoodie');
  const shirtTone = pickDeterministic(['#0f1728', '#162033', '#31244f', '#183942'], seed, 'shirt');
  const eyelidLift = 5 + (createHash('sha256').update(`${seed}:eyelid`).digest()[0] % 8);
  const haloX = 360 + (createHash('sha256').update(`${seed}:halo`).digest()[0] % 58);
  const fringeLeft = 192 + (createHash('sha256').update(`${seed}:fringe-left`).digest()[0] % 34);
  const fringeRight = 320 + (createHash('sha256').update(`${seed}:fringe-right`).digest()[0] % 34);
  const sparkleOneX = 96 + (createHash('sha256').update(`${seed}:sparkle-1`).digest()[0] % 52);
  const sparkleTwoX = 414 - (createHash('sha256').update(`${seed}:sparkle-2`).digest()[0] % 42);
  const energyArcHeight = 340 + (createHash('sha256').update(`${seed}:energy`).digest()[0] % 36);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${backdrop}" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.9" />
        </linearGradient>
        <radialGradient id="halo" cx="50%" cy="40%" r="62%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.56" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="jacket" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${hoodieTone}" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.45" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="44" fill="url(#bg)" />
      <circle cx="${haloX}" cy="102" r="74" fill="url(#halo)" />
      <circle cx="98" cy="414" r="84" fill="#ffffff" fill-opacity="0.07" />
      <path d="M56 ${energyArcHeight}c86-54 136-73 194-73 90 0 146 39 206 87" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="12" stroke-linecap="round" />
      <path d="M154 398c18-72 63-123 102-123 39 0 84 51 102 123" fill="url(#jacket)" />
      <path d="M200 326c16 24 35 37 56 37 21 0 40-13 56-37" fill="${shirtTone}" />
      <ellipse cx="256" cy="384" rx="114" ry="28" fill="#060911" fill-opacity="0.26" />
      <rect x="232" y="258" width="48" height="54" rx="20" fill="${skin}" />
      <ellipse cx="256" cy="206" rx="120" ry="128" fill="${skin}" />
      <path d="M136 194c6-84 52-126 120-126 76 0 124 40 130 132-42-34-77-49-131-45-44 3-85 15-119 39Z" fill="${hair}" />
      <path d="M170 151c26-30 58-43 96-43 41 0 72 12 101 42-26-7-53-10-87-10-42 0-74 4-110 11Z" fill="${accent}" fill-opacity="0.16" />
      <path d="M${fringeLeft} 155c22 13 38 19 64 19 29 0 46-6 64-19-12 24-35 46-64 46-27 0-50-18-64-46Z" fill="${hair}" />
      <ellipse cx="${256 - eyeOffset}" cy="212" rx="15" ry="${eyelidLift}" fill="#10121b" />
      <ellipse cx="${256 + eyeOffset}" cy="212" rx="15" ry="${eyelidLift}" fill="#10121b" />
      <circle cx="${256 - eyeOffset + 3}" cy="208" r="3.5" fill="#ffffff" fill-opacity="0.85" />
      <circle cx="${256 + eyeOffset + 3}" cy="208" r="3.5" fill="#ffffff" fill-opacity="0.85" />
      <path d="M${256 - eyeOffset - 18} 186c13-11 29-13 40-6" fill="none" stroke="#2a1a14" stroke-width="6" stroke-linecap="round" />
      <path d="M${256 + eyeOffset - 22} 180c12-7 29-6 41 7" fill="none" stroke="#2a1a14" stroke-width="6" stroke-linecap="round" />
      <path d="M252 214c4 10 3 20-3 29" fill="none" stroke="#8a5947" stroke-width="5" stroke-linecap="round" />
      <ellipse cx="${256 - eyeOffset}" cy="247" rx="17" ry="11" fill="#ff9ebd" fill-opacity="${blushOpacity}" />
      <ellipse cx="${256 + eyeOffset}" cy="247" rx="17" ry="11" fill="#ff9ebd" fill-opacity="${blushOpacity}" />
      <path d="M${256 - mouthWidth / 2} 272c14 19 60 19 74 0" stroke="#7a4231" stroke-width="10" stroke-linecap="round" fill="none" />
      <path d="M184 333c20 24 44 36 72 36 28 0 52-12 72-36" stroke="${accent}" stroke-width="9" stroke-linecap="round" fill="none" />
      <circle cx="164" cy="226" r="8" fill="${accent}" fill-opacity="0.68" />
      <circle cx="348" cy="234" r="7" fill="${accent}" fill-opacity="0.56" />
      <path d="M${sparkleOneX} 136l7 16 18 2-14 11 4 18-15-9-15 9 4-18-14-11 18-2Z" fill="#ffffff" fill-opacity="0.78" />
      <path d="M${sparkleTwoX} 334l5 12 13 1-10 8 3 14-11-7-11 7 3-14-10-8 13-1Z" fill="#ffffff" fill-opacity="0.58" />
    </svg>
  `;

  return encodeSvgAsDataUrl(svg);
}

function buildFallbackSpriteSheetDataUrl({
  seed,
  label
}: {
  seed: string;
  label: string;
}) {
  const skin = pickDeterministic(fallbackSkinTones, seed, 'sprite-skin');
  const hair = pickDeterministic(fallbackHairTones, seed, 'sprite-hair');
  const accent = pickDeterministic(fallbackAccentTones, seed, 'sprite-accent');
  const jacket = pickDeterministic(['#f4f6ff', '#d7e7ff', '#f2d7ff', '#d8fff0'], seed, 'sprite-jacket');
  const shirt = pickDeterministic(['#0f1728', '#162033', '#31244f', '#183942'], seed, 'sprite-shirt');
  const halo = pickDeterministic(fallbackBackdropTones, seed, 'sprite-halo');

  const framePoses = [
    { x: 0, y: 0, bounce: 0, leftArm: -18, rightArm: 18, leftLeg: -7, rightLeg: 7, label: 'idle' },
    { x: 512, y: 0, bounce: -10, leftArm: -26, rightArm: 30, leftLeg: -4, rightLeg: 8, label: 'wave' },
    { x: 0, y: 512, bounce: -4, leftArm: -8, rightArm: 38, leftLeg: -9, rightLeg: 11, label: 'point' },
    { x: 512, y: 512, bounce: -18, leftArm: -34, rightArm: 34, leftLeg: -2, rightLeg: 2, label: 'celebrate' }
  ] as const;

  const frames = framePoses
    .map((pose) => {
      const centerX = pose.x + 256;
      const centerY = pose.y + 276 + pose.bounce;
      const shoulderY = centerY - 44;
      const handY = centerY + 6;
      const legTopY = centerY + 54;
      const sparkleX = pose.x + 96 + (createHash('sha256').update(`${seed}:${pose.label}`).digest()[0] % 80);

      return `
        <g aria-label="${pose.label}">
          <rect x="${pose.x}" y="${pose.y}" width="512" height="512" rx="34" fill="${halo}" fill-opacity="0.16" />
          <circle cx="${centerX}" cy="${pose.y + 108}" r="70" fill="${accent}" fill-opacity="0.12" />
          <ellipse cx="${centerX}" cy="${pose.y + 430}" rx="94" ry="24" fill="#060911" fill-opacity="0.18" />
          <path d="M${centerX - 60} ${centerY + 16}c18 30 39 44 60 44 20 0 42-14 60-44v118c-18 18-39 27-60 27-21 0-42-9-60-27Z" fill="${jacket}" />
          <path d="M${centerX - 36} ${centerY + 40}c12 12 24 18 36 18s24-6 36-18v64c-11 8-23 12-36 12s-25-4-36-12Z" fill="${shirt}" />
          <path d="M${centerX - 8} ${centerY - 8}v56" stroke="${skin}" stroke-width="16" stroke-linecap="round" />
          <path d="M${centerX - 42} ${shoulderY}c-18 15-28 31-28 49" stroke="${skin}" stroke-width="14" stroke-linecap="round" />
          <path d="M${centerX + 42} ${shoulderY}c18 ${pose.rightArm} 30 34 30 52" stroke="${skin}" stroke-width="14" stroke-linecap="round" />
          <path d="M${centerX - 22} ${legTopY}c-6 26 ${pose.leftLeg} 58 ${pose.leftLeg + 2} 90" stroke="${skin}" stroke-width="14" stroke-linecap="round" />
          <path d="M${centerX + 22} ${legTopY}c6 26 ${pose.rightLeg} 58 ${pose.rightLeg - 2} 90" stroke="${skin}" stroke-width="14" stroke-linecap="round" />
          <circle cx="${centerX}" cy="${centerY - 72}" r="52" fill="${skin}" />
          <path d="M${centerX - 50} ${centerY - 82}c10-40 42-60 80-50 24 6 40 26 42 58-18-14-39-21-64-21-22 0-41 4-58 13Z" fill="${hair}" />
          <circle cx="${centerX - 18}" cy="${centerY - 78}" r="5" fill="#10121b" />
          <circle cx="${centerX + 18}" cy="${centerY - 78}" r="5" fill="#10121b" />
          <path d="M${centerX - 16} ${centerY - 52}c10 8 22 8 32 0" fill="none" stroke="#7a4231" stroke-width="6" stroke-linecap="round" />
          <circle cx="${sparkleX}" cy="${pose.y + 118}" r="8" fill="#ffffff" fill-opacity="0.75" />
          <circle cx="${pose.x + 408}" cy="${pose.y + 378}" r="6" fill="${accent}" fill-opacity="0.65" />
        </g>
      `;
    })
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="${label}">
      <rect width="1024" height="1024" fill="transparent" />
      ${frames}
    </svg>
  `;

  return encodeSvgAsDataUrl(svg);
}

function buildFallbackOptions({
  profile,
  prompt,
  variantCount
}: {
  profile: {
    id: string;
    hexId: string;
    name: string;
  };
  prompt: string;
  variantCount: number;
}) {
  return Array.from({ length: variantCount }, (_, index) => {
    const variant = buildRandomVariantPrompt();
    const seed = `${profile.hexId}:${prompt}:${index + 1}`;

    return {
      id: `option-${index + 1}`,
      label: variant.label,
      description: variant.description,
      avatarImage: buildFallbackAvatarDataUrl({
        seed,
        label: variant.label
      }),
      spriteSheetImage: buildFallbackSpriteSheetDataUrl({
        seed,
        label: `${variant.label} sprite sheet`
      }),
      spritePrompt: variant.spritePrompt,
      revisedPrompt: `Fallback character sketch based on: ${prompt}`
    };
  });
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
    description: `${hair}, ${outfit}, ${accessory === 'no accessory' ? 'clean styling' : accessory}, ${palette}`,
    prompt: `Make the character feel like a music fan with ${hair}, ${accessory}, ${outfit}, ${mood}, and a ${palette} palette. Use a ${backdrop}. Keep it original, detailed, polished, and cute.`,
    spritePrompt: `Use the same character with ${hair}, ${accessory}, ${outfit}, ${mood}, and a ${palette} palette in a 2x2 full-body sprite sheet for idle, wave, point, and celebrate poses. Keep it original, family-friendly, polished, and readable.`
  };
}

async function generateSpriteSheetWithOpenAI(openai: OpenAI, prompt: string, user: string) {
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
    quality: 'high',
    background: 'transparent',
    output_format: 'png',
    user
  });

  const image = result.data?.[0];
  if (!image?.b64_json) {
    return null;
  }

  return `data:image/png;base64,${image.b64_json}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const isSaveRequest = rawBody?.action === 'save';
    const baseBody = isSaveRequest ? saveSchema.parse(rawBody) : generateSchema.parse(rawBody);

    const profile = await db.profile.findUnique({
      where: { id: baseBody.profileId },
      select: {
        id: true,
        hexId: true,
        ownerId: true,
        type: true,
        name: true,
        city: true,
        country: true,
        genres: true,
        topFiveContent: true,
        avatarImage: true,
        companionSpriteSheet: true,
        owner: {
          select: {
            isThirteenOrOlder: true
          }
        }
      }
    });

    if (!profile || profile.type !== 'LISTENER') {
      return NextResponse.json({ error: 'Fan page not found' }, { status: 404 });
    }

    if (!canManageOwnedResource(session, profile.ownerId)) {
      return NextResponse.json({ error: 'Only the fan who owns this page can generate an avatar' }, { status: 403 });
    }

    if (!profile.owner.isThirteenOrOlder) {
      return NextResponse.json(
        { error: 'The character lab is only available to fans who confirmed they are 13 or older.' },
        { status: 403 }
      );
    }

    if (isSaveRequest) {
      const body = saveSchema.parse(rawBody);

      if (body.profileHexId.toLowerCase() !== profile.hexId.toLowerCase()) {
        return NextResponse.json({ error: 'That avatar can only be tagged to its matching fan ID.' }, { status: 400 });
      }

      let companionSpriteSheet = body.spriteSheetImage ?? null;

      if (!companionSpriteSheet) {
        const fallbackPrompt = body.spritePrompt ?? buildAvatarSpritePrompt({
          name: profile.name,
          city: profile.city,
          country: profile.country,
          genres: profile.genres,
          topFiveContent: profile.topFiveContent,
          userPrompt: 'Family-friendly animated music fan sprite companion.'
        });

        if (env.OPENAI_API_KEY) {
          try {
            const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
            companionSpriteSheet = await generateSpriteSheetWithOpenAI(
              openai,
              fallbackPrompt,
              `${profile.hexId}-fan-sprite-save`
            );
          } catch {
            companionSpriteSheet = null;
          }
        }

        if (!companionSpriteSheet) {
          companionSpriteSheet = buildFallbackSpriteSheetDataUrl({
            seed: `${profile.hexId}:saved-sprite`,
            label: `${profile.name} saved sprite companion`
          });
        }
      }

      await db.profile.update({
        where: { id: profile.id },
        data: {
          avatarImage: body.avatarImage,
          companionSpriteSheet
        }
      });

      return NextResponse.json({
        avatarImage: body.avatarImage,
        companionSpriteSheet,
        fanHexId: profile.hexId
      });
    }
    const body = generateSchema.parse(rawBody);
    const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

    const options: Array<{
      id: string;
      label: string;
      description: string | null;
      avatarImage: string;
      spriteSheetImage: string | null;
      spritePrompt: string | null;
      revisedPrompt: string | null;
    }> = [];

    if (!openai) {
      return NextResponse.json({
        options: buildFallbackOptions({
          profile: {
            id: profile.id,
            hexId: profile.hexId,
            name: profile.name
          },
          prompt: body.prompt,
          variantCount: body.variantCount
        }),
        fanHexId: profile.hexId,
        generationMode: 'fallback',
        notice: 'OpenAI image generation is not configured right now, so iHYPE generated local sprite-ready character sketches instead.',
        savedAvatarImage: profile.avatarImage ?? null
      });
    }

    try {
      for (let index = 0; index < body.variantCount; index += 1) {
        const variant = buildRandomVariantPrompt();
        const portraitPrompt = buildAvatarPortraitPrompt({
          name: profile.name,
          city: profile.city,
          country: profile.country,
          genres: profile.genres,
          topFiveContent: profile.topFiveContent,
          userPrompt: [body.prompt, variant.prompt].filter(Boolean).join(' ')
        });
        const spritePrompt = buildAvatarSpritePrompt({
          name: profile.name,
          city: profile.city,
          country: profile.country,
          genres: profile.genres,
          topFiveContent: profile.topFiveContent,
          userPrompt: [body.prompt, variant.spritePrompt].filter(Boolean).join(' ')
        });
        const result = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: portraitPrompt,
          size: '1024x1024',
          quality: 'high',
          background: 'transparent',
          output_format: 'png',
          user: `${profile.hexId}-fan-avatar-${index + 1}`
        });

        const image = result.data?.[0];
        if (!image?.b64_json) {
          continue;
        }

        options.push({
          id: `option-${index + 1}`,
          label: variant.label,
          description: `${variant.description}. Family-friendly sprite set is generated when you save this option.`,
          avatarImage: `data:image/png;base64,${image.b64_json}`,
          spriteSheetImage: null,
          spritePrompt,
          revisedPrompt: image.revised_prompt ?? null
        });
      }
    } catch (error) {
      const openAiError = error as { code?: string; message?: string };

      return NextResponse.json({
        options: buildFallbackOptions({
          profile: {
            id: profile.id,
            hexId: profile.hexId,
            name: profile.name
          },
          prompt: body.prompt,
          variantCount: body.variantCount
        }),
        fanHexId: profile.hexId,
        generationMode: 'fallback',
        notice:
          openAiError.code === 'billing_hard_limit_reached'
            ? 'OpenAI image credits are unavailable right now, so iHYPE generated local sprite-ready character sketches instead.'
            : 'The OpenAI image service is temporarily unavailable, so iHYPE generated local sprite-ready character sketches instead.',
        savedAvatarImage: profile.avatarImage ?? null,
        savedSpriteSheet: profile.companionSpriteSheet ?? null
      });
    }

    if (!options.length) {
      return NextResponse.json({
        options: buildFallbackOptions({
          profile: {
            id: profile.id,
            hexId: profile.hexId,
            name: profile.name
          },
          prompt: body.prompt,
          variantCount: body.variantCount
        }),
        fanHexId: profile.hexId,
        generationMode: 'fallback',
        notice: 'The OpenAI image service returned empty results, so iHYPE generated local sprite-ready character sketches instead.',
        savedAvatarImage: profile.avatarImage ?? null,
        savedSpriteSheet: profile.companionSpriteSheet ?? null
      });
    }

    return NextResponse.json({
      options,
      fanHexId: profile.hexId,
      generationMode: 'openai',
      savedAvatarImage: profile.avatarImage ?? null,
      savedSpriteSheet: profile.companionSpriteSheet ?? null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not generate avatar right now' }, { status: 500 });
  }
}
