export const profileDesignPresetIds = [
  'midnight-neon',
  'sunset-paper',
  'silver-signal',
  'fan-club',
  'y2k-sparkle',
  'scrapbook-zine',
  'arcade-afterglow',
  'pixel-diary'
] as const;

export type ProfileDesignPreset = (typeof profileDesignPresetIds)[number];

export const profileAccentToneIds = [
  'preset',
  'electric-cyan',
  'sunset-gold',
  'laser-rose',
  'signal-lime',
  'ultraviolet'
] as const;

export type ProfileAccentTone = (typeof profileAccentToneIds)[number];

export const profileBackdropToneIds = [
  'preset',
  'glass-night',
  'warehouse-smoke',
  'sunset-haze',
  'city-lights',
  'velvet-room'
] as const;

export type ProfileBackdropTone = (typeof profileBackdropToneIds)[number];

export const profileFontPresetIds = [
  'night-broadcast',
  'poster-serif',
  'club-mono',
  'neon-script',
  'bubble-pop',
  'punch-card'
] as const;

export type ProfileFontPreset = (typeof profileFontPresetIds)[number];

const DEFAULT_PROFILE_DESIGN_PRESET: ProfileDesignPreset = 'midnight-neon';

type ProfileDesignPresetDefinition = {
  id: ProfileDesignPreset;
  label: string;
  description: string;
  surface: string;
  overlay: string;
  panel: string;
  hero: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  border: string;
  panelRadius: string;
  panelShadow: string;
};

type ProfileAccentToneDefinition = {
  id: ProfileAccentTone;
  label: string;
  description: string;
  accent?: string;
  accentSoft?: string;
};

type ProfileBackdropToneDefinition = {
  id: ProfileBackdropTone;
  label: string;
  description: string;
  surface?: string;
  panel?: string;
  hero?: string;
  border?: string;
};

type ProfileFontPresetDefinition = {
  id: ProfileFontPreset;
  label: string;
  description: string;
  displayFamily: string;
  bodyFamily: string;
};

