'use client';

import { type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { RouteAccessibilityAnnouncer } from '@/components/AccessibilityControls';
import { AdminPerspectiveProvider } from '@/components/AdminPerspective';
import { MediaPlayerProvider } from '@/components/GlobalMediaPlayer';
import { ToastProvider } from '@/components/Toast';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AdminPerspectiveProvider>
        <MediaPlayerProvider>
          <ToastProvider>
            <RouteAccessibilityAnnouncer />
            {children}
          </ToastProvider>
        </MediaPlayerProvider>
      </AdminPerspectiveProvider>
    </SessionProvider>
  );
}
