'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';
import { useI18n } from '@/components/I18nProvider';

type ReportAction = 'approve' | 'dismiss';
type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'UNVERIFIED';

class ReauthRequiredError extends Error {
  constructor() {
    super('Recent passkey check required.');
  }
}

async function patchJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (payload.requiresReauth) {
      throw new ReauthRequiredError();
    }
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Action failed.');
  }

  return payload;
}

/**
 * The Overview's report row decides a report the same way /admin/moderation
 * and /admin/review do: through PATCH /api/admin/moderation/[id], which
 * removes the content on `approve` and marks the report ACTIONED, or marks it
 * DISMISSED. Until 2026-09-14 this row offered REVIEWED / RESOLVED / DISMISSED
 * / HIDDEN against a second route with its own enforcement table, so an
 * operator could clear the queue here without the content going anywhere
 * (DESIGN_SYNC row 458).
 */
export function AdminReportActions({ reportId }: { reportId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ReportAction | null>(null);
  const [reauthAction, setReauthAction] = useState<ReportAction | null>(null);
  const [error, setError] = useState('');

  async function run(action: ReportAction) {
    setPendingAction(action);
    setReauthAction(null);
    setError('');

    try {
      await patchJson(`/api/admin/moderation/${reportId}`, { action });
      router.refresh();
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        setReauthAction(action);
      } else {
        setError(err instanceof Error ? err.message : t('adminModerationActions.actionFailed', 'Action failed.'));
      }
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="admin-action-row">
      <button className="button small danger" disabled={Boolean(pendingAction)} onClick={() => run('approve')} type="button">
        {pendingAction === 'approve' ? t('adminModerationActions.saving', 'Saving...') : t('adminModerationActions.removeContent', 'Remove content')}
      </button>
      <button className="button small secondary" disabled={Boolean(pendingAction)} onClick={() => run('dismiss')} type="button">
        {pendingAction === 'dismiss' ? t('adminModerationActions.saving', 'Saving...') : t('adminModerationActions.dismiss', 'Dismiss')}
      </button>
      {reauthAction ? (
        <AdminReauthPrompt
          onCancel={() => setReauthAction(null)}
          onSuccess={() => {
            const action = reauthAction;
            setReauthAction(null);
            void run(action);
          }}
        />
      ) : null}
      {error ? <small className="status-note status-note-error">{error}</small> : null}
    </div>
  );
}

export function AdminVerificationActions({ profileId }: { profileId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<VerificationStatus | null>(null);
  const [reauthStatus, setReauthStatus] = useState<VerificationStatus | null>(null);
  const [error, setError] = useState('');

  async function run(status: VerificationStatus) {
    setPendingStatus(status);
    setReauthStatus(null);
    setError('');

    try {
      await patchJson(`/api/admin/verifications/${profileId}`, { decision: status });
      router.refresh();
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        setReauthStatus(status);
      } else {
        setError(err instanceof Error ? err.message : t('adminModerationActions.actionFailed', 'Action failed.'));
      }
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <div className="admin-action-row">
      <button className="button small secondary" disabled={Boolean(pendingStatus)} onClick={() => run('VERIFIED')} type="button">
        {pendingStatus === 'VERIFIED' ? t('adminModerationActions.saving', 'Saving...') : t('adminModerationActions.approve', 'Approve')}
      </button>
      <button className="button small danger" disabled={Boolean(pendingStatus)} onClick={() => run('REJECTED')} type="button">
        {pendingStatus === 'REJECTED' ? t('adminModerationActions.saving', 'Saving...') : t('adminModerationActions.reject', 'Reject')}
      </button>
      {reauthStatus ? (
        <AdminReauthPrompt
          onCancel={() => setReauthStatus(null)}
          onSuccess={() => {
            const status = reauthStatus;
            setReauthStatus(null);
            void run(status);
          }}
        />
      ) : null}
      {error ? <small className="status-note status-note-error">{error}</small> : null}
    </div>
  );
}
