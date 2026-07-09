import {
  profileDesignPresetIds,
  profileAccentToneIds,
  profileBackdropToneIds,
} from '@/lib/profile-design';

// Field → max-length maps mirror profile-editor-schema.ts. The AI page
// customizer may only touch fields the editor itself can save, so anything
// outside these maps is dropped by sanitizeAiChanges no matter what the
// model returns.
const SHARED_FIELDS: Record<string, number> = {
  headline: 180,
  bio: 1000,
  aboutContent: 5000,
  topFiveContent: 2000,
  mediaContent: 5000,
  nowPlaying: 240,
  links: 5000,
};

const ARTIST_DJ_FIELDS: Record<string, number> = {
  tourContent: 5000,
  upcomingContent: 5000,
  requestContent: 5000,
  previousShowHighlights: 5000,
  merchContent: 5000,
};

const VENUE_FIELDS: Record<string, number> = {
  hoursText: 500,
  parkingDetails: 1000,
  stayRecommendations: 1000,
};

const THEME_FIELDS: Record<string, readonly string[]> = {
  themePreset: profileDesignPresetIds,
  themeAccentTone: profileAccentToneIds,
  themeBackdropTone: profileBackdropToneIds,
};

export const AI_FIELD_LABELS: Record<string, string> = {
  headline: 'Headline',
  bio: 'Bio',
  aboutContent: 'About',
  topFiveContent: 'Top 5',
  mediaContent: 'Media notes',
  nowPlaying: 'Now playing',
  links: 'Links',
  tourContent: 'Tour dates',
  upcomingContent: 'Upcoming',
  requestContent: 'Requests',
  previousShowHighlights: 'Show highlights',
  merchContent: 'Merch details',
  hoursText: 'Hours',
  parkingDetails: 'Parking',
  stayRecommendations: 'Stay recommendations',
  themePreset: 'Design preset',
  themeAccentTone: 'Accent tone',
  themeBackdropTone: 'Backdrop tone',
};

/** Text fields (with length caps) the AI may edit for a given profile type. */
export function aiTextFieldLimits(profileType: string): Record<string, number> {
  if (profileType === 'ARTIST' || profileType === 'DJ') {
    return { ...SHARED_FIELDS, ...ARTIST_DJ_FIELDS };
  }
  if (profileType === 'VENUE') {
    return { ...SHARED_FIELDS, ...VENUE_FIELDS };
  }
  return { ...SHARED_FIELDS };
}

/** Every field name the AI may return for a given profile type. */
export function aiEditableFields(profileType: string): string[] {
  return [...Object.keys(aiTextFieldLimits(profileType)), ...Object.keys(THEME_FIELDS)];
}

export const themeFieldValues = {
  themePreset: profileDesignPresetIds,
  themeAccentTone: profileAccentToneIds,
  themeBackdropTone: profileBackdropToneIds,
} as const;

/**
 * Constrain a raw AI response to the editable field set: unknown keys and
 * non-string values are dropped, text is trimmed and clamped to the editor
 * schema's max length, and theme fields must be one of the known preset/tone
 * ids. Returns only the surviving changes (possibly empty).
 */
export function sanitizeAiChanges(
  profileType: string,
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const limits = aiTextFieldLimits(profileType);
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    if (key in limits) {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed.slice(0, limits[key]);
      continue;
    }
    const allowedIds = THEME_FIELDS[key];
    if (allowedIds && (allowedIds as readonly string[]).includes(value)) {
      out[key] = value;
    }
  }

  return out;
}
