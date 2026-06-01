'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export function HeaderAuthLinks() {
  const { data: session, status } = useSession();

  if (status === 'loading' || session?.user) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Link href="/login" className="button secondary small nav-auth-button">
        Sign in
      </Link>
      <Link href="/register" className="button small nav-join-button">
        Join free
      </Link>
    </div>
  );
}
