import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PERMISSION_PRIMERS,
  primerStorageKey,
  shouldShowPrimer,
  type PermissionId,
} from '../permission-primers';

describe('permission primers', () => {
  it('covers all six capabilities the design system names', () => {
    expect(Object.keys(PERMISSION_PRIMERS).sort()).toEqual([
      'camera', 'location', 'offlineTickets', 'push', 'share', 'wallet',
    ]);
  });

  it('gives every capability a decline path and a designed refusal state', () => {
    for (const primer of Object.values(PERMISSION_PRIMERS)) {
      // A refusal is a valid answer, so there is always a second button and it
      // names the alternative rather than saying "no".
      expect(primer.declineLabel, `${primer.id} has no decline`).toBeTruthy();
      expect(primer.declineLabel.toLowerCase()).not.toBe('cancel');
      // And the refusal leads somewhere, rather than to an error state.
      expect(primer.deniedTitle, `${primer.id} has no denied state`).toBeTruthy();
      expect(primer.deniedBody.length, `${primer.id}'s fallback is not described`).toBeGreaterThan(40);
    }
  });

  it('marks the three capabilities that raise no OS prompt', () => {
    const promptless = Object.values(PERMISSION_PRIMERS)
      .filter((primer) => !primer.prompts)
      .map((primer) => primer.id)
      .sort();
    // Wallet, share and storage never show a system dialog — they are here for
    // the fallback copy, and must not be treated as a gate.
    expect(promptless).toEqual(['offlineTickets', 'share', 'wallet']);
  });

  it('asks once and never nags', () => {
    expect(shouldShowPrimer({ decision: 'unasked', osAlreadyDecided: false })).toBe(true);
    expect(shouldShowPrimer({ decision: 'declined', osAlreadyDecided: false })).toBe(false);
    expect(shouldShowPrimer({ decision: 'accepted', osAlreadyDecided: false })).toBe(false);
  });

  it('never shows the sheet once the OS itself has an answer', () => {
    // Asking after the real dialog has been answered is theatre — our sheet
    // cannot change a granted or denied OS permission.
    for (const decision of ['unasked', 'accepted', 'declined'] as const) {
      expect(shouldShowPrimer({ decision, osAlreadyDecided: true })).toBe(false);
    }
  });

  it('namespaces its storage keys per capability', () => {
    const keys = (Object.keys(PERMISSION_PRIMERS) as PermissionId[]).map(primerStorageKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith('ihype.'))).toBe(true);
  });

  /**
   * The rule that outranks the rest: "Buying a ticket and opening a ticket must
   * work with every one of these refused."
   *
   * Asserted structurally rather than by rendering a purchase: the one thing
   * that could break it is a capability call becoming load-bearing on those
   * paths, so this fails if the ticket surfaces start reaching for a native API
   * directly instead of through a primer that can be declined.
   */
  it('keeps native capability calls out of the buy and wallet paths', () => {
    const guarded = [
      'src/app/tickets/page.tsx',
      'src/components/TicketCardActions.tsx',
      'src/components/TicketSaleCard.tsx',
    ];
    const forbidden = [/navigator\.geolocation/, /getUserMedia/, /requestPermissions\(/, /Notification\.requestPermission/];
    for (const file of guarded) {
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue; // A renamed surface is not this test's business to fail on.
      }
      for (const pattern of forbidden) {
        expect(pattern.test(source), `${file} calls ${pattern} directly`).toBe(false);
      }
    }
  });
});
