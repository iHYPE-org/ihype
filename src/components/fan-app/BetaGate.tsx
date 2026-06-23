'use client';

import { useState } from 'react';
import { useApp } from './context';
import { track } from '@/lib/analytics';

const VALID_CODES = ['IHYPE', 'HYPE2026', 'BETA', 'LISTEN'];

const S = {
  wrap: { position: 'absolute' as const, inset: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '0 28px', textAlign: 'center' as const, background: 'var(--bg-base)' },
  wordmark: { fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2.4rem', letterSpacing: '-.04em', color: 'var(--accent)' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.22em', textTransform: 'uppercase' as const, color: 'var(--warn)', marginTop: 6 },
  desc: { fontFamily: 'var(--font-body)', fontSize: '.86rem', color: 'var(--ink-2)', marginTop: 18, lineHeight: 1.5, maxWidth: 280 },
};

export function BetaGate() {
  const { setBetaOk } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);

  const submit = () => {
    if (VALID_CODES.includes(code.trim().toUpperCase())) {
      track('beta_gate_pass');
      setBetaOk();
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 1600);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.wordmark}>iHYPE</div>
      <div style={S.eyebrow}>Closed Beta · Invite Only</div>
      <p style={S.desc}>Enter your invite code to get early access to live shows, ticketing, and the radio studio.</p>
      <input
        value={code}
        onChange={e => setCode(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="INVITE CODE"
        autoCapitalize="characters"
        style={{
          marginTop: 22, width: '100%', maxWidth: 260, padding: '13px 16px', borderRadius: 12,
          border: `1px solid ${err ? 'var(--color-error)' : 'var(--line)'}`,
          background: 'var(--bg-raised)', color: 'var(--ink-1)',
          fontFamily: 'var(--font-mono)', fontSize: '.95rem', letterSpacing: '.14em',
          textAlign: 'center', textTransform: 'uppercase', outline: 'none', boxSizing: 'border-box',
        }}
      />
      {err && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--color-error)', marginTop: 8 }}>Invalid code — try IHYPE</div>}
      <button
        onClick={submit}
        style={{
          marginTop: 14, width: '100%', maxWidth: 260, padding: '13px',
          borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.92rem',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,80,41,.3)',
        }}
      >
        Enter iHYPE
      </button>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--ink-3)', marginTop: 18 }}>
        No code?{' '}
        <span style={{ color: 'var(--warn)', cursor: 'pointer' }} onClick={() => setCode('IHYPE')}>
          Use demo code
        </span>
      </div>
    </div>
  );
}
