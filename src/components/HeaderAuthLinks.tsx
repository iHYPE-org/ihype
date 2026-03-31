'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { logoutAction } from '@/app/logout/actions';
import { AdminPerspectiveHeaderSelect, useAdminPerspective } from '@/components/AdminPerspective';

export function HeaderAuthLinks() {
  const { data: session, status } = useSession();
  const { isAdmin } = useAdminPerspective();

  if (status === 'loading') {
    return (
      <div className="nav-links nav-links-auth nav-links-compact nav-auth-slot" aria-hidden="true">
        <span className="nav-loading-pill" />
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="nav-auth-slot nav-auth-cluster">
        <div className="nav-links nav-links-auth nav-links-compact">
          <Link href="/dashboard">{isAdmin ? 'Admin' : 'Dashboard'}</Link>
          <span className="nav-divider">|</span>
          <form action={logoutAction} className="nav-inline-form">
            <button className="nav-text-button" type="submit">
              Sign Out
            </button>
          </form>
        </div>
        {isAdmin ? <AdminPerspectiveHeaderSelect className="admin-perspective-select admin-perspective-select-header" /> : null}
      </div>
    );
  }

  return (
    <div className="nav-links nav-links-auth nav-links-compact nav-auth-slot">
      <Link href="/login">Sign In</Link>
      <span className="nav-divider">|</span>
      <Link href="/register">Sign Up</Link>
    </div>
  );
}
