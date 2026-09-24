'use client';

import { type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { AccessibilityProvider, RouteAccessibilityAnnouncer } from '@/components/AccessibilityControls';
import { MediaPlayerProvider } from '@/components/GlobalMediaPlayer';
import { NativePushRegistration } from '@/components/NativePushRegistration';
import { I18nProvider } from '@/components/I18nProvider';
import type { Locale } from '@/lib/i18n/locales';

export function AppProviders({
  children,
  initialLocale,
  initialDictionary,
  session,
}: {
  children: ReactNode;
  /** The locale and dictionary the server rendered this request with — see I18nProvider. */
  initialLocale: Locale;
  initialDictionary: Record<string, string>;
  /** The server's session for this document: a member, `null` for signed out,
   *  or `undefined` when it could not be read (the provider then fetches). */
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <I18nProvider initialLocale={initialLocale} initialDictionary={initialDictionary}>
        <AccessibilityProvider>
          <MediaPlayerProvider>
            <RouteAccessibilityAnnouncer />
            <NativePushRegistration />
            {children}
          </MediaPlayerProvider>
        </AccessibilityProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
