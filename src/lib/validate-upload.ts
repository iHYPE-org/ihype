/**
 * What an audio upload IS, read from its bytes rather than its name.
 *
 * Owner, 2026-09-02: "Any audio format is acceptable so long as we can play it
 * without breaking any licensing restrictions. No video." So the rule is
 * PLAYABILITY on the two players iHYPE actually has — Safari/WKWebView (the
 * iOS app is a WebView at ihype.org) and Chromium (Android and desktop) — not
 * a taste in codecs:
 *
 *   MP3       everywhere; patents expired 2017.
 *   AAC/M4A   everywhere (the OS decoders); ADTS .aac too.
 *   WAV       everywhere; uncompressed, so large.
 *   FLAC      everywhere since Safari 11 / Chrome 56; the lossless choice.
 *   Ogg Vorbis/Opus   Chromium only — Safari does not decode Ogg. REFUSED,
 *             with the reason, so an artist converts rather than uploads a
 *             file half their listeners cannot hear.
 *   AIFF      Safari only. REFUSED for the mirror reason.
 *   WebM      Safari cannot play it, and it is a video container. REFUSED.
 *   ALAC      Apple Lossless in an M4A: Safari only. Not distinguishable from
 *             AAC by the container brand alone, so it passes here and fails
 *             on Chromium at play time — a known gap, noted not hidden.
 *
 * Video is refused wherever the container admits it: a QuickTime or M4V brand,
 * or a `vide` handler anywhere in the sniffed head. iHYPE does not host video,
 * and an audio-only MIME type on a file with a video track is exactly the
 * upload that rule exists for.
 */
export type AudioFormat = 'mp3' | 'aac' | 'm4a' | 'wav' | 'flac' | 'ogg' | 'aiff' | 'webm' | 'video';
export type AudioSniff = { format: AudioFormat; playable: boolean; reason: string | null };

export const PLAYABLE_AUDIO_FORMATS_LABEL = 'MP3, AAC/M4A, WAV or FLAC';
/** How much of the file to hand `sniffAudio` — enough to find an MP4's track handlers. */
export const AUDIO_SNIFF_BYTES = 64 * 1024;

const ascii = (b: Uint8Array, at: number, text: string) => {
  if (at + text.length > b.length) return false;
  for (let i = 0; i < text.length; i += 1) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
};

function containsAscii(b: Uint8Array, text: string): boolean {
  const first = text.charCodeAt(0);
  for (let i = 0; i <= b.length - text.length; i += 1) {
    if (b[i] === first && ascii(b, i, text)) return true;
  }
  return false;
}

const AUDIO_MP4_BRANDS = ['M4A ', 'M4B ', 'M4P ', 'mp41', 'mp42', 'isom', 'iso2', 'iso5', 'iso6', 'dash'];
const VIDEO_MP4_BRANDS = ['qt  ', 'M4V ', 'M4VH', 'M4VP', 'avc1', 'mp71'];

export function sniffAudio(buffer: Uint8Array): AudioSniff | null {
  if (buffer.length < 12) return null;
  const b = buffer;

  if (ascii(b, 0, 'ID3')) return { format: 'mp3', playable: true, reason: null };
  if (ascii(b, 0, 'fLaC')) return { format: 'flac', playable: true, reason: null };
  if (ascii(b, 0, 'RIFF')) {
    if (ascii(b, 8, 'WAVE')) return { format: 'wav', playable: true, reason: null };
    // RIFF that is not WAVE is AVI or WebP — neither is audio.
    return ascii(b, 8, 'AVI ') ? { format: 'video', playable: false, reason: 'iHYPE does not host video.' } : null;
  }
  if (ascii(b, 0, 'FORM') && (ascii(b, 8, 'AIFF') || ascii(b, 8, 'AIFC'))) {
    return { format: 'aiff', playable: false, reason: `AIFF only plays in Safari. Export it as ${PLAYABLE_AUDIO_FORMATS_LABEL}.` };
  }
  if (ascii(b, 0, 'OggS')) {
    return { format: 'ogg', playable: false, reason: `Ogg (Vorbis/Opus) does not play on iPhone or iPad. Export it as ${PLAYABLE_AUDIO_FORMATS_LABEL}.` };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return { format: 'webm', playable: false, reason: `WebM does not play on iPhone or iPad. Export it as ${PLAYABLE_AUDIO_FORMATS_LABEL}.` };
  }
  if (ascii(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (VIDEO_MP4_BRANDS.includes(brand) || containsAscii(b, 'vide')) {
      return { format: 'video', playable: false, reason: 'iHYPE does not host video.' };
    }
    if (AUDIO_MP4_BRANDS.includes(brand) || /^[A-Za-z0-9 ]{4}$/.test(brand)) {
      return { format: 'm4a', playable: true, reason: null };
    }
    return null;
  }
  // ADTS AAC: 12 sync bits then layer 00. Checked before the MP3 sync, whose
  // mask it also satisfies.
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { format: 'aac', playable: true, reason: null };
  // MPEG audio frame sync.
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { format: 'mp3', playable: true, reason: null };
  return null;
}

/** True only for audio the platform's players can all decode. */
export function validateAudioMagicBytes(buffer: Uint8Array): boolean {
  const sniff = sniffAudio(buffer);
  return sniff !== null && sniff.playable;
}
