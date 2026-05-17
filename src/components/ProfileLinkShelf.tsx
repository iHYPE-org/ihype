type LinkItem = { label: string; url: string };

export function ProfileLinkShelf({ linksJson }: { linksJson: string | null }) {
  if (!linksJson) return null;

  let links: LinkItem[] = [];
  try {
    const parsed = JSON.parse(linksJson) as unknown;
    if (Array.isArray(parsed)) {
      links = parsed.filter(
        (item): item is LinkItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).label === 'string' &&
          typeof (item as Record<string, unknown>).url === 'string'
      );
    }
  } catch {
    return null;
  }

  if (links.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="button small secondary"
          style={{ fontSize: 12 }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
