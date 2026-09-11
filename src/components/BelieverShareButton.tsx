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

  // `mmm-btn-ghost` is the whole control: the shell's secondary button, with
  // the 44px floor. It replaced a bare `believer-share-btn`, which no
  // stylesheet answered and which therefore rendered as a browser-default
  // button 25px tall (measured at 1280, 2026-09-10). That class is GONE rather
  // than kept as a hook — a class with no rule and no reader is a promise of a
  // rule nobody is going to write, and `audit:unstyled` is right to count it.
  return (
    <button type="button" onClick={handleShare} className="mmm-btn-ghost">
      {status === 'done' ? t('believerShareButton.shared', 'Shared ✓') : t('believerShareButton.shareYourRank', 'Share your rank')}
    </button>
  );
}
