'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';
import { useI18n } from '@/components/I18nProvider';

type ReportStatus = 'OPEN' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED' | 'HIDDEN';
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

export function AdminReportActions({ reportId }: { reportId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<ReportStatus | null>(null);
  const [reauthStatus, setReauthStatus] = useState<ReportStatus | null>(null);
  const [error, setError] = useState('');

  async function run(status: ReportStatus) {
    setPendingStatus(status);
    setReauthStatus(null);
    setError('');

    try {
      await patchJson(`/api/admin/content-reports/${reportId}`, { status });
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
      {(['REVIEWED', 'RESOLVED', 'DISMISSED', 'HIDDEN'] as const).map((status) => (
        <button
          className={status === 'HIDDEN' ? 'button small danger' : 'button small secondary'}
          disabled={Boolean(pendingStatus)}
          key={status}
          onClick={() => run(status)}
          type="button"
        >
          {pendingStatus === status ? t('adminModerationActions.saving', 'Saving...') : status}
        </button>
      ))}
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
