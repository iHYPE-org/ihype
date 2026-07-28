import { describe, expect, it } from 'vitest';
import {
  adCampaignStatusFromVetting,
  combineAdAudioLayers,
  type AdAudioLayer,
  type VettingResult,
} from '@/lib/ad-vetting';

const approved: VettingResult = { isApproved: true, requiresManualReview: false, reasoning: 'ok' };
const rejected: VettingResult = { isApproved: false, requiresManualReview: false, reasoning: 'no' };
const borderline: VettingResult = { isApproved: false, requiresManualReview: true, reasoning: 'unsure' };
// requiresManualReview always wins even if isApproved is somehow true.
const borderlineApproved: VettingResult = { isApproved: true, requiresManualReview: true, reasoning: 'unsure' };

describe('adCampaignStatusFromVetting', () => {
  it('maps vetting outcomes to the exact status strings the Ad/AdSlot pipeline writes', () => {
    expect(adCampaignStatusFromVetting(approved)).toBe('APPROVED');
    expect(adCampaignStatusFromVetting(rejected)).toBe('REJECTED');
    expect(adCampaignStatusFromVetting(borderline)).toBe('PENDING');
    expect(adCampaignStatusFromVetting(borderlineApproved)).toBe('PENDING');
  });
});

describe('combineAdAudioLayers', () => {
  const layer = (over: Partial<AdAudioLayer> = {}): AdAudioLayer => ({
    name: 'test layer',
    configured: true,
    inspectedContent: true,
    cleared: true,
    requiresManualReview: false,
    reasoning: 'fine',
    ...over,
  });

  const fingerprintOff = layer({
    name: 'Acoustic fingerprint (ACRCloud)',
    configured: false,
    inspectedContent: false,
    reasoning: 'not configured',
  });
  const noSpeech = layer({
    name: 'Spoken content',
    inspectedContent: false,
    reasoning: 'No speech detected in the spot',
  });

  it('approves only when a layer actually inspected the audio and cleared it', () => {
    const result = combineAdAudioLayers([layer(), layer()]);
    expect(result.isApproved).toBe(true);
    expect(result.requiresManualReview).toBe(false);
  });

  it('sends a fingerprint match to a human rather than rejecting it', () => {
    // An advertiser may hold a sync licence for the bed in their own spot;
    // an automated verdict cannot tell that from an unlicensed rip.
    const result = combineAdAudioLayers([
      layer({ cleared: false, requiresManualReview: true, reasoning: 'matched a commercial recording' }),
      layer(),
    ]);
    expect(result).toMatchObject({ isApproved: false, requiresManualReview: true });
    expect(result.reasoning).toContain('matched a commercial recording');
  });

  it('rejects only on an outright policy violation', () => {
    const result = combineAdAudioLayers([
      layer(),
      layer({ cleared: false, requiresManualReview: false, reasoning: 'hate speech' }),
    ]);
    expect(result).toMatchObject({ isApproved: false, requiresManualReview: false });
  });

  it('does not treat a Workers AI outage as an approval', () => {
    // The regression this whole change exists for: every failure path used to
    // return isApproved:true, and clearing is what authorises the advertiser's
    // budget on Stripe. An outage must cost a queue item, not a charge.
    const outage = combineAdAudioLayers([
      fingerprintOff,
      layer({
        inspectedContent: false,
        cleared: false,
        requiresManualReview: true,
        reasoning: 'Speech-to-text unavailable',
      }),
    ]);
    expect(outage.isApproved).toBe(false);
    expect(outage.requiresManualReview).toBe(true);
  });

  it('flags a music-only spot when fingerprinting is unavailable to check it', () => {
    // The dangerous shape: no speech for the transcript layer to screen, and
    // no fingerprint scan configured to hear the music. Both layers "clear",
    // but nothing looked at the file. Previously this was the cleanest path
    // through vetting for exactly the spots most likely to carry unlicensed
    // music.
    const result = combineAdAudioLayers([fingerprintOff, noSpeech]);
    expect(result.isApproved).toBe(false);
    expect(result.requiresManualReview).toBe(true);
    expect(result.reasoning).toMatch(/never|no layer|inspect/i);
  });

  it('approves a music-only spot once fingerprinting can vouch for it', () => {
    const result = combineAdAudioLayers([
      layer({ name: 'Acoustic fingerprint (ACRCloud)', reasoning: 'No match against the catalog' }),
      noSpeech,
    ]);
    expect(result.isApproved).toBe(true);
  });

  it('carries every layer through to the caller for the review queue', () => {
    const layers = [fingerprintOff, noSpeech];
    expect(combineAdAudioLayers(layers).layers).toEqual(layers);
  });
});
