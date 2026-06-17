// Parses the published page-builder JSON (Profile.pagePublished) into the
// set of overrides the public profile pages can consume.
//
// SECURITY: everything in the builder JSON is untrusted user input. Only
// plain strings come out of here, with tags stripped and lengths capped —
// callers must render them as React text, never as HTML (except bioHtml
// which is explicitly sanitized below).
import type { ProfileDesignPreset, BuilderPalette } from '@/lib/profile-design';

export type { BuilderPalette };

export type PublishedPageOverrides = {
  /** Hero tagline from the builder — maps to the profile headline slot. */
  headline: string | null;
  /** About/bio copy from the builder (plain text). */
  bio: string | null;
  /** Safe subset of bio markup — only b/i/em/strong/br allowed. */
  bioHtml: string | null;
  /** Closest existing profile design preset for the published theme (fallback). */
  themePreset: ProfileDesignPreset | null;
  /** Full builder palette — drives getBuilderDesignStyleVars(). */
  builderPalette: BuilderPalette | null;
  /** Builder font key: editorial | grotesk | serif | mono */
  builderFont: 'editorial' | 'grotesk' | 'serif' | 'mono' | null;
  /** Builder corner radius in px (0–48) */
  builderRadius: number | null;
  /** Builder mood */
  builderMood: 'dark' | 'light' | null;
  /** Ordered sections array from the builder (id + on flag) */
  builderSections: Array<{ id: string; on: boolean }> | null;
};

const MOOD_TO_PRESET: Record<string, ProfileDesignPreset> = {
  dark: 'midnight-neon',
  light: 'sunset-paper'
};

const VALID_FONTS = new Set(['editorial', 'grotesk', 'serif', 'mono']);
const SAFE_BIO_TAGS = /^(b|i|em|strong|br)$/i;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function cleanBioHtml(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  // Allow only a tiny safe tag set; strip everything else.
  const html = value
    .replace(/<\/?((?!b>|i>|em>|strong>|br\s*\/?>)[^>]*)>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Also strip tag attributes (href/onclick/etc) by re-matching just safe tags
  const safe = html.replace(/<([a-z]+)([^>]*)>/gi, (_, tag) =>
    SAFE_BIO_TAGS.test(tag) ? `<${tag}>` : ' '
  );
  if (!safe) return null;
  return safe.length > max ? safe.slice(0, max) : safe;
}

function cleanHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function extractPalette(raw: unknown): BuilderPalette | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const bg      = cleanHex(p.bg);
  const surface = cleanHex(p.surface);
  const line    = cleanHex(p.line);
  const ink     = cleanHex(p.ink);
  const ink2    = cleanHex(p.ink2);
  const accent  = cleanHex(p.accent);
  const accent2 = cleanHex(p.accent2);
  if (!bg || !surface || !line || !ink || !ink2 || !accent || !accent2) return null;
  return { bg, surface, line, ink, ink2, accent, accent2 };
}

export function parsePublishedPage(raw: string | null | undefined): PublishedPageOverrides | null {
  if (!raw) return null;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;

  const data = parsed as { theme?: unknown; content?: unknown; sections?: unknown };
  const content = (data.content && typeof data.content === 'object' ? data.content : {}) as Record<string, unknown>;
  const theme   = (data.theme   && typeof data.theme   === 'object' ? data.theme   : {}) as Record<string, unknown>;

  const headline = cleanText(content.tagline, 180);
  const bio      = cleanText(content.bio, 2000);
  const bioHtml  = cleanBioHtml(content.bio, 2000);
  const mood     = typeof theme.mood === 'string' ? theme.mood : '';
  const themePreset = MOOD_TO_PRESET[mood] ?? null;

  // Full builder theme
  const builderPalette = extractPalette(theme.palette);
  const fontRaw        = typeof theme.font === 'string' && VALID_FONTS.has(theme.font) ? theme.font : null;
  const builderFont    = fontRaw as 'editorial' | 'grotesk' | 'serif' | 'mono' | null;
  const radiusRaw      = typeof theme.radius === 'number' ? theme.radius : null;
  const builderRadius  = radiusRaw !== null && radiusRaw >= 0 && radiusRaw <= 48 ? Math.round(radiusRaw) : null;
  const builderMood    = mood === 'dark' || mood === 'light' ? mood : null;

  // Section order from draft
  let builderSections: Array<{ id: string; on: boolean }> | null = null;
  if (Array.isArray(data.sections)) {
    const secs = (data.sections as unknown[]).filter(
      (s): s is { id: string; on: boolean } =>
        typeof s === 'object' && s !== null &&
        typeof (s as Record<string, unknown>).id === 'string' &&
        typeof (s as Record<string, unknown>).on === 'boolean'
    );
    if (secs.length > 0) builderSections = secs;
  }

  if (!headline && !bio && !themePreset && !builderPalette) return null;
  return { headline, bio, bioHtml, themePreset, builderPalette, builderFont, builderRadius, builderMood, builderSections };
}
