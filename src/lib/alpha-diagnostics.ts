import { telemetryModule, telemetryPlatform, telemetryViewport } from '@/lib/telemetry';

export const ALPHA_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.1.0';

export type AlphaDiagnostics = {
  appVersion: string;
  errorId: string;
  module: ReturnType<typeof telemetryModule>;
  platform: ReturnType<typeof telemetryPlatform>;
  viewport: ReturnType<typeof telemetryViewport>;
};

export function createAlphaErrorId() {
  if (typeof crypto !== 'undefined') return crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  // Only reachable in obsolete browsers without Web Crypto. This identifier
  // correlates diagnostics; it never authenticates or authorizes anything.
  return Date.now().toString(36).padStart(12, '0').slice(-12);
}

export function createAlphaDiagnostics(moduleOverride?: string): AlphaDiagnostics {
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  const module = moduleOverride && ['map', 'discover', 'radio', 'dashboard', 'settings', 'community'].includes(moduleOverride)
    ? moduleOverride as AlphaDiagnostics['module']
    : telemetryModule(pathname);
  return {
    appVersion: ALPHA_APP_VERSION.slice(0, 40),
    errorId: (() => {
      try {
        return window.sessionStorage.getItem('ihype:last-error-id') ?? createAlphaErrorId();
      } catch {
        return createAlphaErrorId();
      }
    })(),
    module,
    platform: telemetryPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent),
    viewport: telemetryViewport(typeof window === 'undefined' ? 1280 : window.innerWidth),
  };
}
