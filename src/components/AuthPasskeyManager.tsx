'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { getErrorMessage } from '@/components/AuthShared';
import { useI18n } from '@/components/I18nProvider';

type PasskeyEntry = {
  id: string;
  deviceType: string;
  createdAt: string;
  backedUp: boolean;
};

export function PasskeyManager() {
  const { t } = useI18n();
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
      if (!optRes.ok) {
        throw new Error(
          typeof options?.error === 'string' ? options.error : 'Could not start passkey registration.',
        );
      }
      const attestation = await startRegistration({ optionsJSON: options });
      await postJson('/api/auth/passkey/register', attestation);
      setStatus(t('authPasskeyManager.registeredStatus', 'Passkey added. You can now sign in without a password.'));
      void loadPasskeys();
    } catch (err) {
      setError(getErrorMessage(err, t('authPasskeyManager.registerError', 'Could not register passkey.')));
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
        throw new Error(typeof payload.error === 'string' ? payload.error : t('authPasskeyManager.removeError', 'Could not remove passkey.'));
      }
      void loadPasskeys();
    } catch (err) {
      setError(getErrorMessage(err, t('authPasskeyManager.removeError', 'Could not remove passkey.')));
    } finally {
      setRemovingId(null);
    }
  }

  const ghostButton: React.CSSProperties = {
    padding: '10px 18px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
    border: 'none', background: 'var(--line)', color: 'var(--ink)',
  };

  return (
    <div>
      <button disabled={busy} onClick={registerPasskey} style={{ ...ghostButton, background: 'var(--accent)', color: 'var(--ink-on-accent)', opacity: busy ? 0.7 : 1 }} type="button">
        {busy ? t('authPasskeyManager.registering', 'Registering...') : t('authPasskeyManager.addPasskey', 'Add a passkey')}
      </button>
      {status ? <p style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--accent)' }}>{status}</p> : null}
      {error ? <p style={{ marginTop: 8, fontSize: '0.8125rem', color: '#ef4444' }}>{error}</p> : null}

      {!loadingList && passkeys && passkeys.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7813rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-a65)', marginBottom: 10 }}>
            {t('authPasskeyManager.registeredPasskeys', 'Registered passkeys')}
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {passkeys.map((pk, i) => (
              <div key={pk.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i === passkeys.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--ink)' }}>
                  <span style={{ textTransform: 'capitalize' }}>{pk.deviceType.replace(/-/g, ' ')}</span>
                  {pk.backedUp ? ` · ${t('authPasskeyManager.synced', 'synced')}` : ` · ${t('authPasskeyManager.singleDevice', 'single device')}`}
                  {' · '}
                  {new Date(pk.createdAt).toLocaleDateString()}
                </span>
                <button
                  disabled={removingId === pk.id}
                  onClick={() => void removePasskey(pk.id)}
                  style={{ ...ghostButton, padding: '6px 14px', fontSize: '0.7813rem', opacity: removingId === pk.id ? 0.7 : 1 }}
                  type="button"
                >
                  {removingId === pk.id ? t('authPasskeyManager.removing', 'Removing...') : t('authPasskeyManager.remove', 'Remove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
