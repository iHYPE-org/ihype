'use client';

import { startRegistration } from '@simplewebauthn/browser';
import { useCallback, useEffect, useState } from 'react';

type PasskeyEntry = {
  id: string;
  deviceType: string;
  createdAt: string;
  backedUp: boolean;
};

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/passkey/list');
      const data = await res.json() as { passkeys: PasskeyEntry[] };
      setPasskeys(data.passkeys ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addPasskey() {
    setRegistering(true);
    setStatus('');
    try {
      const optRes = await fetch('/api/auth/passkey/register');
      const options = await optRes.json() as Record<string, unknown>;
      const credential = await startRegistration(options as never);
      const verifyRes = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (!verifyRes.ok) throw new Error('Registration failed');
      setStatus('Passkey added successfully.');
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration cancelled or failed.';
      if (!msg.toLowerCase().includes('cancel')) setStatus(msg);
    } finally {
      setRegistering(false);
    }
  }

  async function removePasskey(id: string) {
    await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' });
    setPasskeys((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div style={{ marginTop: 16 }}>
      {loading ? (
        <p className="meta">Loading passkeys…</p>
      ) : passkeys.length === 0 ? (
        <p className="meta">No passkeys registered. Add one for fast, passwordless sign-in.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: 8 }}>
          {passkeys.map((pk) => (
            <li key={pk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 13 }}>
                {pk.deviceType === 'multiDevice' ? '☁️ Synced passkey' : '🔑 Device passkey'}
                {pk.backedUp && <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>backed up</span>}
                <span className="meta" style={{ display: 'block', fontSize: 11 }}>
                  Added {new Date(pk.createdAt).toLocaleDateString()}
                </span>
              </span>
              <button
                className="button secondary small"
                type="button"
                onClick={() => removePasskey(pk.id)}
                style={{ fontSize: 12 }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className="button small"
        type="button"
        onClick={addPasskey}
        disabled={registering}
      >
        {registering ? 'Follow browser prompt…' : '+ Add passkey'}
      </button>
      {status && <p className="meta" style={{ marginTop: 8 }}>{status}</p>}
    </div>
  );
}
