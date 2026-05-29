'use client';

import { useState } from 'react';

interface FeatureToggleProps {
  showId: string;
  initialFeatured: boolean;
}

export function FeatureToggle({ showId, initialFeatured }: FeatureToggleProps) {
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
      title={featured ? 'Unfeature show' : 'Feature show'}
      style={{
        background: 'none',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
        fontSize: 18,
        opacity: loading ? 0.5 : 1,
        padding: '2px 4px',
      }}
    >
      {featured ? '★' : '☆'}
    </button>
  );
}
