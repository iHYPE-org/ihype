'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function SocialPostCopy({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <button className="button small secondary" onClick={copy} style={{ flexShrink: 0 }}>
      {copied ? `✓ ${t('socialPostCopy.copied', 'Copied')}` : t('socialPostCopy.copy', 'Copy')}
    </button>
  );
}
