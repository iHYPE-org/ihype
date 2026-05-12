'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { logoutAction } from '@/app/logout/actions';
import { AccessibilityControls } from '@/components/AccessibilityControls';
import { AdminPerspectiveHeaderSelect, useAdminPerspective } from '@/components/AdminPerspective';

function getDisplayName(user: { name?: string | null; email?: string | null }) {
  const name = user.name?.trim();
  if (name) return name;

  const emailName = user.email?.split('@')[0]?.trim();
  return emailName || 'Account';
}

function getRoleLabel(role: string | null | undefined) {
  if (role === 'ARTIST') return 'Artist';
  if (role === 'DJ') return 'Promoter';
  if (role === 'VENUE') return 'Venue';
  if (role === 'ADMIN') return 'Admin';
  return 'Fan';
}

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
    const displayName = getDisplayName(session.user);
    const accountHref = isAdmin ? '/admin' : '/home';
    const roleLabel = isAdmin ? 'Admin' : getRoleLabel(session.user.role);

    return (
      <div className="nav-auth-slot nav-auth-cluster">
        <div className="nav-links nav-links-auth nav-links-compact">
          <AccessibilityControls />
          <Link className="nav-user-pill" href={accountHref} aria-label={`Open account dashboard for ${displayName}`}>
            <span className="nav-user-avatar" aria-hidden="true">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span className="nav-user-copy">
              <span className="nav-user-name">{displayName}</span>
              <span className="nav-user-role">{roleLabel}</span>
            </span>
          </Link>
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
      <AccessibilityControls />
      <Link className="nav-auth-button" href="/login">
        Sign in
      </Link>
      <Link className="nav-join-button" href="/register">
        Join free
      </Link>
    </div>
  );
}
