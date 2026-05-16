'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'error';

type Toast = {
  id: number;
  text: string;
  kind: ToastKind;
};

type ToastContextValue = {
  push: (text: string, kind?: ToastKind) => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  // Tolerate missing provider (e.g. in tests / SSR) by returning a noop.
  return useContext(ToastCtx) ?? { push: () => {} };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 90,
          right: 16,
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              padding: '10px 14px',
              borderRadius: 8,
              background:
                t.kind === 'success' ? '#1d3a26'
                : t.kind === 'error' ? '#3a1d1d'
                : '#1a1a1f',
              color: '#fff',
              fontSize: 13,
              boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
              maxWidth: 320,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
