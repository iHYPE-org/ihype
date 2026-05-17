'use client';

import { useEffect } from 'react';

export function AdImpressionPing({ id }: { id: string }) {
  useEffect(() => {
    fetch(`/api/ads/${id}/impression`, { method: 'POST' }).catch(() => {});
  }, [id]);
  return null;
}
