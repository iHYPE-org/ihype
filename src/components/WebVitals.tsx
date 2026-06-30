'use client';

import { useReportWebVitals } from 'next/web-vitals';
import * as Sentry from '@sentry/nextjs';
import { track } from '@/lib/analytics';

// Core Web Vitals (LCP, INP, CLS) plus FCP/TTFB, reported once per metric
// per page load. Forwarded to Sentry (as measurements on the active
// transaction, visible alongside error/perf data) and to the existing
// localStorage event pipeline for lightweight product-side inspection.
export function WebVitals() {
  useReportWebVitals((metric) => {
    Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond');
    track('web_vital', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  });

  return null;
}
