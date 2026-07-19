import type { Metadata } from 'next';
import Link from 'next/link';
import { SupportPageClient } from '@/components/SupportPageClient';

export const metadata: Metadata = {
  title: 'Support · iHYPE',
  description: 'We read every message. Usually reply within 24h.'
};

export default function SupportPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 100px' }}>
      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase',
        letterSpacing: '.14em', color: '#22e5d4', border: '1px solid rgba(34,229,212,.3)',
        background: 'rgba(34,229,212,.07)', borderRadius: 999, padding: '5px 13px', marginBottom: 14,
      }}>
        Support
      </span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-.02em', margin: '18px 0 8px', color: 'var(--ink)' }}>
        How can we help?
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ink-a65)', marginBottom: 24 }}>
        Two people run iHYPE (plus a lot of automation) — we read everything, in order.
      </p>

      <Link
        href="/support/tickets"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)',
          fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', background: 'var(--bg2)',
          padding: '10px 16px', textDecoration: 'none', marginBottom: 40,
        }}
      >
        My tickets
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      <SupportPageClient />
    </div>
  );
}
