'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';

type Step = 'idle' | 'creating' | 'registering' | 'done' | 'error';

export function AdminSetupClient() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setStep('creating');
    setStatus('Creating account...');

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : `Failed (${res.status}).`);
      }

      setStep('registering');
      setStatus('Register your passkey now — follow your browser prompt.');

      const optRes = await fetch('/api/auth/passkey/register-first');
      const options = await optRes.json();
      if (!optRes.ok) {
        throw new Error(typeof options.error === 'string' ? options.error : 'Could not start passkey registration.');
      }

      const attestation = await startRegistration(options);

      const verifyRes = await fetch('/api/auth/passkey/register-first', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation)
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        throw new Error(typeof verifyData.error === 'string' ? verifyData.error : 'Passkey verification failed.');
      }

      setStep('done');
      setStatus('Done! Redirecting to admin...');
      setTimeout(() => router.push('/admin'), 700);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const busy = step === 'creating' || step === 'registering';

  return (
    <div
      style={{
        background: 'var(--card-background, #111827)',
        color: 'var(--foreground, #f5f7fb)',
        borderRadius: 18,
        padding: 28,
        boxShadow: '0 10px 35px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>Admin setup</h1>
      <p style={{ margin: '0 0 18px', opacity: 0.75, fontSize: 14 }}>
        Set up admin access for <strong>admin@ihype.org</strong>. Requires <code>ALLOW_ADMIN_SETUP=true</code> and should be disabled after the first passkey is registered.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>ADMIN_SETUP_SECRET</span>
          <input
            type="password"
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            disabled={busy || step === 'done'}
            autoComplete="off"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(0,0,0,0.25)',
              color: 'inherit',
              fontSize: 14
            }}
          />
        </label>

        <button
          type="submit"
          disabled={busy || step === 'done' || !secret}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 12,
            background: '#5b8def',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: busy ? 'progress' : 'pointer',
            opacity: busy || !secret ? 0.7 : 1
          }}
        >
          {step === 'creating'
            ? 'Creating account...'
            : step === 'registering'
              ? 'Registering passkey...'
              : step === 'done'
                ? 'Done'
                : 'Create admin account'}
        </button>
      </form>

      {status ? (
        <p style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>{status}</p>
      ) : null}
      {error ? (
        <p style={{ marginTop: 12, fontSize: 13, color: '#ff8a8a' }}>{error}</p>
      ) : null}
    </div>
  );
}
