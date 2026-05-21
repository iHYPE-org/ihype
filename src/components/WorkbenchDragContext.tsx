'use client';

import React, { useState, createContext, useContext } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';

// ── Drag context ───────────────────────────────────────────────
export const DragTrackCtx = createContext<{
  dragging: MediaTrack | null;
  setDragging: (t: MediaTrack | null) => void;
} | null>(null);

export function useDragTrack() {
  return useContext(DragTrackCtx)!;
}

export function DragTrackProvider({ children }: { children: React.ReactNode }) {
  const [dragging, setDragging] = useState<MediaTrack | null>(null);
  return <DragTrackCtx.Provider value={{ dragging, setDragging }}>{children}</DragTrackCtx.Provider>;
}

export function DraggableTrack({ track, children, className, style, onClick }: {
  track: MediaTrack;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const { setDragging } = useDragTrack();
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      className={className}
      style={{ ...style, cursor: 'grab' }}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      onDragStart={e => {
        setDragging(track);
        e.dataTransfer.setData('application/ihype-track', JSON.stringify(track));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => setDragging(null)}
    >
      {children}
    </div>
  );
}

export function QueueDropZone({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { addToQueue } = useMediaPlayer();
  const [over, setOver] = useState(false);
  return (
    <div
      className={className}
      style={{ ...style, outline: over ? '2px solid var(--wb-accent)' : undefined, borderRadius: over ? 8 : undefined, transition: 'outline 0.1s' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        try {
          const track: MediaTrack = JSON.parse(e.dataTransfer.getData('application/ihype-track'));
          addToQueue(track);
        } catch { /* ignore */ }
      }}
    >
      {children}
    </div>
  );
}

export function PlaylistDropZone({ name, children, className, style, onClick }: { name: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState(false);
  return (
    <div
      className={className}
      style={{ ...style, outline: over ? '2px solid #b983ff' : undefined, borderRadius: over ? 10 : undefined, transition: 'outline 0.1s' }}
      onClick={onClick}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
        // In production this would POST to /api/playlists
        void name; void flash;
      }}
    >
      {children}
    </div>
  );
}
