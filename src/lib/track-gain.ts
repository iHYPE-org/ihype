/**
 * How a measured loudness becomes a playback level.
 *
 * ONE RULE, AND EVERYTHING ELSE FOLLOWS FROM IT: playback only ever
 * ATTENUATES. A track measured louder than the target is turned down; a track
 * measured quieter is left exactly as it is, and so is a track nobody
 * measured. That is what makes a client-reported measurement safe to trust.
 * The figure is measured in the uploader's own browser (`src/lib/loudness.ts`)
 * because the Worker cannot decode audio, so an artist could report anything —
 * but under-reporting buys precisely what NOT measuring already buys, which is
 * nothing, and over-reporting only makes them quieter. There is no lie that
 * wins, which is a stronger guarantee than any server-side check this product
 * could afford.
 *
 * The cost of the rule is that a quiet upload stays quiet. Fixing that needs
 * gain ABOVE unity, which a media element cannot do — it needs a Web Audio
 * GainNode wired through `GlobalMediaPlayer`, the one component that must
 * never break. The measurements are stored so that pass can be built later
 * without asking every artist to re-upload; it must re-measure TRUE peak
 * first, because `peakDbfs` is a sample peak and boosting to it clips between
 * samples.
 */

/** Where the station aims. -14 LUFS is the level the streaming services
 *  converged on, so a track that already went through one of them arrives
 *  needing no correction at all. */
export const TARGET_LUFS = -14;

/**
 * The most a track is ever turned down. A measurement can be wrong — a
 * mis-decoded file, a browser bug, a member editing the request — and without
 * a floor a wrong number plays a real recording at silence. 12 dB covers
 * every genuinely over-compressed master (the loudest real releases sit near
 * -5 LUFS) and turns a nonsense one into "too quiet" rather than "gone".
 */
export const MAX_ATTENUATION_DB = -12;

/** Plausible bounds for a stored measurement. Anything outside is not a
 *  quieter or louder recording, it is a broken reading, and is discarded. */
const LOUDNESS_MIN = -70;
const LOUDNESS_MAX = 0;
const PEAK_MIN = -100;
const PEAK_MAX = 12;

function clampFinite(value: unknown, min: number, max: number): number | null {
  /* `Number(null)` is 0 and `Number('')` is 0, and 0 is inside every range
     here — so coercing first would read "no measurement" as "exactly full
     scale" and attenuate a track nobody measured. Only a real number counts. */
  if (typeof value !== 'number') return null;
  const numeric = value;
  if (!Number.isFinite(numeric)) return null;
  if (numeric < min || numeric > max) return null;
  return numeric;
}

/** A reported programme loudness, or null if it is not a usable reading. */
export function clampMeasuredLoudness(value: unknown): number | null {
  return clampFinite(value, LOUDNESS_MIN, LOUDNESS_MAX);
}

/** A reported sample peak, or null. Above 0 dBFS is legal — a decoded float
 *  buffer really can exceed full scale — so the ceiling is generous. */
export function clampMeasuredPeak(value: unknown): number | null {
  return clampFinite(value, PEAK_MIN, PEAK_MAX);
}

/**
 * Attenuation in dB for a track, always <= 0. An unmeasured track gets 0,
 * which is the same answer as a track that is already at or below target —
 * deliberately, since that equivalence is what removes the incentive to lie.
 */
export function trackGainDb(loudnessLufs: number | null | undefined): number {
  const measured = clampMeasuredLoudness(loudnessLufs);
  if (measured === null) return 0;
  return Math.max(MAX_ATTENUATION_DB, Math.min(0, TARGET_LUFS - measured));
}

/**
 * The same figure as a multiplier for `HTMLMediaElement.volume`, in (0, 1].
 * Multiply the member's own volume by this; never assign it directly, or the
 * volume control stops working on normalised tracks.
 */
export function trackGainMultiplier(loudnessLufs: number | null | undefined): number {
  const db = trackGainDb(loudnessLufs);
  if (db === 0) return 1;
  return Math.pow(10, db / 20);
}
