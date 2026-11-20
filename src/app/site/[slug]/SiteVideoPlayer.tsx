'use client';

import { useRef, useState } from 'react';

export function SiteVideoPlayer({ title, playbackId }: { title: string; playbackId: string }) {
  const [active, setActive] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  return active ? (
    <iframe
      ref={element => {
        if (element && frame.current !== element) element.focus();
        frame.current = element;
      }}
      title={title}
      src={`https://player.mux.com/${encodeURIComponent(playbackId)}?autoplay=true`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  ) : (
    <button type="button" className="ih-site-video-play" aria-label={`Play ${title}`} onClick={() => setActive(true)}>
      <span aria-hidden="true">▶</span>
    </button>
  );
}
