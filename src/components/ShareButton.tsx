'use client';

import { useState } from 'react';

type ShareButtonProps = {
  path: string;
  title: string;
  className?: string;
  label?: string;
  /** Referral code to attach as ?ref=. If omitted, fetched lazily from /api/referral on share. */
  refCode?: string;
};

export function ShareButton({ path, title, className, label = 'Share', refCode }: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  async function handleShare() {
    const url = new URL(path, window.location.origin);

    let code = refCode;
    if (!code) {
      try {
        const res = await fetch('/api/referral');
        if (res.ok) {
          const data = (await res.json()) as { referralLink?: string };
          if (data.referralLink) {
            code = new URL(data.referralLink).searchParams.get('ref') ?? undefined;
          }
        }
      } catch {
        // Not signed in, offline, or request failed — share without a ref code.
      }
    }
    if (code) url.searchParams.set('ref', code);

    try {
      if (navigator.share) {
        await navigator.share({ title, url: url.toString() });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.toString());
      } else {
        window.prompt('Copy this link', url.toString());
      }

      setStatus('done');
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch {
      // Ignore canceled shares and clipboard failures; the button stays usable.
    }
  }

  return (
    <button className={className ?? 'button small secondary'} onClick={handleShare} type="button">
      {status === 'done' ? 'Shared' : label}
    </button>
  );
}
