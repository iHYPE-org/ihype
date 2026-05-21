export function normalizeHexId(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

export function shortenHexId(value: string, visibleChars = 6) {
  const normalized = normalizeHexId(value);
  if (normalized.length <= visibleChars * 2 + 4) {
    return normalized;
  }

  return `${normalized.slice(0, visibleChars + 2)}...${normalized.slice(-visibleChars)}`;
}
