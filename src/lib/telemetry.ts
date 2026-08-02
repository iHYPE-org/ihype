export const TELEMETRY_MODULES = ['map', 'discover', 'radio', 'dashboard', 'settings', 'community', 'other'] as const;
export const TELEMETRY_VIEWPORTS = ['compact', 'phone', 'tablet', 'desktop'] as const;
export const TELEMETRY_PLATFORMS = ['ios', 'android', 'windows', 'macos', 'linux', 'other'] as const;

type Primitive = string | number | boolean | null;
type Props = Record<string, Primitive>;

const allowedEvents = new Set([
  'api_latency',
  'believer_share',
  'client_error',
  'player_failure',
  'promote_share',
  'station_play',
  'ui_module_view',
  'ui_overflow',
  'web_vital',
]);

const allowedByEvent: Record<string, Set<string>> = {
  api_latency: new Set(['endpoint', 'durationMs', 'ok', 'status', 'module']),
  believer_share: new Set(['rank']),
  client_error: new Set(['category', 'errorId', 'module', 'platform', 'viewport']),
  player_failure: new Set(['module', 'online', 'platform', 'reason']),
  promote_share: new Set(),
  station_play: new Set(),
  ui_module_view: new Set(['module', 'platform', 'viewport']),
  ui_overflow: new Set(['module', 'target', 'viewport']),
  web_vital: new Set(['module', 'name', 'rating', 'value', 'viewport']),
};

const allowedValues: Record<string, ReadonlySet<string>> = {
  category: new Set(['render', 'promise', 'resource', 'unknown']),
  endpoint: new Set(['search', 'nearby-shows', 'discover', 'radio', 'settings', 'feedback', 'other']),
  module: new Set(TELEMETRY_MODULES),
  name: new Set(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']),
  platform: new Set(TELEMETRY_PLATFORMS),
  rating: new Set(['good', 'needs-improvement', 'poor']),
  reason: new Set(['decode', 'network', 'offline', 'session', 'interruption', 'unknown']),
  target: new Set(['document', 'module', 'header', 'player']),
  viewport: new Set(TELEMETRY_VIEWPORTS),
};

export function telemetryViewport(width: number) {
  if (width <= 360) return 'compact' as const;
  if (width <= 480) return 'phone' as const;
  if (width <= 1024) return 'tablet' as const;
  return 'desktop' as const;
}

export function telemetryPlatform(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(value)) return 'ios' as const;
  if (/android/.test(value)) return 'android' as const;
  if (/windows/.test(value)) return 'windows' as const;
  if (/macintosh|mac os/.test(value)) return 'macos' as const;
  if (/linux/.test(value)) return 'linux' as const;
  return 'other' as const;
}

export function telemetryModule(pathname: string) {
  if (/\/discover(?:\/|$)/.test(pathname)) return 'discover' as const;
  if (/\/radio(?:\/|$)/.test(pathname)) return 'radio' as const;
  if (/\/settings(?:\/|$)/.test(pathname)) return 'settings' as const;
  if (/\/(?:community|info|legal|dmca)(?:\/|$)/.test(pathname)) return 'community' as const;
  if (/\/(?:shows|events|nearby)(?:\/|$)/.test(pathname)) return 'map' as const;
  if (/\/(?:listen|pages|home)(?:\/|$)/.test(pathname)) return 'dashboard' as const;
  return 'other' as const;
}

function safeNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Privacy boundary for browser telemetry. Only documented aggregate dimensions
 * survive. Search terms, routes, content IDs, listening history, coordinates,
 * free-form errors, and arbitrary caller properties are discarded here and
 * again by the ingest route.
 */
export function sanitizeTelemetryEvent(event: unknown, input?: unknown) {
  if (typeof event !== 'string' || !allowedEvents.has(event)) return null;
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const props: Props = {};

  for (const key of allowedByEvent[event] ?? []) {
    const value = source[key];
    if (allowedValues[key]) {
      if (typeof value === 'string' && allowedValues[key].has(value)) props[key] = value;
      continue;
    }
    if (key === 'durationMs' || key === 'rank' || key === 'status' || key === 'value') {
      const number = safeNumber(value);
      if (number !== null) props[key] = number;
      continue;
    }
    if (typeof value === 'boolean' || value === null) props[key] = value;
    else if (typeof value === 'string') props[key] = value.slice(0, 40);
  }

  return { event, props };
}
