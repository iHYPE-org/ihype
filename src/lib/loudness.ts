/**
 * Programme loudness (ITU-R BS.1770-4) measured from decoded PCM.
 *
 * WHY THIS EXISTS. Uploads arrive at whatever level the artist's own chain
 * produced — a mastered single sits near -8 LUFS, a bedroom bounce near -20 —
 * and the station plays them back to back at whatever that was. The listener
 * reaches for the volume knob every third track, which is the single most
 * audible quality defect this product has and the one nothing in the pipeline
 * measured.
 *
 * WHERE IT RUNS. In the BROWSER, at upload, over `decodeAudioData` output.
 * Not on the server: the Worker gets 128 MB and 1500 ms of CPU, and
 * K-weighting a five-minute stereo master is hundreds of millions of
 * multiply-accumulates over PCM that only exists after a decode the Worker
 * cannot do. The uploader's machine has already decoded the file to show a
 * waveform; measuring there costs a few hundred milliseconds of a moment the
 * member is already waiting through.
 *
 * A client-reported figure is therefore what reaches the database, and
 * `src/lib/track-gain.ts` explains why that is safe: playback only ever
 * ATTENUATES, so under-reporting your own loudness buys exactly what not
 * measuring at all already buys, and over-reporting makes you quieter.
 *
 * This module is pure and imports nothing — no DOM, no AudioContext — so the
 * unit suite can drive it with synthetic signals against the compliance
 * figures the standard publishes.
 */

/** Absolute gate (BS.1770-4 §Annex 1): blocks quieter than this never count. */
const ABSOLUTE_GATE_LUFS = -70;
/** Relative gate: 10 LU below the ungated mean of the surviving blocks. */
const RELATIVE_GATE_LU = 10;
/** The standard's 400 ms block, stepped at 75% overlap. */
const BLOCK_SECONDS = 0.4;
const OVERLAP = 0.75;
/** Calibration offset that makes a 1 kHz sine read its own dBFS level. */
const LOUDNESS_OFFSET = -0.691;

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/**
 * The two K-weighting stages, derived from the analogue prototype rather than
 * copied from the standard's 48 kHz coefficient table — uploads arrive at
 * 44.1, 48, 96 and everything between, and a 48 kHz table applied to a 44.1
 * kHz file mis-weights the whole spectrum while still producing a plausible
 * number.
 */
export function kWeightingStages(sampleRate: number): [Biquad, Biquad] {
  // Stage 1: high-frequency shelf, the "head effect" of the standard.
  const shelfDb = 3.999843853973347;
  const shelfF0 = 1681.974450955533;
  const shelfQ = 0.7071752369554196;
  const k1 = Math.tan((Math.PI * shelfF0) / sampleRate);
  const vh = Math.pow(10, shelfDb / 20);
  const vb = Math.pow(vh, 0.4996667741545416);
  const a0s = 1 + k1 / shelfQ + k1 * k1;
  const shelf: Biquad = {
    b0: (vh + (vb * k1) / shelfQ + k1 * k1) / a0s,
    b1: (2 * (k1 * k1 - vh)) / a0s,
    b2: (vh - (vb * k1) / shelfQ + k1 * k1) / a0s,
    a1: (2 * (k1 * k1 - 1)) / a0s,
    a2: (1 - k1 / shelfQ + k1 * k1) / a0s,
  };

  // Stage 2: RLB high-pass, which is what stops low-frequency energy nobody
  // perceives as loudness from dominating the measurement.
  const hpF0 = 38.13547087602444;
  const hpQ = 0.5003270373238773;
  const k2 = Math.tan((Math.PI * hpF0) / sampleRate);
  const a0h = 1 + k2 / hpQ + k2 * k2;
  const highpass: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (k2 * k2 - 1)) / a0h,
    a2: (1 - k2 / hpQ + k2 * k2) / a0h,
  };

  return [shelf, highpass];
}

/**
 * Direct-form-I biquad, written INTO a caller-owned scratch buffer rather
 * than returning a new one. That is a memory decision, not a style one: this
 * runs in a phone browser on a decoded lossless master, where the PCM alone
 * can be a quarter of a gigabyte, and allocating a filtered copy per channel
 * per stage was enough to lose the tab.
 */
