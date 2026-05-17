'use client';

import { useState, type ReactNode } from 'react';

type Props = {
  className?: string;
  children: ReactNode;
  // The destructive action handler. If it throws (or returns a Response with
  // requiresReauth: true), the user is prompted to re-authenticate via
  // passkey and the action is retried.
  onConfirm: () => Promise<{ requiresReauth?: boolean; error?: string } | void>;
  confirmLabel?: string;
};

async function promptReauth(): Promise<boolean> {
  try {
    const optsRes = await fetch('/api/admin/reauth', { method: 'GET' });
    if (!optsRes.ok) return false;
    const options = await optsRes.json();
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const assertion = await startAuthentication(options);
    const verifyRes = await fetch('/api/admin/reauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assertion)
    });
    return verifyRes.ok;
  } catch {
    return false;
  }
}

export function AdminConfirmButton({ className, children, onConfirm, confirmLabel = 'Confirm' }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    if (!window.confirm(`${confirmLabel}?`)) return;
    setBusy(true);
    setError(null);
    try {
      let result = await onConfirm();
      if (result && result.requiresReauth) {
        const ok = await promptReauth();
        if (!ok) {
          setError('Re-authentication failed.');
          return;
        }
        result = await onConfirm();
      }
      if (result && result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className ?? 'button small'} onClick={run} disabled={busy}>
        {busy ? 'Working…' : children}
      </button>
      {error ? <span className="meta" style={{ color: 'var(--accent)', marginLeft: 8 }}>{error}</span> : null}
    </>
  );
}
