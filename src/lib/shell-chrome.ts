'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which component currently owns the signed-in chrome — one published fact,
 * not two derived guesses.
 *
 * `AppShell` and `AdaptiveSiteHeader` both render `AppShellDrawer`, and that is
 * right: it should be the same drawer from the same registry. But only one of
 * them may render it at a time, or the document carries two
 * `role="dialog" aria-modal="true"` nodes with the same label — a screen reader
 * is offered two identical menus, `aria-modal` on the hidden one is a lie, and
 * `.shell-drawer` stops resolving to a single element in the app-shell contract
 * suite.
 *
 * The obvious fix is to re-compute `AppShell`'s `active` condition inside the
 * header. That was tried and is exactly the wrong shape: the condition folds
 * five inputs (account, session status, route registry, MMM routes, the phone
 * swipe shell), each of which resolves at its own moment, so the two copies
 * disagree during the windows that matter and the header stands down while the
 * shell renders nothing — leaving a phone with NO menu at all.
 *
 * So `AppShell` publishes it instead, from the same effect that sets
 * `html.ihype-shell-locked` (the class that visually stands the marketing
 * header down). Header visibility and drawer ownership therefore move together
 * by construction and cannot drift apart.
 *
 * A module-level store rather than context because the two components are
 * siblings in the root layout — the header renders before `AppShell` and is
 * not inside its provider.
 */

let chromeActive = false;
const listeners = new Set<() => void>();

/** Called by `AppShell` only. */
export function setAppShellChromeActive(next: boolean) {
  if (chromeActive === next) return;
  chromeActive = next;
  for (const listener of listeners) listener();
}

/** Exported so the store's contract is testable without a renderer. */
export function subscribeToAppShellChrome(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getAppShellChromeActive = () => chromeActive;
// The shell is never active during SSR (it needs an authenticated session,
// which resolves on the client), so the server answer is always false.
const getServerSnapshot = () => false;

/** True while `AppShell` is the chrome around the current route. */
export function useAppShellChromeActive(): boolean {
  return useSyncExternalStore(subscribeToAppShellChrome, getAppShellChromeActive, getServerSnapshot);
}
