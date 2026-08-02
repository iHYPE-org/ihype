'use client';

import { useEffect } from 'react';
import { createAlphaErrorId } from '@/lib/alpha-diagnostics';
import { track } from '@/lib/analytics';
import { telemetryPlatform, telemetryViewport } from '@/lib/telemetry';

function rememberErrorId(errorId: string) {
  try {
    window.sessionStorage.setItem('ihype:last-error-id', errorId);
  } catch {
    // Private browsing may disable storage; telemetry remains best-effort.
  }
}

export function PrivacySafeTelemetry({ module }: { module: string }) {
  useEffect(() => {
    const platform = telemetryPlatform(navigator.userAgent);
    const viewport = telemetryViewport(window.innerWidth);
    track('ui_module_view', { module, platform, viewport });
  }, [module]);

  useEffect(() => {
    const report = (category: 'render' | 'promise' | 'resource' | 'unknown') => {
      const errorId = createAlphaErrorId();
      rememberErrorId(errorId);
      track('client_error', {
        category,
        errorId,
        module,
        platform: telemetryPlatform(navigator.userAgent),
        viewport: telemetryViewport(window.innerWidth),
      });
    };
    const onError = (event: ErrorEvent) => report(event.target instanceof HTMLElement ? 'resource' : 'render');
    const onRejection = () => report('promise');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [module]);

  useEffect(() => {
    const sent = new Set<string>();
    const inspect = () => {
      const targets: Array<[string, Element | null]> = [
        ['document', document.documentElement],
        ['header', document.querySelector('.deck-topbar')],
        ['module', document.querySelector('.deck-module')],
        ['player', document.querySelector('.deck-player')],
      ];
      for (const [target, element] of targets) {
        if (!element) continue;
        const html = element as HTMLElement;
        if (html.scrollWidth <= html.clientWidth + 1) continue;
        const key = `${module}:${target}:${telemetryViewport(window.innerWidth)}`;
        if (sent.has(key)) continue;
        sent.add(key);
        track('ui_overflow', { module, target, viewport: telemetryViewport(window.innerWidth) });
      }
    };
    const observer = new ResizeObserver(inspect);
    observer.observe(document.documentElement);
    const moduleElement = document.querySelector('.deck-module');
    if (moduleElement) observer.observe(moduleElement);
    const timer = window.setTimeout(inspect, 400);
    window.addEventListener('orientationchange', inspect);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener('orientationchange', inspect);
    };
  }, [module]);

  return null;
}
