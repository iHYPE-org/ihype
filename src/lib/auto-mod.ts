const BANNED_PATTERNS = [
  /\b(buy followers|get rich|make money fast|click here|dm for promo)\b/i,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // phone numbers
  /(payment\.link|cashapp|venmo|paypal\.me|zelle)/i,
];

export function checkContent(text: string): { flagged: boolean; reason?: string } {
  if (!text) return { flagged: false };
  const trimmed = text.trim();
  // Excessive caps check (>60% caps in text > 20 chars)
  if (trimmed.length > 20) {
    const capsRatio = (trimmed.match(/[A-Z]/g)?.length ?? 0) / trimmed.replace(/\s/g, '').length;
    if (capsRatio > 0.6) return { flagged: true, reason: 'excessive_caps' };
  }
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) return { flagged: true, reason: 'banned_pattern' };
  }
  return { flagged: false };
}