export const profileDesignPresets: ProfileDesignPresetDefinition[] = [
  {
    id: 'midnight-neon',
    label: 'Midnight Neon',
    description: 'Dark club glass with cyan and violet highlights.',
    surface: 'linear-gradient(160deg, rgba(8,12,24,0.98), rgba(18,26,46,0.98))',
    overlay:
      'radial-gradient(circle at 12% 16%, rgba(255,255,255,0.08), transparent 18%), linear-gradient(115deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 24px)',
    panel: 'rgba(12, 18, 34, 0.82)',
    hero: 'linear-gradient(135deg, rgba(35,208,216,0.2), rgba(143,91,255,0.24))',
    accent: '#23d0d8',
    accentSoft: 'rgba(35, 208, 216, 0.16)',
    text: '#ecf5ff',
    muted: '#9cb1ce',
    border: 'rgba(255,255,255,0.1)',
    panelRadius: '28px',
    panelShadow: '0 24px 64px rgba(0, 0, 0, 0.34)'
  },
  {
    id: 'sunset-paper',
    label: 'Sunset Paper',
    description: 'Warm print tones with poster-style contrast.',
    surface: 'linear-gradient(180deg, rgba(60,26,20,0.96), rgba(27,12,10,0.98))',
    overlay:
      'repeating-linear-gradient(0deg, rgba(255,240,219,0.04) 0, rgba(255,240,219,0.04) 2px, transparent 2px, transparent 18px)',
    panel: 'rgba(76, 34, 28, 0.78)',
    hero: 'linear-gradient(135deg, rgba(255,186,94,0.26), rgba(255,114,84,0.22))',
    accent: '#ffb85e',
    accentSoft: 'rgba(255, 184, 94, 0.16)',
    text: '#fff4e7',
    muted: '#dec2a7',
    border: 'rgba(255,225,197,0.14)',
    panelRadius: '20px',
    panelShadow: '0 22px 58px rgba(15, 8, 6, 0.34)'
  },
  {
    id: 'silver-signal',
    label: 'Silver Signal',
    description: 'Monochrome broadcast styling with bright chrome accents.',
    surface: 'linear-gradient(180deg, rgba(20,24,30,0.98), rgba(9,12,17,0.98))',
    overlay:
      'linear-gradient(90deg, transparent 0, transparent 16px, rgba(255,255,255,0.04) 16px, rgba(255,255,255,0.04) 17px, transparent 17px, transparent 34px)',
    panel: 'rgba(34, 39, 48, 0.8)',
    hero: 'linear-gradient(135deg, rgba(213,225,241,0.18), rgba(118,141,173,0.18))',
    accent: '#dce8f6',
    accentSoft: 'rgba(220, 232, 246, 0.16)',
    text: '#f5f8fc',
    muted: '#b6c0cf',
    border: 'rgba(220,232,246,0.14)',
    panelRadius: '18px',
    panelShadow: '0 20px 48px rgba(0, 0, 0, 0.3)'
  },
  {
    id: 'fan-club',
    label: 'Fan Club',
    description: 'Playful candy-color look for fan-forward sharing.',
    surface: 'linear-gradient(180deg, rgba(28,18,46,0.98), rgba(12,10,28,0.98))',
    overlay:
      'radial-gradient(circle at 24px 24px, rgba(255,255,255,0.08) 0 4px, transparent 4px), radial-gradient(circle at 0 0, rgba(255,255,255,0.03) 0 2px, transparent 2px)',
    panel: 'rgba(40, 23, 65, 0.8)',
    hero: 'linear-gradient(135deg, rgba(255,94,166,0.24), rgba(116,255,211,0.2))',
    accent: '#ff72c2',
    accentSoft: 'rgba(255, 114, 194, 0.16)',
    text: '#fff2fb',
    muted: '#d4bfd7',
    border: 'rgba(255,255,255,0.12)',
    panelRadius: '32px',
    panelShadow: '0 26px 70px rgba(13, 4, 22, 0.42)'
  },
  {
    id: 'y2k-sparkle',
    label: 'Y2K Sparkle',
    description: 'Chrome candy gradients, glitter dots, and bright pop-star energy.',
    surface: 'linear-gradient(145deg, rgba(28,18,54,0.98), rgba(8,18,48,0.98))',
    overlay:
      'radial-gradient(circle at 16px 16px, rgba(255,255,255,0.16) 0 2px, transparent 2px), radial-gradient(circle at 42px 34px, rgba(255,255,255,0.08) 0 3px, transparent 3px), linear-gradient(120deg, rgba(255,255,255,0.06), transparent 34%)',
    panel: 'rgba(34, 20, 74, 0.82)',
    hero: 'linear-gradient(135deg, rgba(255,140,214,0.28), rgba(116,255,211,0.24), rgba(148,185,255,0.22))',
    accent: '#ff8ee8',
    accentSoft: 'rgba(255, 142, 232, 0.18)',
    text: '#fff8ff',
    muted: '#e1d4f3',
    border: 'rgba(255,255,255,0.16)',
    panelRadius: '36px',
    panelShadow: '0 30px 84px rgba(8, 7, 36, 0.46)'
  },
  {
    id: 'scrapbook-zine',
    label: 'Scrapbook Zine',
    description: 'Cut-and-paste flyer mood with warm paper and punchy contrast.',
    surface: 'linear-gradient(180deg, rgba(54,28,18,0.98), rgba(24,14,10,0.98))',
    overlay:
      'repeating-linear-gradient(45deg, rgba(255,244,218,0.06) 0, rgba(255,244,218,0.06) 6px, transparent 6px, transparent 22px), repeating-linear-gradient(-45deg, rgba(255,184,94,0.05) 0, rgba(255,184,94,0.05) 4px, transparent 4px, transparent 18px)',
    panel: 'rgba(76, 38, 24, 0.82)',
    hero: 'linear-gradient(135deg, rgba(255,196,87,0.28), rgba(255,103,133,0.22))',
    accent: '#ffd267',
    accentSoft: 'rgba(255, 210, 103, 0.18)',
    text: '#fff8eb',
    muted: '#ebd2b8',
    border: 'rgba(255,226,192,0.18)',
    panelRadius: '14px',
    panelShadow: '0 22px 54px rgba(18, 10, 6, 0.32)'
  },
  {
    id: 'arcade-afterglow',
    label: 'Arcade Afterglow',
    description: 'Pixel-grid nightlife with saturated neon and machine-room glow.',
    surface: 'linear-gradient(180deg, rgba(9,14,38,0.98), rgba(3,8,22,0.99))',
    overlay:
      'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
    panel: 'rgba(10, 20, 52, 0.82)',
    hero: 'linear-gradient(135deg, rgba(46,230,214,0.2), rgba(255,93,166,0.24), rgba(255,196,87,0.22))',
    accent: '#5df0ff',
    accentSoft: 'rgba(93, 240, 255, 0.16)',
    text: '#f3fbff',
    muted: '#adc4dc',
    border: 'rgba(93,240,255,0.18)',
    panelRadius: '24px',
    panelShadow: '0 28px 72px rgba(2, 10, 28, 0.42)'
  },
  {
    id: 'pixel-diary',
    label: 'Pixel Diary',
    description: 'Retro personal-page energy with pastel pixels and playful glow.',
    surface: 'linear-gradient(180deg, rgba(24,18,46,0.98), rgba(14,12,32,0.99))',
    overlay:
      'radial-gradient(circle at 0 0, rgba(255,255,255,0.08) 0 1.5px, transparent 1.5px), radial-gradient(circle at 18px 18px, rgba(255,114,194,0.08) 0 2px, transparent 2px)',
    panel: 'rgba(34, 24, 68, 0.84)',
    hero: 'linear-gradient(135deg, rgba(136,190,255,0.22), rgba(255,154,232,0.22), rgba(255,210,103,0.18))',
    accent: '#88beff',
    accentSoft: 'rgba(136, 190, 255, 0.18)',
    text: '#f7f6ff',
    muted: '#cdc6e6',
    border: 'rgba(255,255,255,0.14)',
    panelRadius: '30px',
    panelShadow: '0 26px 66px rgba(10, 6, 28, 0.42)'
  }
];

