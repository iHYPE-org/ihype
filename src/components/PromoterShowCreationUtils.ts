import type { CSSProperties } from 'react';
import type { ShowSequenceItem } from '@/lib/show-composer';

export type ArtistLibraryEntry = {
  id: string;
  hexId: string;
  title: string;
  url: string;
  notes: string | null;
  mimeType?: string | null;
  mediaType?: 'audio' | 'video';
  previewImageUrl?: string | null;
};

export type ArtistLibrary = {
  profileId: string;
  slug: string;
  name: string;
  heroImage: string | null;
  entries: ArtistLibraryEntry[];
};

export type PromoterIdentity = {
  profileId: string;
  name: string;
  slug: string;
};

export type VenueOption = {
  profileId: string;
  slug: string;
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  postalCode?: string | null;
};

export type PendingVoiceRecording = {
  dataUrl: string;
  durationSeconds: number;
  mimeType: string;
};

export type DraggedMediaPayload = {
  source: 'library' | 'playlist';
  mediaItem: import('@/lib/show-composer').ShowMediaItem;
};

export type DraggedSamplePayload = {
  sample: PadAssignment;
};

export type PadMenuState = {
  slotNumber: number;
  x: number;
  y: number;
};

export type PadAssignment = import('@/lib/show-composer').ShowSamplePad & {
  localOnly?: boolean;
};

export type ShowSaveIntent = 'preview' | 'publish';
export type CreatorUtilityPanel = 'library' | 'voice' | 'queue' | 'setlist';
export type TimelineLaneItem = {
  id: string;
  label: string;
  meta: string;
  kind: 'media' | 'voice' | 'sample' | 'ad';
};

export const PAD_COLORS = ['#ff6b6b', '#f59e0b', '#f4d03f', '#22c55e', '#23d0d8', '#3b82f6', '#8f5bff', '#ec4899'];

export const MICROPHONE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4'
];

export function createClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

export function buildSequenceLabel(kind: ShowSequenceItem['kind'], label: string) {
  if (kind === 'VOICE_OVER') return `Voice-over: ${label}`;
  if (kind === 'SAMPLE') return `Sample pad: ${label}`;
  if (kind === 'AD') return `Ad break: ${label}`;
  return `Media: ${label}`;
}

export function buildPadRefId(slotNumber: number) {
  return `pad-${slotNumber}`;
}

export function buildPadLabel(slotNumber: number, title: string) {
  return `Pad ${String(slotNumber).padStart(2, '0')} - ${title}`;
}

export function buildHexId() {
  return `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

export function getDefaultPadColor(slotNumber: number) {
  return PAD_COLORS[(slotNumber - 1) % PAD_COLORS.length] ?? '#23d0d8';
}

export function buildTimelineClipStyle(index: number, total: number) {
  const safeTotal = Math.max(total, 1);
  const laneSegment = 100 / safeTotal;
  const width = Math.max(10, Math.min(26, laneSegment - 2));
  const left = Math.min(88, index * laneSegment + 1);

  return {
    left: `${left}%`,
    width: `${width}%`
  } satisfies CSSProperties;
}

export function formatDurationLabel(seconds?: number) {
  if (!seconds) {
    return 'open';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  return MICROPHONE_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not prepare audio preview.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not prepare audio preview.'));
    reader.readAsDataURL(blob);
  });
}
