'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';

const STORAGE_KEY = 'ihype-passkey-nudge-v1';

export function PasskeyNudge() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<'idle' | 'registering' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Don't show if passkeys aren't supported on this device
    if (typeof window.PublicKeyCredential === 'undefined') return;

    // Only show if no passkeys are registered yet
    fetch('/api/auth/passkey/list')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.passkeys?.length === 0) {
          // Small delay so the workbench finishes loading first
          setTimeout(() => setShow(true), 2000);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  async function addPasskey() {
    setStep('registering');
    setErrorMsg('');
    try {
      const optRes = await fetch('/api/auth/passkey/register');
      const options = await optRes.json();
      const attestation = await startRegistration(options);
      await postJson('/api/auth/passkey/register', attestation);
      setStep('done');
      localStorage.setItem(STORAGE_KEY, '1');
      setTimeout(() => setShow(false), 2800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not set up passkey.');
      setStep('error');
    }
  }

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--player-h, 0px) + 16px)',
        right: 20,
        zIndex: 500,
        width: 320,
        borderRadius: 16,
        border: '1px solid rgba(255,80,41,.28)',
        background: 'rgba(16,13,9,0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)',
        overflow: 'hidden',
        animation: 'nudge-slide-in .4s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      {/* Accent top bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), #ff3e9a)' }} />

      <div style={{ padding: '16px 18px' }}>
        {step === 'done' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Passkey added</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>Sign in with Face ID or Touch ID next time.</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🔑</span>
                <div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.3 }}>Sign in faster next time</div>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 12, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.5 }}>
                    Use Face ID, Touch ID, or your device PIN — no password needed.
                  </div>
                </div>
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}
              >✕</button>
            </div>

            {step === 'error' && (
              <div style={{ marginBottom: 10, fontFamily: 'var(--f-m)', fontSize: 11, color: '#ffb4a7', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.18)' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void addPasskey()}
                disabled={step === 'registering'}
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 10, border: 'none',
                  fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, var(--accent), #ff3e9a)',
                  color: '#fff', cursor: step === 'registering' ? 'wait' : 'pointer',
                  boxShadow: '0 2px 12px rgba(255,80,41,.3)',
                  opacity: step === 'registering' ? 0.7 : 1,
                }}
              >
                {step === 'registering' ? 'Setting up…' : 'Set up passkey'}
              </button>
              <button
                onClick={dismiss}
                style={{
                  padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line-2)',
                  fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)',
                  background: 'transparent', cursor: 'pointer',
                  letterSpacing: '.04em',
                }}
              >
                Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