export const profileAccentTones: ProfileAccentToneDefinition[] = [
  {
    id: 'preset',
    label: 'Preset',
    description: 'Use the accent that comes with the selected preset.'
  },
  {
    id: 'electric-cyan',
    label: 'Electric Cyan',
    description: 'Cool neon cyan for club-forward venue pages.',
    accent: '#23d0d8',
    accentSoft: 'rgba(35, 208, 216, 0.16)'
  },
  {
    id: 'sunset-gold',
    label: 'Sunset Gold',
    description: 'Warm amber accents for rooftop and sunset rooms.',
    accent: '#ffb85e',
    accentSoft: 'rgba(255, 184, 94, 0.16)'
  },
  {
    id: 'laser-rose',
    label: 'Laser Rose',
    description: 'Hot pink highlights for after-hours energy.',
    accent: '#ff72c2',
    accentSoft: 'rgba(255, 114, 194, 0.16)'
  },
  {
    id: 'signal-lime',
    label: 'Signal Lime',
    description: 'Acid-green glow for warehouse and basement nights.',
    accent: '#b9ff66',
    accentSoft: 'rgba(185, 255, 102, 0.16)'
  },
  {
    id: 'ultraviolet',
    label: 'Ultraviolet',
    description: 'Deep violet highlights for sleek late-night branding.',
    accent: '#8f5bff',
    accentSoft: 'rgba(143, 91, 255, 0.16)'
  }
];

