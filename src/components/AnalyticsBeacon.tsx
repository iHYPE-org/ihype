'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ihype_cookie_consent';

// Cookie consent only records a choice unless something actually reads it —
// this is that read. The beacon must never load until the user has opted
// into analytics cookies (Accept all), and must start loading immediately
// if they choose that in the banner during the current visit.
export function AnalyticsBeacon({ token }: { token: string }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'all') setAllowed(true);
    } catch {
      // localStorage unavailable — stay opted out
    }

    function onConsent(e: Event) {
      const detail = (e as CustomEvent<'all' | 'essential'>).detail;
      setAllowed(detail === 'all');
    }
    window.addEventListener('ihype:cookie-consent', onConsent);
    return () => window.removeEventListener('ihype:cookie-consent', onConsent);
  }, []);

  if (!allowed) return null;

  return (
    <Script
      data-cf-beacon={`{"token": "${token}"}`}
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
    />
  );
}
