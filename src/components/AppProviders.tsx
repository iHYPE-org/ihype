'use client';

import { type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { AccessibilityProvider, RouteAccessibilityAnnouncer } from '@/components/AccessibilityControls';
import { AdminPerspectiveProvider } from '@/components/AdminPerspective';
import { MediaPlayerProvider } from '@/components/GlobalMediaPlayer';
import { ToastProvider } from '@/components/Toast';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AccessibilityProvider>
        <AdminPerspectiveProvider>
          <MediaPlayerProvider>
            <ToastProvider>
              <RouteAccessibilityAnnouncer />
              {children}
            </ToastProvider>
          </MediaPlayerProvider>
        </AdminPerspectiveProvider>
      </AccessibilityProvider>
    </SessionProvider>
  );
}
