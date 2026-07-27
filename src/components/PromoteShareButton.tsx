'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import { useI18n } from '@/components/I18nProvider';

// Per-show "share & earn" button on /me/promote. Web Share API where present
// (native share sheet), clipboard then prompt as fallbacks.
export function PromoteShareButton({ link, title, slug }: { link: string; title: string; slug: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  async function handleShare() {
    track('promote_share', { slug });
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} · iHYPE`, text: t('promoteShareButton.catchOnIhype', 'Catch {title} on iHYPE').replace('{title}', title), url: link });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        window.prompt(t('promoteShareButton.copyPromoLink', 'Copy your promo link'), link);
      }
      setStatus('done');
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch {
      // Ignore canceled shares / clipboard failures.
    }
  }

  return (
    <button type="button" onClick={handleShare} className="promote-share-btn">
      {status === 'done' ? t('promoteShareButton.copied', 'Copied ✓') : t('promoteShareButton.shareAndEarn', 'Share & earn')}
    </button>
  );
}
