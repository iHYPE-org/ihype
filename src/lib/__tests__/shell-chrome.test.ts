import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAppShellChromeActive, setAppShellChromeActive, subscribeToAppShellChrome,
} from '@/lib/shell-chrome';

// The store is what stops `AdaptiveSiteHeader` and `AppShell` each deciding,
// separately, whether the other is rendering the drawer. One write, one answer.
afterEach(() => setAppShellChromeActive(false));

describe('app shell chrome store', () => {
  it('is inactive by default — the right answer everywhere the shell is absent', () => {
    expect(getAppShellChromeActive()).toBe(false);
  });

  it('publishes the value AppShell writes', () => {
    setAppShellChromeActive(true);
    expect(getAppShellChromeActive()).toBe(true);
    setAppShellChromeActive(false);
    expect(getAppShellChromeActive()).toBe(false);
  });

  it('notifies subscribers on a change and not on a repeat', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAppShellChrome(listener);

    setAppShellChromeActive(true);
    expect(listener).toHaveBeenCalledTimes(1);
    // The header re-renders on every scroll tick already; a no-op write must
    // not add another.
    setAppShellChromeActive(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setAppShellChromeActive(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setAppShellChromeActive(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('supports more than one subscriber', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeToAppShellChrome(a);
    const offB = subscribeToAppShellChrome(b);
    setAppShellChromeActive(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });
});
