'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * The strip that says you are not yourself.
 *
 * Impersonation must never be invisible: every surface an operator sees while
 * impersonating looks exactly like the member's own account, because it IS
 * their account. Without a standing reminder the failure mode is not confusion,
 * it is acting on somebody else's behalf without realising — hyping from their
 * account, cancelling their ticket.
 *
 * So this is a bar rather than a chip, it is fixed, and it does not dismiss.
 * The only control on it is the way out.
 *
 * Renders nothing at all when the session carries no operator id, which is
 * every ordinary session — the cost to a normal member is one boolean.
 */
export function ImpersonationBanner() {
  const { data: session } = useSession();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  const operatorId = (session?.user as { impersonatorId?: string | null } | undefined)?.impersonatorId;
  if (!operatorId) return null;

  const who = session?.user?.name?.trim() || session?.user?.email || 'this member';

  const stop = async () => {
    setLeaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/impersonate/stop', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok) {
        // A 403 means the operator is no longer an allowed admin. There is no
        // session to go back to, so the honest landing is sign-in.
        if (res.status === 403) {
          window.location.href = '/login';
          return;
        }
        setError(typeof data.error === 'string' ? data.error : 'Could not exit.');
        setLeaving(false);
        return;
      }
      // A full load, not a router push: the session cookie changed underneath
      // the app, and every server component on screen was rendered for the
      // other account.
      window.location.href = data.redirect ?? '/admin';
    } catch {
      setError('Could not exit.');
      setLeaving(false);
    }
  };

  return (
    <div className="impersonation-banner" role="status">
      <span className="impersonation-banner-text">
        <strong>Viewing as {who}</strong>
        <span>Actions you take here are recorded against your operator account.</span>
      </span>
      {error ? <span className="impersonation-banner-error">{error}</span> : null}
      <button
        className="impersonation-banner-exit"
        disabled={leaving}
        onClick={() => void stop()}
        type="button"
      >
        {leaving ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  );
}
