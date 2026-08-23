'use client';
// ConsoleDock.tsx — drop at src/components/mmm/ConsoleDock.tsx
// Mount once in src/app/app/layout.tsx (signed-in shell only; never pre-auth).
// Routes and data hooks are untouched: this is chrome over the existing router.
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo, useRef } from 'react';

const MODULES = ['map', 'music', 'me'] as const;
type Module = (typeof MODULES)[number];

// Section rings per module — must mirror src/lib/mmm-nav.ts.
const SECTIONS: Record<Module, { label: string; path: string }[]> = {
  map: [
    { label: 'Venues', path: '/app/map?layer=venues' },
    { label: 'Artists', path: '/app/map?layer=artists' },
    { label: 'Shows', path: '/app/map?layer=shows' },
  ],
  music: [
    { label: 'Discover', path: '/app/music/discover' },
    { label: 'Radio', path: '/app/music/radio' },
    { label: 'Charts', path: '/app/music/charts' },
    { label: 'Recommended', path: '/app/music/recommended' },
    { label: 'Playlists', path: '/app/music/playlists' },
  ],
  me: [
    { label: 'Tickets', path: '/app/me/tickets' },
    { label: 'Settings', path: '/app/me/settings' },
    { label: 'Info', path: '/app/me/info' },
    { label: 'Legal', path: '/app/me/info/terms' },
  ],
};

function moduleFromPath(p: string): Module {
  if (p.startsWith('/app/music')) return 'music';
  if (p.startsWith('/app/me')) return 'me';
  return 'map';
}

export function ConsoleDock({
  onTransport,
}: {
  /** play/pause + prev/next + expand/collapse — wire to the player store */
  onTransport?: (a: 'toggle' | 'prev' | 'next' | 'expand' | 'collapse') => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/app/map';
  const mod = moduleFromPath(pathname);
  const ring = SECTIONS[mod];
  const idx = useMemo(() => {
    const i = ring.findIndex((s) => pathname.startsWith(s.path.split('?')[0]));
    return i < 0 ? 0 : i;
  }, [pathname, ring]);

  const knobTap = useCallback(() => {
    const next = MODULES[(MODULES.indexOf(mod) + 1) % MODULES.length];
    router.push(SECTIONS[next][0].path);
  }, [mod, router]);

  // Thumbwheel: horizontal drag steps sections; continuous loop (wraps).
  const drag = useRef<{ x0: number; stepped: number } | null>(null);
  const dialDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x0: e.clientX, stepped: 0 };
  };
  const dialMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const steps = Math.trunc((e.clientX - drag.current.x0) / 56);
    if (steps !== drag.current.stepped) {
      const delta = steps - drag.current.stepped;
      drag.current.stepped = steps;
      const n = (idx + delta % ring.length + ring.length) % ring.length;
      router.push(ring[n].path);
    }
  };
  const dialUp = () => { drag.current = null; };

  // Joystick: 4-way gates + press.
  const stick = useRef<{ x0: number; y0: number; fired: boolean } | null>(null);
  const stickDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    stick.current = { x0: e.clientX, y0: e.clientY, fired: false };
  };
  const stickMove = (e: React.PointerEvent) => {
    const s = stick.current;
    if (!s || s.fired) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    s.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) onTransport?.(dx > 0 ? 'next' : 'prev');
    else onTransport?.(dy < 0 ? 'expand' : 'collapse');
  };
  const stickUp = () => {
    if (stick.current && !stick.current.fired) onTransport?.('toggle');
    stick.current = null;
  };

  return (
    <nav className="console-dock" aria-label="Console navigation">
      <button type="button" className="console-dock__knob" onClick={knobTap}
        aria-label={`Module: ${mod}. Tap for next module`}>
        {mod.toUpperCase()}
      </button>
      <div className="console-dock__dial" role="tablist" aria-label="Sections"
        onPointerDown={dialDown} onPointerMove={dialMove} onPointerUp={dialUp}>
        <span className="console-dock__dial-label">{ring[idx].label}</span>
        <span className="console-dock__dial-ticks" aria-hidden="true" />
      </div>
      <div className="console-dock__stick-well"
        onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp}>
        <div className="console-dock__stick" aria-label="Transport" role="button" tabIndex={0} />
      </div>
    </nav>
  );
}
