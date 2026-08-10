'use client';

import { useState } from 'react';

/**
 * "Sign in as" on a row of `/admin/users`.
 *
 * A button rather than a link because starting impersonation is a POST that
 * mints a session — it must not be reachable by a crawler, a prefetch, or a
 * middle-click. Confirmed first: the click swaps the operator out of their own
 * account, and the row it sits on is one of many.
 *
 * The server is the authority on who may be impersonated. This never renders
 * for an ADMIN row, but that is a courtesy to the operator, not the check —
 * `refuseImpersonation` refuses on the server regardless of what was rendered.
 */
export function ImpersonateButton({ email, userId }: { email: string | null; userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    const who = email || 'this account';
    if (!window.confirm(`Sign in as ${who}?\n\nYou will be using their account until you press Exit. This is recorded.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not sign in as this account.');
        setBusy(false);
        return;
      }
      // Full load: the session cookie just changed, and everything currently
      // rendered was produced for the operator's own account.
      window.location.href = data.redirect ?? '/';
    } catch {
      setError('Could not sign in as this account.');
      setBusy(false);
    }
  };

  return (
    <>
      <button className="button small secondary" disabled={busy} onClick={() => void start()} type="button">
        {busy ? 'Signing in…' : 'Sign in as'}
      </button>
      {error ? <small style={{ color: 'var(--danger)' }}>{error}</small> : null}
    </>
  );
}
