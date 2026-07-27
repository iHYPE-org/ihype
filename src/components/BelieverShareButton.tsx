'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import { useI18n } from '@/components/I18nProvider';

// Shares the viewer's early-believer status in an artist. Web Share API where
// present, clipboard then prompt fallback.
export function BelieverShareButton({ artistName, artistSlug, rank }: { artistName: string; artistSlug: string; rank: number }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  async function handleShare() {
    const url = new URL(`/artists/${artistSlug}/believers`, window.location.origin).toString();
    const text = `${t('believerShareButton.shareTextPrefix', 'I was believer #')}${rank} ${t('believerShareButton.shareTextMiddle', 'in')} ${artistName} ${t('believerShareButton.shareTextSuffix', 'on iHYPE. Called it early.')}`;
    track('believer_share', { artistSlug, rank });
    try {
      if (navigator.share) {
        await navigator.share({ title: `${t('believerShareButton.shareTitle', 'Early believer')} · ${artistName}`, text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      } else {
        window.prompt('Copy this', `${text}\n${url}`);
      }
      setStatus('done');
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch {
      // Ignore canceled shares / clipboard failures.
    }
  }

  return (
    <button type="button" onClick={handleShare} className="believer-share-btn">
      {status === 'done' ? t('believerShareButton.shared', 'Shared ✓') : t('believerShareButton.shareYourRank', 'Share your rank')}
    </button>
  );
}
