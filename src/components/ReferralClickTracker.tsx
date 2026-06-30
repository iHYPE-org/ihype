'use client';

import { useEffect } from 'react';

/** Fires a beacon recording a referral link click once per ref code per tab session. */
export function ReferralClickTracker({ ref: refCode }: { ref: string | undefined }) {
  useEffect(() => {
    if (!refCode) return;
    const dedupeKey = `ihype:ref-click:${refCode}`;
    try {
      if (sessionStorage.getItem(dedupeKey) === '1') return;
      sessionStorage.setItem(dedupeKey, '1');
    } catch {
      // ignore storage failures; worst case we record a duplicate click
    }
    const body = JSON.stringify({ ref: refCode });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/referral/click', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/referral/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  }, [refCode]);

  return null;
}
