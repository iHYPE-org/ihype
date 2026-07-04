import { describe, expect, it } from 'vitest';
import {
  adSubmissionStatusFromVetting,
  adCampaignStatusFromVetting,
  type VettingResult,
} from '@/lib/ad-vetting';

const approved: VettingResult = { isApproved: true, requiresManualReview: false, reasoning: 'ok' };
const rejected: VettingResult = { isApproved: false, requiresManualReview: false, reasoning: 'no' };
const borderline: VettingResult = { isApproved: false, requiresManualReview: true, reasoning: 'unsure' };
// requiresManualReview always wins even if isApproved is somehow true.
const borderlineApproved: VettingResult = { isApproved: true, requiresManualReview: true, reasoning: 'unsure' };

describe('adSubmissionStatusFromVetting', () => {
  it('maps vetting outcomes to the exact status strings the AdSubmission pipeline writes', () => {
    expect(adSubmissionStatusFromVetting(approved)).toBe('approved');
    expect(adSubmissionStatusFromVetting(rejected)).toBe('rejected');
    expect(adSubmissionStatusFromVetting(borderline)).toBe('manual_review');
    expect(adSubmissionStatusFromVetting(borderlineApproved)).toBe('manual_review');
  });

  it('never produces "PENDING" — the admin weekly report queries "manual_review", not "PENDING"', () => {
    for (const result of [approved, rejected, borderline, borderlineApproved]) {
      expect(adSubmissionStatusFromVetting(result)).not.toBe('PENDING');
    }
  });
});

describe('adCampaignStatusFromVetting', () => {
  it('maps vetting outcomes to the exact status strings the Ad/AdSlot pipeline writes', () => {
    expect(adCampaignStatusFromVetting(approved)).toBe('APPROVED');
    expect(adCampaignStatusFromVetting(rejected)).toBe('REJECTED');
    expect(adCampaignStatusFromVetting(borderline)).toBe('PENDING');
    expect(adCampaignStatusFromVetting(borderlineApproved)).toBe('PENDING');
  });
});
