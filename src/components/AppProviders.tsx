'use client';

import { type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { AccessibilityProvider, RouteAccessibilityAnnouncer } from '@/components/AccessibilityControls';
import { MediaPlayerProvider } from '@/components/GlobalMediaPlayer';
import { NativePushRegistration } from '@/components/NativePushRegistration';
import { I18nProvider } from '@/components/I18nProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
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