export const profileBackdropTones: ProfileBackdropToneDefinition[] = [
  {
    id: 'preset',
    label: 'Preset',
    description: 'Use the backdrop that comes with the selected preset.'
  },
  {
    id: 'glass-night',
    label: 'Glass Night',
    description: 'Sharp cool gradients with glossy venue glass.',
    surface: 'linear-gradient(160deg, rgba(7,12,24,0.98), rgba(18,30,52,0.98))',
    panel: 'rgba(13, 20, 38, 0.84)',
    hero: 'linear-gradient(135deg, rgba(35,208,216,0.18), rgba(130,170,255,0.18))',
    border: 'rgba(255,255,255,0.1)'
  },
  {
    id: 'warehouse-smoke',
    label: 'Warehouse Smoke',
    description: 'Low-lit steel and concrete atmosphere.',
    surface: 'linear-gradient(165deg, rgba(14,16,20,0.98), rgba(30,33,40,0.98))',
    panel: 'rgba(23, 25, 31, 0.86)',
    hero: 'linear-gradient(135deg, rgba(120,130,150,0.18), rgba(65,70,82,0.22))',
    border: 'rgba(255,255,255,0.08)'
  },
  {
    id: 'sunset-haze',
    label: 'Sunset Haze',
    description: 'Warm dusk tones for outdoor and rooftop shows.',
    surface: 'linear-gradient(160deg, rgba(45,22,25,0.98), rgba(18,12,24,0.98))',
    panel: 'rgba(58, 28, 34, 0.82)',
    hero: 'linear-gradient(135deg, rgba(255,163,96,0.22), rgba(255,103,133,0.18))',
    border: 'rgba(255,224,200,0.12)'
  },
  {
    id: 'city-lights',
    label: 'City Lights',
    description: 'Blue-black skyline atmosphere with bright reflections.',
    surface: 'linear-gradient(160deg, rgba(8,14,28,0.98), rgba(12,18,42,0.98))',
    panel: 'rgba(14, 21, 41, 0.84)',
    hero: 'linear-gradient(135deg, rgba(98,153,255,0.22), rgba(35,208,216,0.16))',
    border: 'rgba(184,214,255,0.12)'
  },
  {
    id: 'velvet-room',
    label: 'Velvet Room',
    description: 'Rich burgundy atmosphere for intimate rooms.',
    surface: 'linear-gradient(160deg, rgba(27,8,20,0.98), rgba(10,7,18,0.99))',
    panel: 'rgba(43, 14, 31, 0.84)',
    hero: 'linear-gradient(135deg, rgba(164,63,119,0.24), rgba(255,184,94,0.16))',
    border: 'rgba(255,214,224,0.12)'
  }
];

export const profileFontPresets: ProfileFontPresetDefinition[] = [
  {
    id: 'night-broadcast',
    label: 'Night Broadcast',
    description: 'Sharp modern broadcast typography with strong headings.',
    displayFamily: '"Trebuchet MS", "Arial Black", sans-serif',
    bodyFamily: '"Segoe UI", "Helvetica Neue", sans-serif'
  },
  {
    id: 'poster-serif',
    label: 'Poster Serif',
    description: 'Big editorial serif headers with cleaner body copy.',
    displayFamily: 'Georgia, "Times New Roman", serif',
    bodyFamily: '"Helvetica Neue", Arial, sans-serif'
  },
  {
    id: 'club-mono',
    label: 'Club Mono',
    description: 'Utility monospaced headings for a machine-room look.',
    displayFamily: '"Courier New", "Lucida Console", monospace',
    bodyFamily: '"Segoe UI", "Helvetica Neue", sans-serif'
  },
  {
    id: 'neon-script',
    label: 'Neon Script',
    description: 'Soft display script vibe paired with sturdy sans body text.',
    displayFamily: '"Brush Script MT", "Lucida Handwriting", cursive',
    bodyFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
  },
  {
    id: 'bubble-pop',
    label: 'Bubble Pop',
    description: 'Playful rounded display text for fan pages and bold personal looks.',
    displayFamily: '"Comic Sans MS", "Trebuchet MS", cursive',
    bodyFamily: '"Verdana", "Segoe UI", sans-serif'
  },
  {
    id: 'punch-card',
    label: 'Punch Card',
    description: 'Big punchy headlines with cleaner body copy for poster-style pages.',
    displayFamily: 'Impact, "Arial Black", sans-serif',
    bodyFamily: '"Tahoma", "Segoe UI", sans-serif'
  }
];

