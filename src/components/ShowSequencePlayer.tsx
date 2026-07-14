'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildResolvedSequence, type ShowProductionPlan } from '@/lib/show-composer';

type ShowSequencePlayerProps = {
  showId: string;
  showSlug: string;
  title: string;
  productionPlan: ShowProductionPlan;
  isPreview?: boolean;
  autoPlay?: boolean;
};

export function ShowSequencePlayer({
  showId,
  showSlug,
  title,
  productionPlan,
  isPreview = false,
  autoPlay = false
}: ShowSequencePlayerProps) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const hasRecordedListenRef = useRef(false);
  const pingedAdClipIdsRef = useRef<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const resolvedSequence = useMemo(() => buildResolvedSequence(productionPlan), [productionPlan]);
  const activeItem = resolvedSequence[activeIndex] ?? null;

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(autoPlay);
    hasRecordedListenRef.current = false;
  }, [autoPlay, productionPlan]);

  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (!activeItem || activeItem.url || !isPlaying) {
      return;
    }

    const timeoutMs = Math.max(1500, Math.round((activeItem.durationSeconds ?? 2) * 1000));
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      if (activeIndex < resolvedSequence.length - 1) {
        setActiveIndex((current) => current + 1);
      } else {
        setIsPlaying(false);
        if (!isPreview && !hasRecordedListenRef.current) {
          hasRecordedListenRef.current = true;
          void fetch('/api/show-listens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              showId,
              title,
              showSlug,
              playbackUrl: `/shows/${showSlug}`
            })
          }).catch(() => {
            // Keep playback resilient if tracking fails.
          });
        }
      }
    }, timeoutMs);

    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [activeIndex, activeItem, isPlaying, isPreview, resolvedSequence.length, showId, showSlug, title]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !activeItem?.url) {
      return;
    }

    if (isPlaying) {
      void media.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      media.pause();
    }
  }, [activeItem, isPlaying]);

  // Real marketplace ads (adClipId prefixed "mkt_" — see show-composer.ts)
  // get a real impression + spend recorded the first time each one starts
  // playing in an actual broadcast. Preview mode (the DJ auditioning their
  // own show before it's live) never charges advertisers.
  useEffect(() => {
    if (isPreview || !isPlaying) return;
    const clipId = activeItem?.kind === 'AD' ? activeItem.adClipId : undefined;
    if (!clipId?.startsWith('mkt_') || pingedAdClipIdsRef.current.has(clipId)) return;
    pingedAdClipIdsRef.current.add(clipId);
    void fetch('/api/ads/impression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId: clipId.slice(4) })
    }).catch(() => {
      // Keep playback resilient if impression tracking fails.
    });
  }, [activeItem, isPlaying, isPreview]);

  function moveToIndex(nextIndex: number) {
    const boundedIndex = Math.max(0, Math.min(nextIndex, resolvedSequence.length - 1));
    setActiveIndex(boundedIndex);
  }

  function completeShowIfNeeded() {
    if (isPreview || hasRecordedListenRef.current) {
      return;
    }

    hasRecordedListenRef.current = true;
    void fetch('/api/show-listens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showId,
        title,
        showSlug,
        playbackUrl: `/shows/${showSlug}`
      })
    }).catch(() => {
      // Keep playback resilient if tracking fails.
    });
  }

  function handleMediaEnded() {
    if (activeIndex < resolvedSequence.length - 1) {
      setActiveIndex((current) => current + 1);
      return;
    }

    setIsPlaying(false);
    completeShowIfNeeded();
  }

  if (!resolvedSequence.length) {
    return <div className="empty">No show media has been arranged for playback yet.</div>;
  }

  return (
    <div className="show-sequence-player">
      <div className="show-sequence-stage">
        <div className="show-sequence-stage-head">
          <div>
            <div className="badge">{isPreview ? 'Preview' : 'Broadcast'}</div>
            <h3>{activeItem?.label ?? 'Run of show'}</h3>
            {activeItem?.notes ? <p className="meta">{activeItem.notes}</p> : null}
          </div>
          <div className="show-sequence-controls">
            <button
              className="button small secondary"
              disabled={activeIndex === 0}
              onClick={() => moveToIndex(activeIndex - 1)}
              type="button"
            >
              Prev
            </button>
            <button
              className="button small"
              onClick={() => setIsPlaying((current) => !current)}
              type="button"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              className="button small secondary"
              disabled={activeIndex >= resolvedSequence.length - 1}
              onClick={() => moveToIndex(activeIndex + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        {activeItem?.url ? (
          <audio
            className="show-sequence-audio"
            controls
            key={activeItem.id}
            onEnded={handleMediaEnded}
            ref={(node) => {
              mediaRef.current = node;
            }}
            src={activeItem.url}
          />
        ) : (
          <div className="show-sequence-text-card">
            <strong>{activeItem?.label}</strong>
            <p>{activeItem?.notes ?? 'This cue is text-only and will auto-advance.'}</p>
          </div>
        )}
      </div>

      <div className="show-sequence-list">
        {resolvedSequence.map((item, index) => (
          <button
            className={index === activeIndex ? 'show-sequence-item active' : 'show-sequence-item'}
            key={item.id}
            onClick={() => moveToIndex(index)}
            type="button"
          >
            <span className="composer-sequence-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="meta">{item.kind}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

