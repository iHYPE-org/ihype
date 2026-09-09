/**
 * How a measured loudness becomes a playback level.
 *
 * TWO PATHS, AND THE DIFFERENCE IS WHY THIS FILE IS SHAPED THE WAY IT IS.
 * Turning a loud track DOWN needs nothing but `HTMLMediaElement.volume`, so
 * it works everywhere, always. Turning a quiet track UP needs gain above
 * unity, which a media element cannot do — only a Web Audio `GainNode` can —
 * so it is best-effort and falls back to unity wherever that graph cannot be
 * built. `resolvePlaybackGain()` returns the two separately for that reason:
 * the attenuation half must never depend on the boost half working.
 *
 * WHAT BOOST COSTS, STATED BECAUSE IT WEAKENS A GUARANTEE THIS FILE USED TO
 * MAKE. While playback only attenuated, a client-reported measurement was
 * safe by construction: under-reporting bought exactly what not measuring
 * bought, so no lie won. With boost, under-reporting can win up to
 * `MAX_BOOST_DB`. Three things bound it and none of them is a server-side
 * check, because the Worker cannot decode audio to verify anything: the cap
 * is small, the headroom rule below refuses boost to anything that would
 * clip, and a track with no measurement is never boosted. A member who
 * reports -30 LUFS for a loud master gets at most 6 dB, and gets none of it
 * if they report the true peak honestly.
 *
 * THE OLD RULE, still true of the attenuation half: playback attenuates. A track measured louder than the target is turned down; a track
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
 * The most a track is ever turned UP. Small on purpose: it is the size of the
 * advantage an under-reported measurement can buy, and no real recording that
 * needs more than 6 dB is going to sound good with it.
 */
export const MAX_BOOST_DB = 6;

/**
 * Boost never takes the reconstructed waveform above this. A true peak is
 * what a converter actually produces, so -1 dBTP is the working headroom
 * every mastering guide asks for; boosting to 0 clips on playback in a way
 * that is audible and permanent.
 */
export const TRUE_PEAK_CEILING_DBTP = -1;

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
 *
 * Attenuation only — a quiet track reads 1 here, and comes up through the
 * boost half of `resolvePlaybackGain()` if a Web Audio graph is available.
 */
export function trackGainMultiplier(loudnessLufs: number | null | undefined): number {
  const db = trackGainDb(loudnessLufs);
  if (db === 0) return 1;
  return Math.pow(10, db / 20);
}

export type PlaybackGain = {
  /** For `HTMLMediaElement.volume`, in (0, 1]. Always applicable. */
  elementMultiplier: number;
  /** For a Web Audio `GainNode`, >= 1. Needs the graph; 1 means none needed. */
  boost: number;
};

/**
 * How much of the correction each half of the chain carries.
 *
 * A track needing attenuation puts it all on the element and asks for no
 * boost, which is exactly what shipped before boost existed. A track needing
 * lift asks for it only as far as its own headroom allows: the reported true
 * peak decides, and a track that never reported one is NOT boosted, because
 * the alternative is guessing at headroom and clipping when the guess is
 * wrong. `peakDbfs` is accepted as a fallback and is conservative — a sample
 * peak is never above the true peak, so using it can only under-boost.
 */
export function resolvePlaybackGain(track: {
  loudnessLufs?: number | null;
  truePeakDbtp?: number | null;
  peakDbfs?: number | null;
}): PlaybackGain {
  const measured = clampMeasuredLoudness(track.loudnessLufs);
  if (measured === null) return { elementMultiplier: 1, boost: 1 };

  const wanted = TARGET_LUFS - measured;
  if (wanted <= 0) {
    return { elementMultiplier: trackGainMultiplier(measured), boost: 1 };
  }

  const peak = clampMeasuredPeak(track.truePeakDbtp) ?? clampMeasuredPeak(track.peakDbfs);
  if (peak === null) return { elementMultiplier: 1, boost: 1 };

  const headroom = TRUE_PEAK_CEILING_DBTP - peak;
  const db = Math.min(wanted, MAX_BOOST_DB, headroom);
  if (db <= 0) return { elementMultiplier: 1, boost: 1 };
  return { elementMultiplier: 1, boost: Math.pow(10, db / 20) };
}
