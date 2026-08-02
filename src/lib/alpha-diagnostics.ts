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
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
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
