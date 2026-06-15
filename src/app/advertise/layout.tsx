import { ReactNode } from 'react';

export default function AdvertiseLayout({ children }: { children: ReactNode }) {
  return <div className="standalone-page">{children}</div>;
}
