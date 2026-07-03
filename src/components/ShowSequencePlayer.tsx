'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ShowAdClip,
  ShowMediaItem,
  ShowProductionPlan,
  ShowSamplePad,
  ShowSequenceItem,
  VoiceOverCue
} from '@/lib/show-composer';

type ShowSequencePlayerProps = {
  showId: string;
  showSlug: string;
  title: string;
  productionPlan: ShowProductionPlan;
  isPreview?: boolean;
  autoPlay?: boolean;
};

type ResolvedSequenceItem = {
  id: string;
  kind: ShowSequenceItem['kind'];
  label: string;
  url?: string;
  mediaType?: 'audio';
  notes?: string | null;
  durationSeconds?: number;
  previewImageUrl?: string | null;
};

function buildResolvedSequence(productionPlan: ShowProductionPlan) {
  const mediaById = new Map<string, ShowMediaItem>(
    productionPlan.mediaItems.map((item) => [item.mediaId, item])
  );
  const voiceById = new Map<string, VoiceOverCue>(
    productionPlan.voiceOvers.map((item) => [item.id, item])
  );
  const sampleByRef = new Map<string, ShowSamplePad>(
    productionPlan.samplePads
      .filter((item) => item.assignedPad)
      .map((item) => [`pad-${item.assignedPad}`, item])
  );

  const adClipById = new Map<string, ShowAdClip>(
    (productionPlan.advertising?.clips ?? []).map((clip) => [clip.clipId, clip])
  );
  const adClips = productionPlan.advertising?.enabled ? productionPlan.advertising.clips ?? [] : [];
  const frequency = productionPlan.advertising?.frequency ?? 3;
  // Shows that explicitly place AD cues in their sequence (e.g. the Radio
  // Show Creator) opt out of the legacy frequency-based auto-injection below
  // — otherwise ad breaks would play twice.
  const hasExplicitAds = productionPlan.sequence.some((item) => item.kind === 'AD');
  let mediaCount = 0;
  let adIndex = 0;

  const resolved: ResolvedSequenceItem[] = [];

  for (const item of productionPlan.sequence) {
    if (item.kind === 'AD') {
      const adClip = adClipById.get(item.refId);
      if (!adClip) {
        continue;
      }

      resolved.push({
        id: item.id,
        kind: item.kind,
        label: item.label,
        url: adClip.url,
        mediaType: 'audio',
        notes: adClip.notes,
        durationSeconds: adClip.durationSeconds
      });
      continue;
    }

    if (item.kind === 'MEDIA') {
      const mediaItem = mediaById.get(item.refId);
      if (!mediaItem) {
        continue;
      }

      mediaCount += 1;
      resolved.push({
        id: item.id,
        kind: item.kind,
        label: item.label,
        url: mediaItem.url,
        mediaType: mediaItem.mediaType,
        notes: mediaItem.notes,
        previewImageUrl: mediaItem.previewImageUrl
      });

      if (!hasExplicitAds && adClips.length && mediaCount % frequency === 0) {
        const adClip = adClips[adIndex % adClips.length] as ShowAdClip;
        resolved.push({
          id: `ad-${adClip.clipId}-${mediaCount}`,
          kind: 'AD',
          label: `Advertisement: ${adClip.title}`,
          url: adClip.url,
          mediaType: 'audio',
          notes: adClip.notes,
          durationSeconds: adClip.durationSeconds
        });
        adIndex += 1;
      }

      continue;
    }

    if (item.kind === 'VOICE_OVER') {
      const voiceItem = voiceById.get(item.refId);
      if (!voiceItem) {
        continue;
      }

      resolved.push({
        id: item.id,
        kind: item.kind,
        label: item.label,
        url: voiceItem.recordingDataUrl,
        mediaType: voiceItem.recordingDataUrl ? 'audio' : undefined,
        notes: voiceItem.script,
        durationSeconds: voiceItem.durationSeconds
      });
      continue;
    }

    if (item.kind === 'SAMPLE') {
      const sampleItem = sampleByRef.get(item.refId);
      if (!sampleItem) {
        continue;
      }

      resolved.push({
        id: item.id,
        kind: item.kind,
        label: item.label,
        url: sampleItem.url,
        mediaType: 'audio',
        notes: sampleItem.notes
      });
    }
  }

  return resolved;
}

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

