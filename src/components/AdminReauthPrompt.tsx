'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { useI18n } from '@/components/I18nProvider';

/**
 * Inline panel shown when an admin endpoint responds with
 * `{ requiresReauth: true }` (401). Runs the passkey re-auth ceremony
 * against /api/admin/reauth and invokes `onSuccess` so the caller can
 * retry the original action.
 */
export function AdminReauthPrompt({
  onSuccess,
  onCancel
}: {
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function verify() {
    setBusy(true);
    setError('');
    try {
      const optRes = await fetch('/api/admin/reauth');
      const options = await optRes.json().catch(() => ({}));
      if (!optRes.ok) {
        throw new Error(typeof options.error === 'string' ? options.error : t('adminReauthPrompt.couldNotStart', 'Could not start passkey check.'));
      }
      const assertion = await startAuthentication({ optionsJSON: options });
      await postJson('/api/admin/reauth', assertion);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminReauthPrompt.verificationFailed', 'Passkey verification failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      aria-label={t('adminReauthPrompt.ariaLabel', 'Confirm with passkey')}
      role="alertdialog"
      style={{
        display: 'grid',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--line-2)',
        background: 'var(--hair-40)'
      }}
    >
      <strong style={{ fontSize: '0.9375rem' }}>{t('adminReauthPrompt.title', "Confirm it's you")}</strong>
      <small style={{ opacity: 0.75 }}>
        {t('adminReauthPrompt.description', 'This admin action needs a recent passkey check. Verify once, then the action retries automatically.')}
      </small>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="button small" disabled={busy} onClick={() => void verify()} type="button">
          {busy ? t('adminReauthPrompt.waiting', 'Waiting for passkey...') : t('adminReauthPrompt.verifyButton', 'Verify with passkey')}
        </button>
        {onCancel ? (
          <button className="button small secondary" disabled={busy} onClick={onCancel} type="button">
            {t('adminReauthPrompt.cancel', 'Cancel')}
          </button>
        ) : null}
      </div>
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </div>
  );
}
