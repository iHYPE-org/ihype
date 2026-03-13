import type { CSSProperties } from 'react';

export const profileDesignPresetIds = [
  'midnight-neon',
  'sunset-paper',
  'silver-signal',
  'fan-club'
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

export const DEFAULT_PROFILE_DESIGN_PRESET: ProfileDesignPreset = 'midnight-neon';

type ProfileDesignPresetDefinition = {
  id: ProfileDesignPreset;
  label: string;
  description: string;
  surface: string;
  panel: string;
  hero: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  border: string;
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

export const profileDesignPresets: ProfileDesignPresetDefinition[] = [
  {
    id: 'midnight-neon',
    label: 'Midnight Neon',
    description: 'Dark club glass with cyan and violet highlights.',
    surface: 'linear-gradient(160deg, rgba(8,12,24,0.98), rgba(18,26,46,0.98))',
    panel: 'rgba(12, 18, 34, 0.82)',
    hero: 'linear-gradient(135deg, rgba(35,208,216,0.2), rgba(143,91,255,0.24))',
    accent: '#23d0d8',
    accentSoft: 'rgba(35, 208, 216, 0.16)',
    text: '#ecf5ff',
    muted: '#9cb1ce',
    border: 'rgba(255,255,255,0.1)'
  },
  {
    id: 'sunset-paper',
    label: 'Sunset Paper',
    description: 'Warm print tones with poster-style contrast.',
    surface: 'linear-gradient(180deg, rgba(60,26,20,0.96), rgba(27,12,10,0.98))',
    panel: 'rgba(76, 34, 28, 0.78)',
    hero: 'linear-gradient(135deg, rgba(255,186,94,0.26), rgba(255,114,84,0.22))',
    accent: '#ffb85e',
    accentSoft: 'rgba(255, 184, 94, 0.16)',
    text: '#fff4e7',
    muted: '#dec2a7',
    border: 'rgba(255,225,197,0.14)'
  },
  {
    id: 'silver-signal',
    label: 'Silver Signal',
    description: 'Monochrome broadcast styling with bright chrome accents.',
    surface: 'linear-gradient(180deg, rgba(20,24,30,0.98), rgba(9,12,17,0.98))',
    panel: 'rgba(34, 39, 48, 0.8)',
    hero: 'linear-gradient(135deg, rgba(213,225,241,0.18), rgba(118,141,173,0.18))',
    accent: '#dce8f6',
    accentSoft: 'rgba(220, 232, 246, 0.16)',
    text: '#f5f8fc',
    muted: '#b6c0cf',
    border: 'rgba(220,232,246,0.14)'
  },
  {
    id: 'fan-club',
    label: 'Fan Club',
    description: 'Playful candy-color look for fan-forward sharing.',
    surface: 'linear-gradient(180deg, rgba(28,18,46,0.98), rgba(12,10,28,0.98))',
    panel: 'rgba(40, 23, 65, 0.8)',
    hero: 'linear-gradient(135deg, rgba(255,94,166,0.24), rgba(116,255,211,0.2))',
    accent: '#ff72c2',
    accentSoft: 'rgba(255, 114, 194, 0.16)',
    text: '#fff2fb',
    muted: '#d4bfd7',
    border: 'rgba(255,255,255,0.12)'
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

export function normalizeProfileDesignPreset(value?: string | null): ProfileDesignPreset {
  if (value && profileDesignPresetIds.includes(value as ProfileDesignPreset)) {
    return value as ProfileDesignPreset;
  }

  return DEFAULT_PROFILE_DESIGN_PRESET;
}

export function normalizeProfileAccentTone(value?: string | null): ProfileAccentTone {
  if (value && profileAccentToneIds.includes(value as ProfileAccentTone)) {
    return value as ProfileAccentTone;
  }

  return 'preset';
}

export function normalizeProfileBackdropTone(value?: string | null): ProfileBackdropTone {
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

export function getProfileDesignStyleVars(
  value?: string | null,
  overrides?: {
    accentTone?: string | null;
    backdropTone?: string | null;
  }
): CSSProperties {
  const preset = getProfileDesignPreset(value);
  const accentTone = getProfileAccentTone(overrides?.accentTone);
  const backdropTone = getProfileBackdropTone(overrides?.backdropTone);

  return {
    '--profile-design-surface': backdropTone.surface ?? preset.surface,
    '--profile-design-panel': backdropTone.panel ?? preset.panel,
    '--profile-design-hero': backdropTone.hero ?? preset.hero,
    '--profile-design-accent': accentTone.accent ?? preset.accent,
    '--profile-design-accent-soft': accentTone.accentSoft ?? preset.accentSoft,
    '--profile-design-text': preset.text,
    '--profile-design-muted': preset.muted,
    '--profile-design-border': backdropTone.border ?? preset.border
  } as CSSProperties;
}
