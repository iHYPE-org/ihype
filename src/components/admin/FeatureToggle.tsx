'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

interface FeatureToggleProps {
  showId: string;
  initialFeatured: boolean;
}

export function FeatureToggle({ showId, initialFeatured }: FeatureToggleProps) {
  const { t } = useI18n();
  const [featured, setFeatured] = useState(initialFeatured);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shows/${showId}/feature`, { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { featured: boolean };
        setFeatured(data.featured);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={featured ? t('featureToggle.unfeatureShow', 'Unfeature show') : t('featureToggle.featureShow', 'Feature show')}
      style={{
        background: 'none',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
        fontSize: '1.125rem',
        opacity: loading ? 0.5 : 1,
        padding: '2px 4px',
      }}
    >
      {featured ? '★' : '☆'}
    </button>
  );
}
