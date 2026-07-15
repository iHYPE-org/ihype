import { runAIJson, runTranscription } from '@/lib/ai';
import { parseId3Tags } from '@/lib/id3-tags';
import { runAcousticFingerprintScan, runMelodicFeatureMatch } from '@/lib/audio-fingerprint';

export interface SampleUploadData {
  title: string;
  notes: string | null;
  fileName: string;
  artistName: string;
  durationSecs: number | null;
}

export interface SampleVettingResult {
  cleared: boolean;
  requiresManualReview: boolean;
  reasoning: string;
}

type RawVetting = { cleared?: boolean; requiresManualReview?: boolean; reasoning?: string };

/**
 * AI vetting for tracks a DJ/artist marks as free-use — the pool every Radio
 * Show Creator crate and the shared WebRadio catalogue draw from. Screens the
 * declared metadata for copyright red flags (rips of famous commercial
 * recordings, "official audio" bootlegs) and content-policy problems so the
 * shared crate stays clean without an admin pass.
 *
 * Fail-open by design: when the AI binding is unavailable (local dev) the
 * upload behaves exactly as before. A flagged track is still uploaded for the
 * artist's own use — only the free-use flag is withheld.
 */
export async function vetFreeUseSample(data: SampleUploadData): Promise<SampleVettingResult> {
  const result = await runAIJson<RawVetting>({
    system: `You are the automated content-vetting officer for iHYPE.org's free-use radio crate — audio that DJs may rebroadcast in radio shows, so it must be the uploader's own cleared work.

Judge ONLY the metadata provided (you cannot hear the audio). Flag as NOT cleared when the metadata suggests:
- A well-known commercial recording by a famous artist that this uploader is unlikely to own (e.g. the title/filename names a charting song or superstar act other than the uploader)
- Bootleg/rip markers: "official audio", "official video rip", "from Spotify/YouTube", "full album", radio airchecks of other stations
- Hate speech, harassment, or sexual content involving minors in the title or notes
- Spam or advertising disguised as a track

Otherwise mark it cleared — original tracks, remixes clearly labelled as the uploader's own edits of their OWN name, DJ tools, field recordings, and generic titles are all fine.

Set requiresManualReview true only when genuinely ambiguous.

JSON shape: {"cleared": boolean, "requiresManualReview": boolean, "reasoning": "one short sentence"}`,
    input: {
      title: data.title,
      notes: data.notes,
      fileName: data.fileName,
      uploaderArtistName: data.artistName,
      durationSecs: data.durationSecs,
    },
    maxTokens: 256,
  });

  if (!result) {
    // AI unavailable — preserve pre-AI behaviour (allow) rather than blocking
    // every upload in environments without the Workers AI binding.
    return { cleared: true, requiresManualReview: false, reasoning: 'Automated vetting unavailable; allowed by default.' };
  }

  return {
    cleared: !!result.cleared && !result.requiresManualReview,
    requiresManualReview: !!result.requiresManualReview,
    reasoning: typeof result.reasoning === 'string' && result.reasoning
      ? result.reasoning.slice(0, 300)
      : 'No reasoning provided.',
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Layer 0 of the scan pipeline — checks the track's actual embedded ID3v2
 * metadata (src/lib/id3-tags.ts) against the uploader's declared artist
 * name. This is a real binary-parse of the file, not an AI judgment call,
 * and catches a specific real-world case the form-field checks above
 * cannot: a ripped MP3 whose embedded TPE1/TCOP frames still name the
 * original commercial artist/label even though the uploader typed a
 * different name into the web form.
 *
 * WAV/FLAC files and MP3s with no ID3v2 tag simply have nothing to check
 * here (`parseId3Tags` returns null) — that's treated as cleared, not
 * flagged, since the absence of embedded metadata is not itself suspicious.
 */
export function vetId3Metadata(fileBytes: Uint8Array, declaredArtistName: string): SampleVettingResult {
  const tags = parseId3Tags(fileBytes);
  if (!tags) {
    return { cleared: true, requiresManualReview: false, reasoning: 'No embedded ID3 metadata found.' };
  }

  const declared = normalize(declaredArtistName);
  const embeddedArtist = tags.artist ? normalize(tags.artist) : '';
  const embeddedCopyright = tags.copyright ? normalize(tags.copyright) : '';

  const artistMismatch = embeddedArtist && declared && !embeddedArtist.includes(declared) && !declared.includes(embeddedArtist);
  const copyrightMismatch = embeddedCopyright && declared && !embeddedCopyright.includes(declared);

  if (artistMismatch || copyrightMismatch) {
    const parts = [
      tags.artist ? `embedded artist tag reads "${tags.artist}"` : null,
      tags.copyright ? `embedded copyright tag reads "${tags.copyright}"` : null,
    ].filter(Boolean).join('; ');
    return {
      cleared: false,
      requiresManualReview: true,
      reasoning: `Uploader declared artist "${declaredArtistName}" but ${parts} — does not match the declared uploader.`,
    };
  }

  return { cleared: true, requiresManualReview: false, reasoning: 'Embedded ID3 metadata (if any) is consistent with the declared uploader.' };
}

/**
 * Real audio-content check, not just metadata — vetFreeUseSample above can
 * only judge the declared title/filename, which a re-upload can simply lie
 * about. Transcribes any vocal/lyric content (Workers AI Whisper, same
 * technique as vetAdAudioContent in src/lib/ad-vetting.ts) and checks
 * whether the words match a well-known commercial recording the uploader
 * is unlikely to own. Instrumental tracks transcribe to nothing and pass
 * through untouched — this is a lyrics/vocal check, not a full acoustic
 * fingerprint match against a commercial catalog (no such service is
 * configured in this codebase; see CLAUDE.md).
 *
 * Fail-open by design, same as every vetting function in this codebase.
 */
export async function vetTrackAudioContent(audioBytes: Uint8Array, title: string, artistName: string): Promise<SampleVettingResult> {
  const transcript = await runTranscription(audioBytes);
  if (!transcript || !transcript.trim()) {
    return { cleared: true, requiresManualReview: false, reasoning: 'No transcribable lyrics/vocals detected or transcription unavailable; allowed by default.' };
  }

  const result = await runAIJson<RawVetting>({
    system: `You are the automated content-vetting officer for iHYPE.org. You are given a speech-to-text transcript of an uploaded track's lyrics/vocals, from an uploader claiming the artist name "${artistName}" and title "${title}".

Flag as NOT cleared only if the transcribed words are recognizable lyrics from a well-known commercial song by a different, famous artist — i.e. clear evidence this is a bootleg/rip rather than the uploader's own work.

Otherwise mark it cleared. Most transcripts (original lyrics, ad-libs, DJ tags, unclear/garbled speech-to-text output) are fine — only flag a confident, specific match to a known hit song.

Set requiresManualReview true only when genuinely ambiguous (transcript sounds like it could be a known song but you're not certain).

JSON shape: {"cleared": boolean, "requiresManualReview": boolean, "reasoning": "one short sentence"}`,
    input: { transcriptSnippet: transcript.slice(0, 2000) },
    maxTokens: 200,
  });

  if (!result) {
    return { cleared: true, requiresManualReview: false, reasoning: 'Automated audio-content vetting unavailable; allowed by default.' };
  }

  return {
    cleared: !!result.cleared && !result.requiresManualReview,
    requiresManualReview: !!result.requiresManualReview,
    reasoning: typeof result.reasoning === 'string' && result.reasoning
      ? result.reasoning.slice(0, 300)
      : 'No reasoning provided.',
  };
}

export interface TrackScanLayer {
  layer: 0 | 1 | 2 | 3;
  name: string;
  configured: boolean;
  cleared: boolean;
  requiresManualReview: boolean;
  reasoning: string;
}

export interface TrackScanResult {
  layers: TrackScanLayer[];
  cleared: boolean;
  requiresManualReview: boolean;
  reasoning: string;
}

/**
 * The 4-layer upload scan pipeline (Artist "Upload track" and DJ "Add to
 * crate" both call this — see CLAUDE.md's wiring table and DESIGN_SYNC.md
 * rows 80/81/83): (0) ID3 tag check, (1) acoustic fingerprinting (ACR),
 * (2) melodic/chord feature matching, (3) vocal/synth AI analysis.
 *
 * Layers 1 & 2 are honestly unconfigured (see src/lib/audio-fingerprint.ts)
 * — they never block an upload or count toward `requiresManualReview`,
 * they're surfaced in `layers` purely so the UI can show "not configured"
 * rather than silently omitting them. Only layers 0 and 3, which do real
 * work, can flag a track.
 *
 * Fail-open by design, same as every vetting function in this codebase: a
 * flagged track still gets uploaded, just kept out of the free-use crate
 * and/or raised into the moderation queue by the caller.
 */
export async function runTrackScanPipeline(
  fileBytes: Uint8Array,
  data: SampleUploadData,
): Promise<TrackScanResult> {
  const id3 = vetId3Metadata(fileBytes, data.artistName);
  const acr = await runAcousticFingerprintScan(fileBytes);
  const feature = await runMelodicFeatureMatch(fileBytes);
  const vocal = await vetTrackAudioContent(fileBytes, data.title, data.artistName);

  const layers: TrackScanLayer[] = [
    { layer: 0, name: 'ID3 tag check', configured: true, ...id3 },
    { layer: 1, name: 'Acoustic fingerprinting (ACR)', ...acr },
    { layer: 2, name: 'Feature & motif matching', ...feature },
    { layer: 3, name: 'Vocal & synth AI analysis', configured: true, ...vocal },
  ];

  const blocking = layers.filter((l) => l.configured);
  const flagged = blocking.find((l) => !l.cleared || l.requiresManualReview);

  return {
    layers,
    cleared: !flagged,
    requiresManualReview: !!flagged?.requiresManualReview,
    reasoning: flagged
      ? `Layer "${flagged.name}": ${flagged.reasoning}`
      : 'All configured layers cleared.',
  };
}
