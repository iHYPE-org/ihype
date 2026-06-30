'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { track } from '@/lib/analytics';

// Core Web Vitals (LCP, INP, CLS) plus FCP/TTFB, reported once per metric
// per page load. Forwarded to Sentry (as measurements on the active
// transaction, visible alongside error/perf data) and to the existing
// localStorage event pipeline for lightweight product-side inspection.
//
// @sentry/nextjs is imported dynamically inside the callback (browser-only)
// rather than at module scope — a top-level import here gets evaluated
// during static prerendering of every page (this component is mounted in
// the root layout), and Sentry's package resolves incorrectly outside its
// dedicated sentry.client.config.ts entry point, breaking the static build.
export function WebVitals() {
  useReportWebVitals((metric) => {
    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond');
    });
    track('web_vital', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      path: window.location.pathname,
    });
  });

  return null;
}
