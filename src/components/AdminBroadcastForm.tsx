'use client';

import { useState } from 'react';
import { useAsyncForm } from '@/hooks/useAsyncForm';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';
import { useI18n } from '@/components/I18nProvider';

const ROLES = ['ALL', 'FAN', 'ARTIST', 'VENUE', 'ADVERTISER'] as const;

export function AdminBroadcastForm() {
  const { t } = useI18n();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<(typeof ROLES)[number]>('ALL');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [reauthRetry, setReauthRetry] = useState<(() => void) | null>(null);
  const { message: status, setMessage: setStatus, error, setError, pending: busy, setPending: setBusy, reset } = useAsyncForm();

  async function fetchPreview() {
    reset();
    setReauthRetry(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject || 'preview', body: body || 'preview', targetRole, preview: true })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresReauth) {
          setReauthRetry(() => () => void fetchPreview());
          return;
        }
        throw new Error(typeof data.error === 'string' ? data.error : t('adminBroadcastForm.previewFailed', 'Preview failed.'));
      }
      setPreviewCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminBroadcastForm.previewFailed', 'Preview failed.'));
    }
  }

  async function sendBroadcast() {
    setBusy(true);
    reset();
    setReauthRetry(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, targetRole })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresReauth) {
          setReauthRetry(() => () => void sendBroadcast());
          return;
        }
        throw new Error(typeof data.error === 'string' ? data.error : t('adminBroadcastForm.sendFailed', 'Send failed.'));
      }
      setStatus(`${t('adminBroadcastForm.sentPrefix', 'Sent')} ${data.sent}/${data.total} (${data.failed} ${t('adminBroadcastForm.sentFailedSuffix', 'failed')}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminBroadcastForm.sendFailed', 'Send failed.'));
    } finally {
      setBusy(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void sendBroadcast();
  }

  return (
    <form onSubmit={send} style={{ display: 'grid', gap: 12 }}>
      <label className="field">
        <span>{t('adminBroadcastForm.subjectLabel', 'Subject')}</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </label>
      <label className="field">
        <span>{t('adminBroadcastForm.bodyLabel', 'Body')}</span>
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />
      </label>
      <label className="field">
        <span>{t('adminBroadcastForm.targetRoleLabel', 'Target role')}</span>
        <select value={targetRole} onChange={(e) => setTargetRole(e.target.value as (typeof ROLES)[number])}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="button secondary" onClick={fetchPreview}>{t('adminBroadcastForm.previewButton', 'Preview recipient count')}</button>
        {previewCount != null ? <small>{previewCount} {previewCount === 1 ? t('adminBroadcastForm.recipientSingular', 'recipient') : t('adminBroadcastForm.recipientPlural', 'recipients')}</small> : null}
      </div>
      <button className="button" type="submit" disabled={busy}>
        {busy ? t('adminBroadcastForm.sending', 'Sending...') : t('adminBroadcastForm.sendBroadcast', 'Send broadcast')}
      </button>
      {reauthRetry ? (
        <AdminReauthPrompt
          onCancel={() => setReauthRetry(null)}
          onSuccess={() => {
            const retry = reauthRetry;
            setReauthRetry(null);
            retry();
          }}
        />
      ) : null}
      {status ? <p className="status-note">{status}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </form>
  );
}
