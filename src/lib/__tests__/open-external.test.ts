import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* A stand-in for Capacitor's plugin Proxy: every property that is not a real
   method is answered with a wrapper that rejects "not implemented" — `then`
   included. That is the shape that made an async `return Browser` reject
   (Sentry JAVASCRIPT-NEXTJS-H) before any button could open a page. */
const calls: string[] = [];
function pluginProxy() {
  const methods: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    addListener: async () => ({ remove: async () => undefined }),
    open: async (...args: unknown[]) => { calls.push(`open:${JSON.stringify(args[0])}`); },
  };
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'string' && prop in methods) return methods[prop];
      return () => Promise.reject(new Error(`"Browser.${String(prop)}()" is not implemented on ios`));
    },
  });
}

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/browser', () => ({ Browser: pluginProxy() }));

describe('openExternalUrl inside the native shell', () => {
  const assign = vi.fn();
  beforeEach(() => {
    calls.length = 0;
    assign.mockReset();
    vi.stubGlobal('window', { location: { assign } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens the in-app browser rather than rejecting on the plugin proxy', async () => {
    const { openExternalUrl } = await import('@/lib/open-external');
    await expect(openExternalUrl('https://ihype.org/advertise')).resolves.toBeUndefined();
    expect(calls).toEqual(['open:{"url":"https://ihype.org/advertise","presentationStyle":"popover"}']);
    expect(assign).not.toHaveBeenCalled();
  });
});
