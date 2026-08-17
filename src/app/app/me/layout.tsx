import type { ReactNode } from 'react';
import { MmmMeRouteBack } from '@/components/mmm/MmmMeRouteBack';

export default function MmmMeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MmmMeRouteBack />
      {children}
    </>
  );
}
