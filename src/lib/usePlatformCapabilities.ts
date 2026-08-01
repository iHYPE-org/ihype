'use client';

import { useEffect, useState } from 'react';

export type PlatformKind = 'web' | 'ios' | 'android';
export type InputKind = 'touch' | 'pointer';

export type PlatformCapabilities = {
  input: InputKind;
  isNative: boolean;
  isStandalone: boolean;
  platform: PlatformKind;
};

const initialCapabilities: PlatformCapabilities = {
  input: 'pointer',
  isNative: false,
  isStandalone: false,
  platform: 'web',
};

export function usePlatformCapabilities(): PlatformCapabilities {
  const [capabilities, setCapabilities] = useState(initialCapabilities);

  useEffect(() => {
    let disposed = false;
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    const standalone = window.matchMedia('(display-mode: standalone)');

    const updateWebCapabilities = () => {
      setCapabilities((current) => ({
        ...current,
        input: coarsePointer.matches ? 'touch' : 'pointer',
        isStandalone: standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      }));
    };

    updateWebCapabilities();
    coarsePointer.addEventListener('change', updateWebCapabilities);
    standalone.addEventListener('change', updateWebCapabilities);

    void import('@capacitor/core').then(({ Capacitor }) => {
      if (disposed || !Capacitor.isNativePlatform()) return;
      const nativePlatform = Capacitor.getPlatform();
      setCapabilities((current) => ({
        ...current,
        input: 'touch',
        isNative: true,
        isStandalone: true,
        platform: nativePlatform === 'ios' ? 'ios' : 'android',
      }));
    }).catch(() => {
      // Web remains fully functional when the native bridge is unavailable.
    });

    return () => {
      disposed = true;
      coarsePointer.removeEventListener('change', updateWebCapabilities);
      standalone.removeEventListener('change', updateWebCapabilities);
    };
  }, []);

  return capabilities;
}
