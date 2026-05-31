'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { getErrorMessage } from '@/components/AuthShared';

type PasskeyEntry = {
  id: string;
  deviceType: string;
  createdAt: string;
  backedUp: boolean;
};

export function PasskeyManager() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyEntry[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadPasskeys() {
    setLoadingList(true);
    try {
      const res = await fetch('/api/auth/passkey/list');
      const data = await res.json();
      setPasskeys(data.passkeys ?? []);
    } catch {
      // silently ignore list errors
    } finally {
      setLoadingList(false);
    }
  }

  // Load on mount
  useEffect(() => {
    void loadPasskeys();
  }, []);

  async function registerPasskey() {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const optRes = await fetch('/api/auth/passkey/register');
      const options = await optRes.json();
      const attestation = await startRegistration(options);
      await postJson('/api/auth/passkey/register', attestation);
      setStatus('Passkey added. You can now sign in without a password.');
      void loadPasskeys();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not register passkey.'));
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    setRemovingId(id);
    setError('');
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not remove passkey.');
      }
      void loadPasskeys();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove passkey.'));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <button className="button" disabled={busy} onClick={registerPasskey} type="button">
        {busy ? 'Registering...' : 'Add a passkey'}
      </button>
      {status ? <p className="status-note" style={{ marginTop: 8 }}>{status}</p> : null}
      {error ? <p className="status-note status-note-error" style={{ marginTop: 8 }}>{error}</p> : null}

      {!loadingList && passkeys && passkeys.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Registered passkeys</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {passkeys.map((pk) => (
              <li key={pk.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ flex: 1 }}>
                  <span style={{ textTransform: 'capitalize' }}>{pk.deviceType.replace(/-/g, ' ')}</span>
                  {pk.backedUp ? ' · synced' : ' · single device'}
                  {' · '}
                  {new Date(pk.createdAt).toLocaleDateString()}
                </span>
                <button
                  className="button"
                  disabled={removingId === pk.id}
                  onClick={() => void removePasskey(pk.id)}
                  style={{ padding: '4px 12px', fontSize: '0.85em' }}
                  type="button"
                >
                  {removingId === pk.id ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
