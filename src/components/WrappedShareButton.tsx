'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';

// Share button for the Scene Wrapped card. Uses the Web Share API where
// available (native iOS/Android share sheet), falling back to clipboard and
// then a prompt — same progressive-enhancement pattern as PageActions.
export function WrappedShareButton({ shareText, monthLabel }: { shareText: string; monthLabel: string }) {
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  async function handleShare() {
    const url = new URL('/me/wrapped', window.location.origin).toString();
    track('wrapped_share', { month: monthLabel });
    try {
      if (navigator.share) {
        await navigator.share({ title: `My ${monthLabel} on iHYPE`, text: shareText, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
      } else {
        window.prompt('Copy this', `${shareText}\n${url}`);
      }
      setStatus('done');
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch {
      // Ignore canceled shares and clipboard failures.
    }
  }

  return (
    <button type="button" onClick={handleShare} className="wrapped-share-btn">
      {status === 'done' ? 'Shared ✓' : 'Share my month'}
    </button>
  );
}
