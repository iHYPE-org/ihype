'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal behavior keeps both support sheets keyboard-accessible. */
export function SupportDialog({ children, labelledBy, onClose }: {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="support-dialog"
      aria-labelledby={labelledBy}
      aria-modal="true"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="ihype-sheet-overlay" onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}>
        <div className="ihype-sheet-panel" style={{ maxWidth: 460 }}>{children}</div>
      </div>
    </dialog>
  );
}