function normalizeProfileFontPreset(value?: string | null): ProfileFontPreset | null {
  if (value && profileFontPresetIds.includes(value as ProfileFontPreset)) {
    return value as ProfileFontPreset;
  }

  return null;
}

function normalizeProfileDesignPreset(value?: string | null): ProfileDesignPreset {
  if (value && profileDesignPresetIds.includes(value as ProfileDesignPreset)) {
    return value as ProfileDesignPreset;
  }

  return DEFAULT_PROFILE_DESIGN_PRESET;
}

function normalizeProfileAccentTone(value?: string | null): ProfileAccentTone {
  if (value && profileAccentToneIds.includes(value as ProfileAccentTone)) {
    return value as ProfileAccentTone;
  }

  return 'preset';
}

function normalizeProfileBackdropTone(value?: string | null): ProfileBackdropTone {
  if (value && profileBackdropToneIds.includes(value as ProfileBackdropTone)) {
    return value as ProfileBackdropTone;
  }

  return 'preset';
}

export function getProfileDesignPreset(value?: string | null) {
  const presetId = normalizeProfileDesignPreset(value);
  return profileDesignPresets.find((preset) => preset.id === presetId) ?? profileDesignPresets[0];
}

export function getProfileAccentTone(value?: string | null) {
  const accentToneId = normalizeProfileAccentTone(value);
  return profileAccentTones.find((tone) => tone.id === accentToneId) ?? profileAccentTones[0];
}

export function getProfileBackdropTone(value?: string | null) {
  const backdropToneId = normalizeProfileBackdropTone(value);
  return profileBackdropTones.find((tone) => tone.id === backdropToneId) ?? profileBackdropTones[0];
}

/** Returns null when no font preset is chosen — the page keeps the site's default fonts. */
export function getProfileFontPreset(value?: string | null) {
  const fontPresetId = normalizeProfileFontPreset(value);
  if (!fontPresetId) return null;
  return profileFontPresets.find((preset) => preset.id === fontPresetId) ?? null;
}

/**
 * Resolves a profile's stored theme fields into CSS custom-property
 * overrides for its public page. Returns `null` for the untouched
 * Prisma-default combination (themePreset "midnight-neon" + no accent/
 * backdrop override) — every existing profile in the DB is currently in
 * this exact state since no UI has ever let anyone actually choose a
 * theme, and this preset's real colors (cyan accent) don't match the
 * site's brand orange. Applying it unconditionally would silently reskin
 * every profile on the site the moment this shipped. Once someone
 * deliberately saves a theme via the Creator editor, any divergence from
 * that exact combination (including re-choosing "Midnight Neon" by name,
 * which reads as a real choice even though the visual result matches the
 * site default) turns theming on for their page.
 */
export function resolveProfileThemeVars(profile: {
  themePreset?: string | null;
  themeAccentTone?: string | null;
  themeBackdropTone?: string | null;
  themeFontPreset?: string | null;
}): Record<string, string> | null {
  const untouched =
    (!profile.themePreset || profile.themePreset === DEFAULT_PROFILE_DESIGN_PRESET) &&
    !profile.themeAccentTone &&
    !profile.themeBackdropTone &&
    !profile.themeFontPreset;
  if (untouched) return null;

  const preset = getProfileDesignPreset(profile.themePreset);
  const accentTone = getProfileAccentTone(profile.themeAccentTone);
  const backdropTone = getProfileBackdropTone(profile.themeBackdropTone);
  const fontPreset = getProfileFontPreset(profile.themeFontPreset);

  return {
    '--profile-accent': accentTone.accent ?? preset.accent,
    '--profile-accent-soft': accentTone.accentSoft ?? preset.accentSoft,
    '--profile-hero': backdropTone.hero ?? preset.hero,
    '--profile-panel': backdropTone.panel ?? preset.panel,
    '--profile-border': backdropTone.border ?? preset.border,
    ...(fontPreset ? {
      '--profile-font-display': fontPreset.displayFamily,
      '--profile-font-body': fontPreset.bodyFamily,
    } : {}),
  };
}

