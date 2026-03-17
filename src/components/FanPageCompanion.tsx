'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';

type FanPageCompanionProps = {
  avatarImage: string | null;
  spriteSheetImage: string | null;
  fanName: string;
  initials: string;
};

function getCompanionMessage(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('character lab')) {
    return 'Sketching new looks for your page companion.';
  }

  if (normalized.includes('customizer')) {
    return 'Remixing the page style around your character.';
  }

  if (normalized.includes('venue')) {
    return 'Sweeping nearby rooms and live-night signals.';
  }

  if (normalized.includes('top 5')) {
    return 'Locking into the favorites at the center of your fandom.';
  }

  if (normalized.includes('stats')) {
    return 'Tracking every show, hype, and late-night replay.';
  }

  if (normalized.includes('upcoming')) {
    return 'Leaning toward the next stop on your show trail.';
  }

  if (normalized.includes('previous')) {
    return 'Replaying the rooms that already left a mark.';
  }

  if (normalized.includes('about')) {
    return 'Dialing into the story behind this fan page.';
  }

  if (normalized.includes('tabs')) {
    return 'Sliding between scenes and page moods.';
  }

  return `Drifting through ${label}.`;
}

export function FanPageCompanion({ avatarImage, spriteSheetImage, fanName, initials }: FanPageCompanionProps) {
  const [activeLabel, setActiveLabel] = useState('your fan page');
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });
  const [scrollPulse, setScrollPulse] = useState(0);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-fan-companion-root]');
    if (!root) {
      return;
    }

    const rootElement = root;

    function updatePointer(event: MouseEvent) {
      const rect = rootElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

      setPointerOffset({
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y))
      });
    }

    function resetPointer() {
      setPointerOffset({ x: 0, y: 0 });
    }

    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-fan-companion-label]'));
    const cleanups = targets.flatMap((target) => {
      const label = target.dataset.fanCompanionLabel?.trim();
      if (!label) {
        return [];
      }

      const activate = () => setActiveLabel(label);
      const deactivate = () => setActiveLabel('your fan page');

      target.addEventListener('mouseenter', activate);
      target.addEventListener('focusin', activate);
      target.addEventListener('mouseleave', deactivate);
      target.addEventListener('focusout', deactivate);

      return [
        () => target.removeEventListener('mouseenter', activate),
        () => target.removeEventListener('focusin', activate),
        () => target.removeEventListener('mouseleave', deactivate),
        () => target.removeEventListener('focusout', deactivate)
      ];
    });

    const syncScroll = () => setScrollPulse(window.scrollY % 240);

    rootElement.addEventListener('mousemove', updatePointer);
    rootElement.addEventListener('mouseleave', resetPointer);
    window.addEventListener('scroll', syncScroll, { passive: true });
    syncScroll();

    return () => {
      rootElement.removeEventListener('mousemove', updatePointer);
      rootElement.removeEventListener('mouseleave', resetPointer);
      window.removeEventListener('scroll', syncScroll);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const companionStyle = useMemo(
    () =>
      ({
        '--fan-companion-offset-x': `${pointerOffset.x * 12}px`,
        '--fan-companion-offset-y': `${pointerOffset.y * 10}px`,
        '--fan-companion-tilt': `${pointerOffset.x * 6}deg`,
        '--fan-companion-pulse': `${1 + scrollPulse / 1200}`
      }) as CSSProperties,
    [pointerOffset.x, pointerOffset.y, scrollPulse]
  );

  return (
    <aside aria-label={`${fanName} page companion`} className="fan-page-companion" style={companionStyle}>
      <div className="fan-page-companion-bubble">{getCompanionMessage(activeLabel)}</div>
      <div className="fan-page-companion-shell">
        <span className="fan-page-companion-orbit fan-page-companion-orbit-one" />
        <span className="fan-page-companion-orbit fan-page-companion-orbit-two" />
        {spriteSheetImage ? (
          <span
            aria-label={`${fanName} sprite companion`}
            className="fan-page-companion-sprite"
            style={{ backgroundImage: `url(${spriteSheetImage})` }}
          />
        ) : avatarImage ? (
          <img alt={`${fanName} page companion`} className="fan-page-companion-avatar" src={avatarImage} />
        ) : (
          <div className="profile-avatar profile-avatar-fallback fan-page-companion-fallback">{initials}</div>
        )}
      </div>
    </aside>
  );
}
