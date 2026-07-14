'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CampaignCancelButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function cancel() {
    if (!window.confirm('Cancel this campaign? It will stop running immediately and can\'t be resumed.')) return;
    setPending(true);
    const res = await fetch('/api/advertise/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaignId, action: 'cancel' }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setPending(false);
    }
  }

  return (
    <button className="button small secondary" disabled={pending} onClick={cancel} type="button">
      {pending ? 'Cancelling…' : 'Cancel campaign'}
    </button>
  );
}
