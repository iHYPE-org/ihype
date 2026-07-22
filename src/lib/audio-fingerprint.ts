import type { SampleVettingResult } from '@/lib/media-vetting';
import { identifyAudio } from '@/lib/acrcloud';

/**
 * Layers 1 & 2 of the track-upload scan pipeline — see runTrackScanPipeline
 * in src/lib/media-vetting.ts.
 *
 * Layer 1 (acoustic fingerprinting / ACR) is now wired to ACRCloud
 * (src/lib/acrcloud.ts), the licensed reference-audio catalog service
 * selected for upload filtration. It's active whenever the ACRCLOUD_* env
 * vars are set; without them it reports `configured: false` and the scan
 * layer shows "not configured" rather than a false pass — the same honest
 * posture as before, just now with a real backend behind the switch.
 *
 * Layer 2 (melodic-motif / chord-progression matching) stays
 * `configured: false`: ACRCloud's standard identify covers acoustic /
 * near-exact recording matches (Layer 1's job), not melodic-cover detection.
 * ACRCloud does offer separate cover-song / humming buckets, but enabling
 * those is a distinct project-side configuration — left as honest
 * "not configured" rather than claiming a melodic analysis we aren't running.
 */

export interface FingerprintScanResult extends SampleVettingResult {
  configured: boolean;
  matchedSource?: string;
}

export async function runAcousticFingerprintScan(fileBytes: Uint8Array): Promise<FingerprintScanResult> {
  const outcome = await identifyAudio(fileBytes);

  switch (outcome.status) {
    case 'not-configured':
      return {
        cleared: true,
        requiresManualReview: false,
        configured: false,
        reasoning:
          'Acoustic fingerprinting (ACR) is not configured — set ACRCLOUD_HOST / ACRCLOUD_ACCESS_KEY / ACRCLOUD_ACCESS_SECRET to enable ACRCloud matching.',
      };
    case 'no-match':
      return {
        cleared: true,
        requiresManualReview: false,
        configured: true,
        reasoning: 'No acoustic-fingerprint match against ACRCloud’s commercial-recording catalog.',
      };
    case 'match':
      // A fingerprint match to a known commercial recording is a strong,
      // unambiguous copyright signal — flag it (not "manual review"), which
      // routes to an auto_flag_copyright ContentReport and keeps the track
      // out of the free-use crate. Fail-open still applies: the upload itself
      // succeeds; it just doesn't go live as free-use, and an admin sees it.
      return {
        cleared: false,
        requiresManualReview: false,
        configured: true,
        matchedSource: outcome.matchedSource,
        reasoning: `Acoustic fingerprint matched a known commercial recording via ACRCloud: ${outcome.matchedSource}${
          outcome.score != null ? ` (match score ${outcome.score})` : ''
        }.`,
      };
    case 'error':
    default:
      // Fail-open, matching every other vetting function in this codebase: a
      // scan that couldn't complete allows the upload — but says so honestly
      // rather than reporting a clean pass.
      return {
        cleared: true,
        requiresManualReview: false,
        configured: true,
        reasoning: `ACRCloud scan could not complete (${
          outcome.status === 'error' ? outcome.detail : 'unknown'
        }); allowed by default.`,
      };
  }
}

export async function runMelodicFeatureMatch(_fileBytes: Uint8Array): Promise<FingerprintScanResult> {
  return {
    cleared: true,
    requiresManualReview: false,
    configured: false,
    reasoning:
      'Melodic/chord-progression motif matching (cover-song / humming detection) is a separate ACRCloud bucket configuration, not enabled here; the acoustic-fingerprint layer covers exact/near-exact commercial-recording matches.',
  };
}
