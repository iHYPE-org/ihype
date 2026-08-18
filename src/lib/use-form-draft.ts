'use client';

import { useEffect, useRef } from 'react';

type DraftOptions<T> = {
  dirty: boolean;
  key: string;
  onRestore: (draft: T) => void;
  value: T;
};

/**
 * Restores unfinished local form work and warns before a browser-level exit.
 * Drafts stay on this device and are cleared explicitly after a successful
 * submission. The first persistence pass is skipped so defaults cannot erase
 * a stored draft before React applies it.
 */
export function useFormDraft<T>({ dirty, key, onRestore, value }: DraftOptions<T>) {
  const skipFirstPersist = useRef(true);
  const restore = useRef(onRestore);
  restore.current = onRestore;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) restore.current(JSON.parse(raw) as T);
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [key]);

  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    if (!dirty) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [dirty, key, value]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return () => window.localStorage.removeItem(key);
}
