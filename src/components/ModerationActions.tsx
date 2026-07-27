'use client';
import { useState } from 'react';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';
import { useI18n } from '@/components/I18nProvider';

type Action = 'approve' | 'dismiss';

export function ModerationActions({ reportId }: { reportId: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'pending' | 'done'>('idle');
  const [reauthAction, setReauthAction] = useState<Action | null>(null);
  const [error, setError] = useState('');

  async function act(action: Action) {
    setStatus('pending');
    setReauthAction(null);
    setError('');

    try {
      const response = await fetch(`/api/admin/moderation/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));

      // This used to report "Done" unconditionally, without ever looking at
      // the response — an admin could be told flagged content was removed
      // when the request had actually failed.
      if (!response.ok) {
        if (payload.requiresReauth) {
          setReauthAction(action);
        } else {
          setError(typeof payload.error === 'string' ? payload.error : t('moderationActions.actionFailed', 'Action failed.'));
        }
        setStatus('idle');
        return;
      }

      setStatus('done');
    } catch {
      setError(t('moderationActions.actionFailed', 'Action failed.'));
      setStatus('idle');
    }
  }

  if (status === 'done') return <span className="meta">{t('moderationActions.done', 'Done')}</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="button small" disabled={status === 'pending'} onClick={() => act('approve')} type="button">
          {status === 'pending' ? t('moderationActions.saving', 'Saving...') : t('moderationActions.removeContent', 'Remove content')}
        </button>
        <button className="button small secondary" disabled={status === 'pending'} onClick={() => act('dismiss')} type="button">
          {t('moderationActions.dismiss', 'Dismiss')}
        </button>
      </div>
      {reauthAction ? (
        <AdminReauthPrompt
          onCancel={() => setReauthAction(null)}
          onSuccess={() => {
            const action = reauthAction;
            setReauthAction(null);
            void act(action);
          }}
        />
      ) : null}
      {error ? <small className="status-note status-note-error">{error}</small> : null}
    </div>
  );
}
