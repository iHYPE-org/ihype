// Shared shape for Profile.pressKitContent (a JSON string column). Written by
// the PageEditor "Press kit" section, rendered by /artists/[slug]/epk and
// /artists/[slug]/presskit. Parsing is defensive: the column is user-supplied
// JSON, so anything malformed degrades to an empty kit instead of throwing.

export interface PressKitQuote {
  quote: string;
  source: string;
}

export interface PressKit {
  tagline: string;
  quotes: PressKitQuote[];
  achievements: string[];
  contactEmail: string;
}

export const EMPTY_PRESS_KIT: PressKit = {
  tagline: '',
  quotes: [],
  achievements: [],
  contactEmail: '',
};

const MAX_ITEMS = 20;

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function parsePressKit(raw: string | null | undefined): PressKit {
  if (!raw) return EMPTY_PRESS_KIT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_PRESS_KIT;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_PRESS_KIT;
  const obj = parsed as Record<string, unknown>;

  const quotes: PressKitQuote[] = Array.isArray(obj.quotes)
    ? obj.quotes
        .slice(0, MAX_ITEMS)
        .map((q) => {
          const item = (q ?? {}) as Record<string, unknown>;
          return { quote: cleanString(item.quote, 500), source: cleanString(item.source, 160) };
        })
        .filter((q) => q.quote)
    : [];

  const achievements: string[] = Array.isArray(obj.achievements)
    ? obj.achievements
        .slice(0, MAX_ITEMS)
        .map((a) => cleanString(a, 300))
        .filter(Boolean)
    : [];

  return {
    tagline: cleanString(obj.tagline, 200),
    quotes,
    achievements,
    contactEmail: cleanString(obj.contactEmail, 200),
  };
}

export function serializePressKit(kit: PressKit): string | null {
  const cleaned = parsePressKit(JSON.stringify(kit));
  const hasContent =
    cleaned.tagline || cleaned.contactEmail || cleaned.quotes.length > 0 || cleaned.achievements.length > 0;
  return hasContent ? JSON.stringify(cleaned) : null;
}
