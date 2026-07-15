import type { SampleVettingResult } from '@/lib/media-vetting';

/**
 * Layers 1 & 2 of the track-upload scan pipeline (acoustic fingerprinting /
 * ACR, and melodic-motif & chord-progression matching) — see
 * runTrackScanPipeline in src/lib/media-vetting.ts.
 *
 * NOT IMPLEMENTED, DELIBERATELY. Real acoustic fingerprinting means matching
 * an uploaded track against a licensed reference database of commercial
 * recordings (the kind of catalog services like ACRCloud, AudD, or Audible
 * Magic sell access to) — this codebase has never had credentials or a
 * contract for such a service, and there is no in-repo equivalent (building
 * one from scratch — collecting/licensing a reference corpus, computing and
 * indexing chromaprint-style fingerprints, running similarity search at
 * upload time — is a real infrastructure project, not something a single
 * engineering pass can respectably fake).
 *
 * Rather than have an LLM "pretend" to fingerprint audio it cannot actually
 * analyze at that level (which would be actively worse than no check at all
 * — it would tell artists and admins a copyright scan happened when it
 * didn't), both functions below return an explicit, honest
 * `configured: false` result. The scan pipeline surfaces this to the
 * uploader/admin as "not configured" rather than "cleared," so nobody reads
 * a false pass as a real guarantee.
 *
 * To make this real: implement `runAcousticFingerprintScan` /
 * `runMelodicFeatureMatch` against a chosen provider's API (needs a
 * server-side credential — see `.env.example` pattern used by the other
 * third-party integrations in this codebase — and that provider's domain
 * added to network egress).
 */

export interface FingerprintScanResult extends SampleVettingResult {
  configured: boolean;
  matchedSource?: string;
}

export async function runAcousticFingerprintScan(_fileBytes: Uint8Array): Promise<FingerprintScanResult> {
  return {
    cleared: true,
    requiresManualReview: false,
    configured: false,
    reasoning: 'Acoustic fingerprinting (ACR) requires a licensed reference-audio catalog service (e.g. ACRCloud, AudD, Audible Magic); none is configured in this codebase.',
  };
}

export async function runMelodicFeatureMatch(_fileBytes: Uint8Array): Promise<FingerprintScanResult> {
  return {
    cleared: true,
    requiresManualReview: false,
    configured: false,
    reasoning: 'Melodic/chord-progression motif matching requires a music-information-retrieval service with a reference corpus; none is configured in this codebase.',
  };
}
