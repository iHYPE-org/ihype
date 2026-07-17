'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteCollabPostButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this listing?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/collab-board?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="ihype-btn-ghost"
      style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  );
}
