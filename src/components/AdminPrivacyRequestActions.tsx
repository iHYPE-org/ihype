'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';

type Action = 'execute' | 'close';

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

export function AdminPrivacyRequestActions({
  requestId,
  requestType
}: {
  requestId: string;
  requestType: string;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [reauthAction, setReauthAction] = useState<Action | null>(null);
  const [error, setError] = useState('');

  const isDeletion = requestType === 'PRIVACY_DELETION';

  async function run(action: Action) {
    if (
      action === 'execute' &&
      isDeletion &&
      !confirm('Execute permanent account erasure for this user? This cannot be undone.')
    ) {
      return;
    }
    setPendingAction(action);
    setReauthAction(null);
    setError('');

    try {
      const result = await patchJson(`/api/admin/privacy-requests/${requestId}`, { action });
      const needsReview: string[] | undefined = result?.summary?.stripeConnectNeedsManualReview;
      if (needsReview?.length) {
        alert(
          `Erasure completed, but Stripe would not deauthorize ${needsReview.length} Connect account(s) (${needsReview.join(', ')}) — likely a pending balance. Resolve manually in the Stripe dashboard.`
        );
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        setReauthAction(action);
      } else {
        setError(err instanceof Error ? err.message : 'Action failed.');
      }
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="admin-action-row">
      <button
        className={isDeletion ? 'button small danger' : 'button small secondary'}
        disabled={Boolean(pendingAction)}
        onClick={() => run('execute')}
        type="button"
      >
        {pendingAction === 'execute' ? 'Executing...' : isDeletion ? 'Execute erasure' : 'Execute'}
      </button>
      <button
        className="button small secondary"
        disabled={Boolean(pendingAction)}
        onClick={() => run('close')}
        type="button"
      >
        {pendingAction === 'close' ? 'Closing...' : 'Close'}
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
