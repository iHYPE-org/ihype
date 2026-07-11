'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { SupportForm } from '@/components/SupportForm';
import { SupportPrivacyPanel } from '@/components/SupportPrivacyPanel';

const quickCardStyle: React.CSSProperties = {
  border: '1px solid var(--line)', borderRadius: 10, padding: '18px 20px',
  background: 'var(--bg-2, #100d09)', textDecoration: 'none', color: 'inherit', cursor: 'pointer',
};

export function SupportPageClient() {
  const [formKey, setFormKey] = useState(0);
  const [initialType, setInitialType] = useState('');
  const [initialSubject, setInitialSubject] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  function reportProblem() {
    setInitialType('privacy');
    setInitialSubject('Privacy concern');
    setFormKey((k) => k + 1);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <>
      <p className="eyebrow" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a50)', margin: '0 0 14px' }}>
        Common Topics
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14, marginBottom: 40 }}>
        <Link href="/tickets" style={quickCardStyle}>
          <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a2 2 0 0 1 2-2 2 2 0 0 0 2-2V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 1 0 4 2 2 0 0 0-2 2v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2a2 2 0 0 0-2-2 2 2 0 0 1-2-2Z" /><path d="M13 6v12" strokeDasharray="2 2" /></svg>
          </div>
          <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 4 }}>My Tickets</div>
          <div style={{ fontSize: 12, color: 'var(--ink-a55)' }}>Transfer, share, or get a QR code</div>
        </Link>
        <SupportPrivacyPanel onReportProblem={reportProblem} />
        <Link href="/verify" style={quickCardStyle}>
          <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden="true">✓</div>
          <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 4 }}>Verification</div>
          <div style={{ fontSize: 12, color: 'var(--ink-a55)' }}>Artist/venue/DJ verification status</div>
        </Link>
        <Link href="/me/promote" style={quickCardStyle}>
          <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden="true">💸</div>
          <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 4 }}>Payouts</div>
          <div style={{ fontSize: 12, color: 'var(--ink-a55)' }}>Settlement, earnings, referrals</div>
        </Link>
      </div>

      <div
        ref={formRef}
        style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 32, background: 'var(--bg-2, #100d09)' }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Send a Message</h2>
        <SupportForm key={formKey} initialType={initialType} initialSubject={initialSubject} />
      </div>
    </>
  );
}
