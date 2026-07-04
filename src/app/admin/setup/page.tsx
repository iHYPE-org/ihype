import type { Metadata } from 'next';
import { AdminSetupClient } from '@/components/AdminSetupClient';

export const metadata: Metadata = {
  title: 'Admin setup | iHYPE.org',
  robots: { index: false, follow: false }
};

export default function AdminSetupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 16px', background: 'var(--background, #0b0f1a)' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <AdminSetupClient />
      </div>
    </div>
  );
}