function filterInto(source: Float32Array, target: Float32Array, stage: Biquad): void {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < source.length; i += 1) {
    const x0 = source[i];
    const y0 = stage.b0 * x0 + stage.b1 * x1 + stage.b2 * x2 - stage.a1 * y1 - stage.a2 * y2;
    target[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
}

/**
 * Surround weights. Only the surround pair is weighted up; a stereo or mono
 * upload — which is every upload this product has ever taken — is all 1.0.
 */
function channelWeight(index: number): number {
  return index >= 3 ? 1.41 : 1.0;
}

export type LoudnessMeasurement = {
  /** Gated programme loudness, LUFS. */
  integratedLufs: number;
  /**
   * SAMPLE peak in dBFS, deliberately not true peak: a true-peak reading
   * needs 4x oversampling, and the only thing peak is used for here is
   * refusing to boost into a clip — which cannot happen, because playback
   * never boosts. A future boost pass MUST re-measure true peak rather than
   * trusting this column.
   */
  peakDbfs: number;
};

/**
 * Returns null rather than a number when the input cannot support one: no
 * channels, a nonsense sample rate, or less than one 400 ms block of audio.
 * A null is stored as "unmeasured", which plays at unity — never as 0 or as
 * the target, both of which would be claims about a recording nobody read.
 */
export function measureLoudness(channels: Float32Array[], sampleRate: number): LoudnessMeasurement | null {
  if (!Array.isArray(channels) || channels.length === 0) return null;
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 384000) return null;

  const frames = channels[0]?.length ?? 0;
  const blockSize = Math.round(BLOCK_SECONDS * sampleRate);
  if (frames < blockSize) return null;
  /* Every channel is filtered through one shared scratch buffer, so a short
     channel would leave the previous channel's tail in it and be measured as
     that. An AudioBuffer never does this; a hand-built array can. */
  if (channels.some((channel) => channel.length !== frames)) return null;

  let peak = 0;
  const [shelf, highpass] = kWeightingStages(sampleRate);
  const step = Math.max(1, Math.round(blockSize * (1 - OVERLAP)));
  const blockCount = Math.floor((frames - blockSize) / step) + 1;
  if (blockCount <= 0) return null;

  /* Mean square per block, summed across channels with their weights. Kept as
     raw power rather than dB so the two gating passes below can average in
     the power domain, which is what the standard specifies — averaging
     decibels instead is the classic way to get a plausible wrong answer.

     Accumulated one channel at a time so only ONE filtered copy exists at
     once; see filterInto above for why that matters. */
  const blockPower = new Float64Array(blockCount);
  const scratch = new Float32Array(frames);

  for (let c = 0; c < channels.length; c += 1) {
    const channel = channels[c];
    for (let i = 0; i < channel.length; i += 1) {
      const magnitude = Math.abs(channel[i]);
      if (magnitude > peak) peak = magnitude;
    }
    filterInto(channel, scratch, shelf);
    filterInto(scratch, scratch, highpass);

    const weight = channelWeight(c);
    for (let block = 0; block < blockCount; block += 1) {
      const start = block * step;
      let squares = 0;
      for (let i = start; i < start + blockSize; i += 1) {
        const sample = scratch[i] ?? 0;
        squares += sample * sample;
      }
      blockPower[block] += weight * (squares / blockSize);
    }
  }

  const loudnessOf = (power: number) => LOUDNESS_OFFSET + 10 * Math.log10(power);

  const aboveAbsolute = Array.from(blockPower).filter((power) => power > 0 && loudnessOf(power) > ABSOLUTE_GATE_LUFS);
  if (aboveAbsolute.length === 0) return null;

  const ungatedMean = aboveAbsolute.reduce((total, power) => total + power, 0) / aboveAbsolute.length;
  const relativeGate = loudnessOf(ungatedMean) - RELATIVE_GATE_LU;
  const gated = aboveAbsolute.filter((power) => loudnessOf(power) > relativeGate);
  const pool = gated.length > 0 ? gated : aboveAbsolute;

  const mean = pool.reduce((total, power) => total + power, 0) / pool.length;
  if (!(mean > 0)) return null;

  return {
    integratedLufs: loudnessOf(mean),
    peakDbfs: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
  };
}
