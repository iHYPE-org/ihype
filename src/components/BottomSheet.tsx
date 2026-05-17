'use client';

import { useEffect } from 'react';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 301,
          background: 'var(--surface, var(--bg-2, #100d09))',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'sheet-up 0.25s ease-out',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: 'var(--line)',
            borderRadius: 2,
            margin: '0 auto 16px',
          }}
        />
        {title && <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{title}</h2>}
        {children}
      </div>
    </>
  );
}
