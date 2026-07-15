/**
 * Real embedded-metadata extraction — Layer 0 of the track-upload scan
 * pipeline (see src/lib/media-vetting.ts's runTrackScanPipeline).
 *
 * This is a genuine binary parser of the ID3v2 tag frame structure (not an
 * AI judgment call) — it reads the actual TIT2/TPE1/TALB/TCOP/TSRC frames a
 * rip tool typically preserves from the source release, which the free-text
 * title/artist fields on the upload form cannot see. A re-uploaded
 * commercial rip frequently still carries the original artist/copyright
 * tags even when the uploader types a different title into the form, which
 * is exactly the gap this closes.
 *
 * Only ID3v2 (MP3) is supported. WAV/FLAC have their own, different
 * metadata containers (RIFF INFO / Vorbis comments) — not implemented here;
 * files in those formats simply return `null` (no tags found), which the
 * caller treats as "nothing to check," not a failure.
 */

export interface Id3Tags {
  title: string | null;
  artist: string | null;
  album: string | null;
  copyright: string | null;
  isrc: string | null;
}

const TEXT_FRAME_IDS = {
  TIT2: 'title',
  TPE1: 'artist',
  TALB: 'album',
  TCOP: 'copyright',
  TSRC: 'isrc',
} as const;

function decodeTextFrame(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const encodingByte = bytes[0];
  const body = bytes.subarray(1);
  try {
    if (encodingByte === 0) {
      // ISO-8859-1
      return new TextDecoder('iso-8859-1').decode(body).replace(/\0+$/, '').trim();
    }
    if (encodingByte === 1 || encodingByte === 2) {
      // UTF-16 (with or without BOM)
      return new TextDecoder('utf-16').decode(body).replace(/\0+$/, '').trim();
    }
    // encodingByte === 3: UTF-8
    return new TextDecoder('utf-8').decode(body).replace(/\0+$/, '').trim();
  } catch {
    return '';
  }
}

function readSynchsafeInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

/**
 * Parses ID3v2.3/2.4 tag frames from the start of an MP3 file's bytes.
 * Returns null if no valid ID3v2 header is present (not an MP3, ID3v1-only,
 * or a WAV/FLAC file), or if every recognized frame is empty.
 */
export function parseId3Tags(fileBytes: Uint8Array): Id3Tags | null {
  if (fileBytes.length < 10) return null;
  // ID3v2 header: "ID3" + version (2 bytes) + flags (1 byte) + synchsafe size (4 bytes)
  if (fileBytes[0] !== 0x49 || fileBytes[1] !== 0x44 || fileBytes[2] !== 0x33) return null;

  const majorVersion = fileBytes[3];
  if (majorVersion < 2 || majorVersion > 4) return null;

  const tagSize = readSynchsafeInt(fileBytes, 6);
  const tagEnd = Math.min(10 + tagSize, fileBytes.length);

  const found: Partial<Record<(typeof TEXT_FRAME_IDS)[keyof typeof TEXT_FRAME_IDS], string>> = {};
  let offset = 10;
  const frameIdLength = 4;
  const frameHeaderLength = majorVersion === 2 ? 6 : 10;

  while (offset + frameHeaderLength <= tagEnd) {
    let frameId: string;
    let frameSize: number;

    if (majorVersion === 2) {
      frameId = String.fromCharCode(fileBytes[offset], fileBytes[offset + 1], fileBytes[offset + 2]);
      frameSize = (fileBytes[offset + 3] << 16) | (fileBytes[offset + 4] << 8) | fileBytes[offset + 5];
    } else {
      frameId = String.fromCharCode(
        fileBytes[offset], fileBytes[offset + 1], fileBytes[offset + 2], fileBytes[offset + 3],
      );
      frameSize = majorVersion === 4
        ? readSynchsafeInt(fileBytes, offset + 4)
        : (fileBytes[offset + 4] << 24) | (fileBytes[offset + 5] << 16) | (fileBytes[offset + 6] << 8) | fileBytes[offset + 7];
    }

    if (frameSize <= 0 || offset + frameHeaderLength + frameSize > tagEnd) break;
    // Stop on padding (all-zero bytes) which commonly follows the real frames.
    if (frameId.charCodeAt(0) === 0) break;

    const normalizedId = majorVersion === 2 ? mapV2FrameId(frameId) : frameId;
    if (normalizedId && normalizedId in TEXT_FRAME_IDS) {
      const frameBody = fileBytes.subarray(offset + frameHeaderLength, offset + frameHeaderLength + frameSize);
      const key = TEXT_FRAME_IDS[normalizedId as keyof typeof TEXT_FRAME_IDS];
      const value = decodeTextFrame(frameBody);
      if (value) found[key] = value;
    }

    offset += frameHeaderLength + frameSize;
  }

  if (Object.keys(found).length === 0) return null;

  return {
    title: found.title ?? null,
    artist: found.artist ?? null,
    album: found.album ?? null,
    copyright: found.copyright ?? null,
    isrc: found.isrc ?? null,
  };
}

// ID3v2.2 used 3-character frame IDs; map the ones we care about to their
// v2.3/2.4 equivalents so the rest of the parser only deals with one shape.
function mapV2FrameId(id: string): string | null {
  const map: Record<string, string> = { TT2: 'TIT2', TP1: 'TPE1', TAL: 'TALB', TCR: 'TCOP', TRC: 'TSRC' };
  return map[id] ?? null;
}
