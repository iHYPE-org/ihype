import type { Metadata } from 'next';
import { SupportPageClient } from '@/components/SupportPageClient';

export const metadata: Metadata = {
  title: 'Support · iHYPE',
  description: 'We read every message. Usually reply within 24h.'
};

export default function SupportPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 100px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 8, color: 'var(--ink)' }}>
        Support
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(240,235,229,.65)', marginBottom: 40 }}>
        We read every message. Usually reply within 24h.
      </p>

      <SupportPageClient />
    </div>
  );
}
