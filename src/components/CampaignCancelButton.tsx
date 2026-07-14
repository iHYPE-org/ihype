'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Action = 'cancel' | 'pause' | 'resume';

const CONFIRM_COPY: Record<Action, string> = {
  cancel: 'Cancel this campaign? It will stop running immediately and can\'t be resumed.',
  pause: 'Pause this campaign? It stops running until you resume it — your remaining run length is preserved.',
  resume: 'Resume this campaign?',
};

export function CampaignCancelButton({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);

  async function act(action: Action) {
    if (!window.confirm(CONFIRM_COPY[action])) return;
    setPending(action);
    const res = await fetch('/api/advertise/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaignId, action }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setPending(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {status === 'APPROVED' && (
        <button className="button small secondary" disabled={pending !== null} onClick={() => act('pause')} type="button">
          {pending === 'pause' ? 'Pausing…' : 'Pause'}
        </button>
      )}
      {status === 'PAUSED' && (
        <button className="button small" disabled={pending !== null} onClick={() => act('resume')} type="button">
          {pending === 'resume' ? 'Resuming…' : 'Resume'}
        </button>
      )}
      <button className="button small secondary" disabled={pending !== null} onClick={() => act('cancel')} type="button">
        {pending === 'cancel' ? 'Cancelling…' : 'Cancel campaign'}
      </button>
    </div>
  );
}
