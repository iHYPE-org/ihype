'use client';

import { useRouter } from 'next/navigation';

export function PiAdminButton() {
  const router = useRouter();
  return (
    <button
      aria-hidden="true"
      tabIndex={-1}
      onClick={() => router.push('/login?callbackUrl=%2Fadmin')}
      style={{
        position: 'fixed',
        bottom: 18,
        right: 22,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--f-m)',
        fontSize: 11,
        color: 'var(--ink-4, var(--hair-180))',
        opacity: 0.18,
        letterSpacing: '-.01em',
        padding: '4px 6px',
        borderRadius: 4,
        lineHeight: 1,
        transition: 'opacity .3s',
        zIndex: 5,
        userSelect: 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.55'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.18'; }}
    >
      π
    </button>
  );
}
