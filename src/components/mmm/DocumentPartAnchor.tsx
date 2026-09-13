'use client';

import { useEffect } from 'react';

/**
 * THE BROWSER'S OWN FRAGMENT SCROLL CANNOT REACH A PART OF THIS DOCUMENT.
 *
 * `/app/me/info/privacy` forwards to `/app/me/info/terms#privacy`, and the
 * heading it names sits inside a streamed segment — so at the moment the
 * browser resolves `#privacy` that element does not exist, and by the time it
 * does the fragment has been spent. Measured both ways on the built worker:
 * arriving through the redirect AND typing the anchored URL directly, window
 * and `.mmm-pane` both sat at 0 with the privacy heading 2,336px down. The
 * same `loading.tsx` streaming boundary that puts the section strip in the
 * document twice for a frame is what eats the fragment here.
 *
 * So the scroll is explicit, once, after mount — and focus moves with it (the
 * part headings carry `tabIndex={-1}`), because a reader who asked for the
 * privacy policy and cannot see the screen is owed the same landing as one
 * who can.
 */
export function DocumentPartAnchor() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }, []);
  return null;
}
