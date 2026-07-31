'use client';

import { createContext, useContext } from 'react';

/**
 * True while the signed-in app shell is the chrome around the current route.
 *
 * It exists so a page can tell that the persistent context strip is already
 * carrying part of its navigation, and stand its own duplicate down. Read it
 * rather than probing the DOM for `html.ihype-shell-locked`: that class is a
 * styling hook set from an effect, so it lags a render behind and is not
 * present at all during SSR.
 *
 * Defaults to false, which is the correct answer everywhere the provider is
 * absent (tests, the phone swipe shell, marketing pages).
 */
const AppShellActiveContext = createContext(false);

export const AppShellActiveProvider = AppShellActiveContext.Provider;

export function useAppShellActive(): boolean {
  return useContext(AppShellActiveContext);
}
