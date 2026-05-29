'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WaitlistPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/register?invite=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0a0805',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo mark */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #ff5029, #ff3e9a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: '-.02em',
              color: '#fff',
            }}
          >
            iH
          </div>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(28px, 6vw, 40px)',
            letterSpacing: '-.03em',
            lineHeight: 1.1,
            color: '#f0ebe5',
            margin: '0 0 16px',
            textAlign: 'center',
          }}
        >
          iHYPE is in private beta
        </h1>

        {/* Subtext */}
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 15,
            lineHeight: 1.6,
            color: '#9a8f87',
            textAlign: 'center',
            margin: '0 0 40px',
          }}
        >
          {"Chicago's independent music platform. No platform fee."}{' '}
          <span style={{ color: '#f0ebe5', fontWeight: 600 }}>
            45% artist · 45% venue · 10% you.
          </span>
        </p>

        {/* Invite code form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              background: '#13100d',
              border: '1px solid #2a2320',
              borderRadius: 12,
              padding: 6,
            }}
          >
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter invite code"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '10px 14px',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 15,
                color: '#f0ebe5',
                letterSpacing: '.01em',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #ff5029, #ff3e9a)',
                color: '#fff',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '.04em',
                whiteSpace: 'nowrap',
                transition: 'opacity .15s',
              }}
            >
              Enter
            </button>
          </div>
        </form>

        {/* Waitlist link */}
        <p style={{ textAlign: 'center', margin: '0 0 64px', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, color: '#6b605a' }}>
          {"Don't have a code? "}
          <a
            href="mailto:join@ihype.org?subject=Waitlist%20request"
            style={{
              color: '#ff5029',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Join the waitlist →
          </a>
        </p>

        {/* Footer links */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 28,
            borderTop: '1px solid #1e1a17',
            paddingTop: 28,
          }}
        >
          {[
            { label: 'About', href: '/about' },
            { label: 'Transparency', href: '/transparency' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 13,
                color: '#6b605a',
                textDecoration: 'none',
                letterSpacing: '.02em',
              }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
