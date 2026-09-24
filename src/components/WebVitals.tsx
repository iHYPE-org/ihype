'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { track } from '@/lib/analytics';
import { loadBrowserSentry } from '@/lib/browser-sentry';
import { telemetryModule, telemetryViewport } from '@/lib/telemetry';

// Core Web Vitals (LCP, INP, CLS) plus FCP/TTFB, reported once per metric
// per page load. Forwarded to Sentry (as measurements on the active
// transaction, visible alongside error/perf data) and to the existing
// localStorage event pipeline for lightweight product-side inspection.
//
// The SDK is reached through `loadBrowserSentry`, never imported here: the
// first metric (TTFB) arrives at `load`, and an import fired from it pulled
// the whole SDK chunk into the pre-hydration set on two of four measured
// screens (row 512). The shared loader waits for `load` and idle, so the
// measurement is recorded once the SDK is up and not a moment sooner.
export function WebVitals() {
  useReportWebVitals((metric) => {
    void loadBrowserSentry().then((Sentry) => {
      Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond');
    }).catch(() => { /* no SDK, no measurement */ });
    track('web_vital', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      module: telemetryModule(window.location.pathname),
      viewport: telemetryViewport(window.innerWidth),
    });
  });

  return null;
}
