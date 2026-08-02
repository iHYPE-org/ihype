import { describe, expect, it } from 'vitest';
import { sanitizeTelemetryEvent, telemetryModule, telemetryPlatform, telemetryViewport } from '@/lib/telemetry';

describe('privacy-safe telemetry', () => {
  it('keeps only allowlisted aggregate dimensions', () => {
    expect(sanitizeTelemetryEvent('api_latency', {
      endpoint: 'search', durationMs: 123.456, ok: true, status: 200,
      query: 'private search', latitude: 42.331, mediaId: 'listening-history',
    })).toEqual({
      event: 'api_latency',
      props: { endpoint: 'search', durationMs: 123.46, ok: true, status: 200 },
    });
  });

  it('rejects unknown events and invalid enum values', () => {
    expect(sanitizeTelemetryEvent('location_fix', { latitude: 42 })).toBeNull();
    expect(sanitizeTelemetryEvent('ui_module_view', { module: 'private-page', viewport: '390x844' }))
      .toEqual({ event: 'ui_module_view', props: {} });
  });

  it('uses coarse platform, viewport, and module categories', () => {
    expect(telemetryViewport(320)).toBe('compact');
    expect(telemetryViewport(390)).toBe('phone');
    expect(telemetryPlatform('Mozilla/5.0 (iPhone)')).toBe('ios');
    expect(telemetryModule('/settings/privacy')).toBe('settings');
    expect(telemetryModule('/tracks/private-id')).toBe('other');
  });
});
