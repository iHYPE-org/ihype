'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Revoke one console device.
 *
 * Two-step by design: revoking is not undoable from here — the device has to
 * complete an emailed one-time registration to come back — and the control sits
 * in a table row where a misclick is easy.
 */
export function RevokeDeviceButton({ deviceId, label }: { deviceId: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/authorizations/devices/${deviceId}`, {
        method: 'DELETE',
      });
      if (response.status === 401) {
        const body = (await response.json().catch(() => ({}))) as { requiresReauth?: boolean };
        // Say which 401 this is. "Unauthorized" on a console you are visibly
        // signed into reads as a bug rather than as a step you have to take.
        setError(
          body.requiresReauth
            ? 'Confirm your identity again before revoking a device.'
            : 'Your session has expired.',
        );
        return;
      }
      if (!response.ok) {
        setError('Could not revoke this device.');
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <span className="meta">
        {error}{' '}
        <button type="button" className="button small secondary" onClick={() => setError(null)}>
          Try again
        </button>
      </span>
    );
  }

  if (!confirming) {
    return (
      <button type="button" className="button small secondary" onClick={() => setConfirming(true)}>
        Revoke
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button type="button" className="button small danger" onClick={revoke} disabled={busy}>
        {busy ? 'Revoking…' : `Revoke ${label}`}
      </button>
      <button
        type="button"
        className="button small secondary"
        onClick={() => setConfirming(false)}
        disabled={busy}
      >
        Cancel
      </button>
    </span>
  );
}
