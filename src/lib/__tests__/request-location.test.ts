/**
 * Request geolocation (2026-09-24, DESIGN_SYNC row 513): the state comes from
 * the subdivision code, never the continent; a complete edge answer skips the
 * third-party lookup; and an address is looked up once per isolate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIpLocationCacheForTests, detectLocationFromHeaders } from '@/lib/request-location';

const ipapi = vi.fn();

beforeEach(() => {
  clearIpLocationCacheForTests();
  ipapi.mockReset().mockImplementation(async () => new Response(JSON.stringify({
    city: 'Portland', region_code: 'ME', country_name: 'United States', postal: '04101', latitude: 43.66, longitude: -70.26,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', ipapi);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('detectLocationFromHeaders', () => {
  it('never puts the continent in the state field', async () => {
    const location = await detectLocationFromHeaders(new Headers({
      'cf-connecting-ip': '203.0.113.7',
      'cf-ipcontinent': 'NA',
      'cf-ipcountry': 'US',
      'cf-region-code': 'ME',
      'cf-postal-code': '04101',
      'cf-iplatitude': '43.66',
      'cf-iplongitude': '-70.26',
    }));
    expect(location?.stateRegion).toBe('ME');
  });

  it('does not call the third party when the edge answered every field', async () => {
    await detectLocationFromHeaders(new Headers({
      'cf-connecting-ip': '203.0.113.7',
      'cf-ipcountry': 'US',
      'cf-region-code': 'ME',
      'cf-postal-code': '04101',
      'cf-iplatitude': '43.66',
      'cf-iplongitude': '-70.26',
    }));
    expect(ipapi).not.toHaveBeenCalled();
  });

  it('fills the gaps from ipapi once per address, not once per request', async () => {
    const headers = () => new Headers({ 'cf-connecting-ip': '203.0.113.8', 'cf-ipcountry': 'US' });
    const first = await detectLocationFromHeaders(headers());
    await detectLocationFromHeaders(headers());
    await detectLocationFromHeaders(headers());
    expect(ipapi).toHaveBeenCalledTimes(1);
    expect(first?.stateRegion).toBe('ME');
    expect(first?.postalCode).toBe('04101');
    expect(first?.country).toBe('US');
  });
});
