'use client';

import dynamic from 'next/dynamic';

// Bundles Listen/Events/Pages together — deferred to its own chunk (not the
// shared root bundle every page pays for) since only mobile ever renders it.
const MobileAppShell = dynamic(() => import('@/components/MobileAppShell').then((m) => m.MobileAppShell), { ssr: false });

export function MobileAppShellLoader() {
  return <MobileAppShell />;
}
