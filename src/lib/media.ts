export type ArtistMediaEntry = {
  id: string;
  hexId: string;
  title: string;
  url: string;
  shareUrl: string;
  notes: string | null;
  source: 'LINKED' | 'UPLOADED';
  mediaType?: 'audio';
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  createdAt?: Date | null;
  previewImageUrl?: string | null;
};

export type ParsedArtistMediaContent = {
  notes: string | null;
  entries: ArtistMediaEntry[];
};

export type ArtistMediaUploadRecord = {
  hexId: string;
  title: string;
  notes: string | null;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: Date;
};

export function getArtistMediaApiPath(hexId: string) {
  return `/api/media/${hexId}`;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function inferMediaType(_value: { mimeType?: string | null; url?: string }) {
  return 'audio' as const;
}

function buildTitleFromUrl(value: string) {
  try {
    const pathname = new URL(value).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop();
    if (!lastSegment) {
      return 'Artist upload';
    }

    return decodeURIComponent(lastSegment)
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return 'Artist upload';
  }
}

function createHexHash(value: string) {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193);
    hashB ^= code + 0x9e3779b9 + (hashB << 6) + (hashB >> 2);
    hashB >>>= 0;
  }

  return `${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

function parseMediaLine(line: string, index: number): ArtistMediaEntry | null {
  const parts = line
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return null;
  }

  const urlIndex = parts.findIndex((part) => isValidUrl(part));
  if (urlIndex === -1) {
    return null;
  }

  const url = parts[urlIndex];
  const metadataParts = parts.filter((_, partIndex) => partIndex !== urlIndex);
  const title = metadataParts[0] || buildTitleFromUrl(url);
  const notes = metadataParts.slice(1).join(' | ') || null;
  const hexId = `0x${createHexHash(`${title}|${url}|${notes ?? ''}|${index}`)}`;

  return {
    id: hexId,
    hexId,
    title,
    url,
    shareUrl: url,
    notes,
    source: 'LINKED',
    mediaType: inferMediaType({ url })
  };
}

export function parseArtistMediaContent(content: string | null | undefined): ParsedArtistMediaContent {
  if (!content?.trim()) {
    return { notes: null, entries: [] };
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: ArtistMediaEntry[] = [];
  const noteLines: string[] = [];

  for (const line of lines) {
    const parsedLine = parseMediaLine(line, entries.length + 1);
    if (parsedLine) {
      entries.push(parsedLine);
    } else {
      noteLines.push(line);
    }
  }

  return {
    notes: noteLines.length ? noteLines.join('\n\n') : null,
    entries
  };
}

export function buildUploadedArtistMediaEntries(uploads: ArtistMediaUploadRecord[]): ArtistMediaEntry[] {
  return uploads.map((upload) => {
    const streamUrl = getArtistMediaApiPath(upload.hexId);

    return {
      id: upload.hexId,
      hexId: upload.hexId,
      title: upload.title,
      url: streamUrl,
      shareUrl: streamUrl,
      notes: upload.notes,
      source: 'UPLOADED',
      mediaType: inferMediaType({ mimeType: upload.mimeType, url: streamUrl }),
      mimeType: upload.mimeType,
      fileSizeBytes: upload.fileSizeBytes,
      createdAt: upload.createdAt
    };
  });
}

export function buildArtistMediaCollection(
  content: string | null | undefined,
  uploads: ArtistMediaUploadRecord[] = []
): ParsedArtistMediaContent {
  const parsedContent = parseArtistMediaContent(content);
  const uploadedEntries = buildUploadedArtistMediaEntries(uploads);

  return {
    notes: parsedContent.notes,
    entries: [...uploadedEntries, ...parsedContent.entries]
  };
}
