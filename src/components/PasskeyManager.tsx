'use client';

import { startRegistration } from '@simplewebauthn/browser';
import { useCallback, useEffect, useState } from 'react';

type PasskeyEntry = {
  id: string;
  deviceType: string;
  createdAt: string;
  backedUp: boolean;
  name: string | null;
};

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
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
      if (!optRes.ok) throw new Error('Could not start passkey setup.');
      const options = await optRes.json() as Record<string, unknown>;
      const credential = await startRegistration(options as never);
      const verifyRes = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, _name: pendingName.trim() || undefined }),
      });
      if (!verifyRes.ok) throw new Error('Registration failed');
      setPendingName('');
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
    if (!confirm('Remove this passkey? You may lose access if it\'s your only sign-in method.')) return;
    await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' });
    setPasskeys((prev) => prev.filter((p) => p.id !== id));
  }

  function startRename(pk: PasskeyEntry) {
    setRenamingId(pk.id);
    setRenameValue(pk.name ?? '');
  }

  async function saveRename(id: string) {
    const res = await fetch(`/api/auth/passkey/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue }),
    });
    if (res.ok) {
      setPasskeys((prev) => prev.map((p) => p.id === id ? { ...p, name: renameValue.trim() || null } : p));
    }
    setRenamingId(null);
  }

  function labelFor(pk: PasskeyEntry) {
    if (pk.name) return pk.name;
    return pk.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device passkey';
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
              {renamingId === pk.id ? (
                <>
                  <input
                    className="input small"
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={80}
                    style={{ flex: 1, fontSize: 13 }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveRename(pk.id); if (e.key === 'Escape') setRenamingId(null); }}
                  />
                  <button className="button small" type="button" onClick={() => void saveRename(pk.id)}>Save</button>
                  <button className="button secondary small" type="button" onClick={() => setRenamingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {pk.deviceType === 'multiDevice' ? '☁️ ' : '🔑 '}
                    {labelFor(pk)}
                    {pk.backedUp && <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>backed up</span>}
                    <span className="meta" style={{ display: 'block', fontSize: 11 }}>
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <button className="button secondary small" type="button" onClick={() => startRename(pk)} style={{ fontSize: 12 }}>Rename</button>
                  <button className="button secondary small" type="button" onClick={() => void removePasskey(pk.id)} style={{ fontSize: 12 }}>Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input small"
          type="text"
          placeholder="Name (e.g. MacBook, iPhone)"
          value={pendingName}
          onChange={(e) => setPendingName(e.target.value)}
          maxLength={80}
          style={{ flex: '1 1 160px', fontSize: 13 }}
          disabled={registering}
        />
        <button className="button small" type="button" onClick={() => void addPasskey()} disabled={registering}>
          {registering ? 'Follow browser prompt…' : '+ Add passkey'}
        </button>
      </div>
      {status && <p className="meta" style={{ marginTop: 8 }}>{status}</p>}
    </div>
  );
}
