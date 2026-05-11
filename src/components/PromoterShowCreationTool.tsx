'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { SetListBuilder, type SetListTrack } from '@/components/SetListBuilder';
import { getAdvertisingClipsForScope } from '@/lib/advertising';
import {
  royaltyFreeSampleClips,
  samplePadSlots,
  type AdvertisingScope,
  type ShowMediaItem,
  type ShowProductionPlan,
  type ShowSamplePad,
  type ShowSequenceItem,
  type VoiceOverCue
} from '@/lib/show-composer';

type ArtistLibraryEntry = {
  id: string;
  hexId: string;
  title: string;
  url: string;
  notes: string | null;
  mimeType?: string | null;
  mediaType?: 'audio' | 'video';
  previewImageUrl?: string | null;
};

type ArtistLibrary = {
  profileId: string;
  slug: string;
  name: string;
  heroImage: string | null;
  entries: ArtistLibraryEntry[];
};

type PromoterIdentity = {
  profileId: string;
  name: string;
  slug: string;
};

type VenueOption = {
  profileId: string;
  slug: string;
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  postalCode?: string | null;
};

type PendingVoiceRecording = {
  dataUrl: string;
  durationSeconds: number;
  mimeType: string;
};

type DraggedMediaPayload = {
  source: 'library' | 'playlist';
  mediaItem: ShowMediaItem;
};

type DraggedSamplePayload = {
  sample: PadAssignment;
};

type PadMenuState = {
  slotNumber: number;
  x: number;
  y: number;
};

type PadAssignment = ShowSamplePad & {
  localOnly?: boolean;
};

type ShowSaveIntent = 'preview' | 'publish';
type CreatorUtilityPanel = 'library' | 'voice' | 'queue' | 'setlist';
type CreatorMode = 'radio' | 'liveEvent';
type TimelineLaneItem = {
  id: string;
  label: string;
  meta: string;
  kind: 'media' | 'voice' | 'sample' | 'ad';
};

const PAD_COLORS = ['#ff6b6b', '#f59e0b', '#f4d03f', '#22c55e', '#23d0d8', '#3b82f6', '#8f5bff', '#ec4899'];

type PromoterShowCreationToolProps = {
  artists: ArtistLibrary[];
  promoters: PromoterIdentity[];
  initialPromoterProfileId?: string;
  venues?: VenueOption[];
  surface?: 'dashboard' | 'page';
};

const MICROPHONE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4'
];

function createClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildSequenceLabel(kind: ShowSequenceItem['kind'], label: string) {
  if (kind === 'VOICE_OVER') return `Voice-over: ${label}`;
  if (kind === 'SAMPLE') return `Sample pad: ${label}`;
  if (kind === 'AD') return `Ad break: ${label}`;
  return `Media: ${label}`;
}

function buildPadRefId(slotNumber: number) {
  return `pad-${slotNumber}`;
}

function buildPadLabel(slotNumber: number, title: string) {
  return `Pad ${String(slotNumber).padStart(2, '0')} - ${title}`;
}

function buildHexId() {
  return `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function getDefaultPadColor(slotNumber: number) {
  return PAD_COLORS[(slotNumber - 1) % PAD_COLORS.length] ?? '#23d0d8';
}

function isVideoMedia(mediaItem: { mediaType?: 'audio' | 'video'; mimeType?: string | null; url: string }) {
  return (
    mediaItem.mediaType === 'video' ||
    mediaItem.mimeType?.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v)$/i.test(mediaItem.url)
  );
}

function buildTimelineClipStyle(index: number, total: number) {
  const safeTotal = Math.max(total, 1);
  const laneSegment = 100 / safeTotal;
  const width = Math.max(10, Math.min(26, laneSegment - 2));
  const left = Math.min(88, index * laneSegment + 1);

  return {
    left: `${left}%`,
    width: `${width}%`
  } satisfies CSSProperties;
}

function formatDurationLabel(seconds?: number) {
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

function formatVenueLabel(venue: VenueOption) {
  const location = [venue.city, venue.stateRegion ?? venue.country, venue.postalCode].filter(Boolean).join(', ');
  return location ? `${venue.name} - ${location}` : venue.name;
}

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  return MICROPHONE_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function blobToDataUrl(blob: Blob) {
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

export function PromoterShowCreationTool({
  artists,
  promoters,
  initialPromoterProfileId,
  venues = [],
  surface = 'page'
}: PromoterShowCreationToolProps) {
  const router = useRouter();
  const isDashboardSurface = surface === 'dashboard';
  const { currentTrack, isPlaying, playTrack, togglePlayback } = useMediaPlayer();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const customSampleUrlsRef = useRef<string[]>([]);
  const padMenuRef = useRef<HTMLDivElement | null>(null);
  const takePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [creatorMode, setCreatorMode] = useState<CreatorMode>('radio');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPromoterProfileId, setSelectedPromoterProfileId] = useState(initialPromoterProfileId ?? promoters[0]?.profileId ?? '');
  const [headlinerProfileId, setHeadlinerProfileId] = useState(artists[0]?.profileId ?? '');
  const [selectedVenueProfileId, setSelectedVenueProfileId] = useState(venues[0]?.profileId ?? '');
  const [liveStartsAt, setLiveStartsAt] = useState('');
  const [liveEndsAt, setLiveEndsAt] = useState('');
  const [liveTags, setLiveTags] = useState('live-event, venue-review');
  const [selectedMedia, setSelectedMedia] = useState<ShowMediaItem[]>([]);
  const [voiceOvers, setVoiceOvers] = useState<VoiceOverCue[]>([]);
  const [padAssignments, setPadAssignments] = useState<PadAssignment[]>([]);
  const [customSampleClips, setCustomSampleClips] = useState<PadAssignment[]>([]);
  const [sequence, setSequence] = useState<ShowSequenceItem[]>([]);
  const [voiceTitle, setVoiceTitle] = useState('');
  const [voiceScript, setVoiceScript] = useState('');
  const [voiceDuration, setVoiceDuration] = useState('20');
  const [voiceCueAfterMediaId, setVoiceCueAfterMediaId] = useState('');
  const [recordedVoiceTake, setRecordedVoiceTake] = useState<PendingVoiceRecording | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [microphoneSupported, setMicrophoneSupported] = useState(false);
  const [padMenu, setPadMenu] = useState<PadMenuState | null>(null);
  const [draggedMedia, setDraggedMedia] = useState<DraggedMediaPayload | null>(null);
  const [draggedSample, setDraggedSample] = useState<DraggedSamplePayload | null>(null);
  const [playlistDropIndex, setPlaylistDropIndex] = useState<number | null>(null);
  const [crossfaderPosition, setCrossfaderPosition] = useState(50);
  const [deckATrackId, setDeckATrackId] = useState<string | null>(null);
  const [deckBTrackId, setDeckBTrackId] = useState<string | null>(null);
  const [padColorMap, setPadColorMap] = useState<Record<number, string>>({});
  const [activePadSlot, setActivePadSlot] = useState<number | null>(null);
  const [isTakePreviewPlaying, setIsTakePreviewPlaying] = useState(false);
  const [previewMediaItem, setPreviewMediaItem] = useState<ShowMediaItem | null>(null);
  const [saveIntent, setSaveIntent] = useState<ShowSaveIntent>('preview');
  const [activeUtilityPanel, setActiveUtilityPanel] = useState<CreatorUtilityPanel>('library');
  const [setListTracks, setSetListTracks] = useState<SetListTrack[]>([]);
  const [lastSavedShowHref, setLastSavedShowHref] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const advertisingScope: AdvertisingScope = 'local';

  const playableArtists = useMemo(() => artists.filter((artist) => artist.entries.length > 0), [artists]);
  const availableSampleClips = useMemo<PadAssignment[]>(
    () => [...royaltyFreeSampleClips, ...customSampleClips],
    [customSampleClips]
  );
  const selectedHeadliner = artists.find((artist) => artist.profileId === headlinerProfileId) ?? null;
  const selectedPromoter = promoters.find((promoter) => promoter.profileId === selectedPromoterProfileId) ?? promoters[0] ?? null;
  const selectedLiveVenue = venues.find((venue) => venue.profileId === selectedVenueProfileId) ?? null;
  const recordedVoiceCount = voiceOvers.filter((voiceCue) => Boolean(voiceCue.recordingDataUrl)).length;
  const cueSequence = sequence.filter((sequenceItem) => sequenceItem.kind !== 'MEDIA');
  const advertisingClips = useMemo(() => getAdvertisingClipsForScope(advertisingScope), [advertisingScope]);
  const deckALevel = Math.max(0, 100 - crossfaderPosition);
  const deckBLevel = crossfaderPosition;
  const deckATrack = selectedMedia.find((mediaItem) => mediaItem.mediaId === deckATrackId) ?? null;
  const deckBTrack = selectedMedia.find((mediaItem) => mediaItem.mediaId === deckBTrackId) ?? null;
  const sectionBadgeClassName = isDashboardSurface ? 'badge composer-badge-compact' : 'badge';
  const headerClassName = isDashboardSurface
    ? 'composer-header composer-header-compact composer-header-dashboard'
    : 'composer-header composer-header-compact';
  const headerCopyClassName = isDashboardSurface
    ? 'composer-surface-copy composer-surface-copy-dashboard'
    : 'composer-surface-copy';
  const summaryStripClassName = isDashboardSurface
    ? 'composer-summary-strip composer-summary-strip-dashboard'
    : 'composer-summary-strip';
  const workstationHeaderClassName = isDashboardSurface
    ? 'composer-workstation-header composer-workstation-header-compact composer-workstation-header-dashboard'
    : 'composer-workstation-header composer-workstation-header-compact';

  useEffect(() => {
    setMicrophoneSupported(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined'
    );
  }, []);

  useEffect(() => {
    if (!selectedPromoterProfileId && promoters[0]) {
      setSelectedPromoterProfileId(promoters[0].profileId);
    }
  }, [promoters, selectedPromoterProfileId]);

  useEffect(() => {
    if (!selectedVenueProfileId && venues[0]) {
      setSelectedVenueProfileId(venues[0].profileId);
    }
  }, [selectedVenueProfileId, venues]);

  useEffect(() => {
    if (deckATrackId && !selectedMedia.some((mediaItem) => mediaItem.mediaId === deckATrackId)) {
      setDeckATrackId(null);
    }

    if (deckBTrackId && !selectedMedia.some((mediaItem) => mediaItem.mediaId === deckBTrackId)) {
      setDeckBTrackId(null);
    }

    if (previewMediaItem && !selectedMedia.some((mediaItem) => mediaItem.mediaId === previewMediaItem.mediaId)) {
      setPreviewMediaItem(null);
    }
  }, [deckATrackId, deckBTrackId, previewMediaItem, selectedMedia]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      customSampleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!padMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!padMenuRef.current?.contains(event.target)) {
        setPadMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPadMenu(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [padMenu]);

  useEffect(() => {
    if (!padMenu || !padMenuRef.current || typeof window === 'undefined') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const rect = padMenuRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportPadding = 12;
      const nextX = Math.min(
        Math.max(viewportPadding, padMenu.x),
        Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding)
      );
      const nextY = Math.min(
        Math.max(viewportPadding, padMenu.y),
        Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding)
      );

      if (nextX !== padMenu.x || nextY !== padMenu.y) {
        setPadMenu((current) => (current ? { ...current, x: nextX, y: nextY } : current));
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [padMenu, customSampleClips.length]);

  function clearRecorderStream() {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current = null;
  }

  function getPadAssignment(slotNumber: number) {
    return padAssignments.find((assignment) => assignment.assignedPad === slotNumber) ?? null;
  }

  function getPadColor(slotNumber: number, assignment?: PadAssignment | null) {
    return assignment?.colorHex ?? padColorMap[slotNumber] ?? getDefaultPadColor(slotNumber);
  }

  function setPadColor(slotNumber: number, colorHex: string) {
    setPadColorMap((current) => ({
      ...current,
      [slotNumber]: colorHex
    }));
    setPadAssignments((current) =>
      current.map((assignment) =>
        assignment.assignedPad === slotNumber ? { ...assignment, colorHex } : assignment
      )
    );
  }

  function handleCustomSampleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const nextSamples = files
      .filter((file) => file.type.startsWith('audio/'))
      .map((file, index) => {
        const url = URL.createObjectURL(file);
        customSampleUrlsRef.current.push(url);

        return {
          sampleId: buildHexId(),
          title: file.name.replace(/\.[^.]+$/, ''),
          url,
          notes: 'Local upload. Available only in this browser until refresh.',
          category: 'local',
          colorHex: PAD_COLORS[(customSampleClips.length + index) % PAD_COLORS.length] ?? '#23d0d8',
          localOnly: true
        } satisfies PadAssignment;
      });

    if (!nextSamples.length) {
      setMessage('Choose audio files to load local sound effects.');
      event.target.value = '';
      return;
    }

    setCustomSampleClips((current) => [...current, ...nextSamples]);
    setMessage(`${nextSamples.length} local sound effect${nextSamples.length === 1 ? '' : 's'} loaded for this session.`);
    event.target.value = '';
  }

  function createMediaSequenceItem(mediaItem: ShowMediaItem): ShowSequenceItem {
    return {
      id: createClientId('seq-media'),
      kind: 'MEDIA',
      refId: mediaItem.mediaId,
      label: `${mediaItem.title} (${mediaItem.artistName})`
    };
  }

  function insertMediaIntoSequence(
    currentSequence: ShowSequenceItem[],
    mediaItem: ShowMediaItem,
    playlistIndex: number
  ) {
    const nextSequenceItem = createMediaSequenceItem(mediaItem);
    const nextSequence = [...currentSequence];
    let seenMedia = 0;

    for (let index = 0; index < nextSequence.length; index += 1) {
      if (nextSequence[index]?.kind !== 'MEDIA') {
        continue;
      }

      if (seenMedia === playlistIndex) {
        nextSequence.splice(index, 0, nextSequenceItem);
        return nextSequence;
      }

      seenMedia += 1;
    }

    nextSequence.push(nextSequenceItem);
    return nextSequence;
  }

  function syncSequenceWithMediaOrder(currentSequence: ShowSequenceItem[], orderedMedia: ShowMediaItem[]) {
    const mediaSequenceItems = orderedMedia.map(
      (mediaItem) =>
        currentSequence.find((sequenceItem) => sequenceItem.kind === 'MEDIA' && sequenceItem.refId === mediaItem.mediaId) ??
        createMediaSequenceItem(mediaItem)
    );

    if (!currentSequence.some((sequenceItem) => sequenceItem.kind === 'MEDIA')) {
      return [...currentSequence, ...mediaSequenceItems];
    }

    let mediaCursor = 0;
    return currentSequence.map((sequenceItem) =>
      sequenceItem.kind === 'MEDIA' ? mediaSequenceItems[mediaCursor++] : sequenceItem
    );
  }

  function addOrMoveMediaInPlaylist(mediaItem: ShowMediaItem, requestedIndex?: number) {
    setSelectedMedia((current) => {
      const existingIndex = current.findIndex((entry) => entry.mediaId === mediaItem.mediaId);
      const fallbackIndex = existingIndex === -1 ? current.length : existingIndex;
      const targetIndex = Math.max(0, Math.min(requestedIndex ?? fallbackIndex, current.length));
      const nextMedia = [...current];

      if (existingIndex !== -1) {
        const [existingItem] = nextMedia.splice(existingIndex, 1);
        const normalizedIndex = Math.max(0, Math.min(targetIndex, nextMedia.length));
        nextMedia.splice(normalizedIndex, 0, existingItem);
        setSequence((currentSequence) => syncSequenceWithMediaOrder(currentSequence, nextMedia));
        setMessage(`${mediaItem.title} moved inside the playlist.`);
        return nextMedia;
      }

      nextMedia.splice(targetIndex, 0, mediaItem);
      setSequence((currentSequence) =>
        syncSequenceWithMediaOrder(insertMediaIntoSequence(currentSequence, mediaItem, targetIndex), nextMedia)
      );

      if (!headlinerProfileId) {
        setHeadlinerProfileId(mediaItem.artistProfileId);
      }

      setMessage(`${mediaItem.title} added to the playlist.`);
      return nextMedia;
    });
  }

  function clearPlaylistDragState() {
    setDraggedMedia(null);
    setPlaylistDropIndex(null);
  }

  function clearSampleDragState() {
    setDraggedSample(null);
  }

  function openPadMenuAt(slotNumber: number, x: number, y: number) {
    const viewportPadding = 12;
    const menuWidth = 236;
    const estimatedMenuHeight =
      typeof window !== 'undefined' ? Math.min(400, window.innerHeight - viewportPadding * 2) : 400;
    const maxX = typeof window !== 'undefined' ? Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding) : x;
    const maxY =
      typeof window !== 'undefined'
        ? Math.max(viewportPadding, window.innerHeight - estimatedMenuHeight - viewportPadding)
        : y;

    setPadMenu({
      slotNumber,
      x: Math.min(Math.max(viewportPadding, x), maxX),
      y: Math.min(Math.max(viewportPadding, y), maxY)
    });
  }

  function handlePadContextMenu(event: React.MouseEvent<HTMLButtonElement>, slotNumber: number) {
    event.preventDefault();
    openPadMenuAt(slotNumber, event.clientX + 8, event.clientY - 8);
  }

  function handlePadKeyboardMenu(event: React.KeyboardEvent<HTMLButtonElement>, slotNumber: number) {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) {
      return;
    }

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    openPadMenuAt(slotNumber, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  function addMedia(artist: ArtistLibrary, entry: ArtistLibraryEntry) {
    const mediaItem: ShowMediaItem = {
      mediaId: entry.hexId,
      title: entry.title,
      url: entry.url,
      artistProfileId: artist.profileId,
      artistName: artist.name,
      notes: entry.notes,
      mimeType: entry.mimeType,
      mediaType: entry.mediaType ?? (isVideoMedia({ url: entry.url, mimeType: entry.mimeType }) ? 'video' : 'audio'),
      previewImageUrl: entry.previewImageUrl ?? artist.heroImage
    };
    addOrMoveMediaInPlaylist(mediaItem);
  }

  function playPlaylistMedia(mediaItem: ShowMediaItem, artworkUrl?: string | null) {
    if (isVideoMedia(mediaItem)) {
      setPreviewMediaItem(mediaItem);
      setMessage(`${mediaItem.title} loaded into the preview monitor.`);
      return;
    }

    playTrack(
      {
        id: mediaItem.mediaId,
        title: mediaItem.title,
        artistName: mediaItem.artistName,
        url: mediaItem.url,
        mediaId: mediaItem.mediaId,
        notes: mediaItem.notes,
        artworkUrl: artworkUrl ?? null
      },
      selectedMedia
        .filter((entry) => !isVideoMedia(entry))
        .map((entry) => ({
          id: entry.mediaId,
          title: entry.title,
          artistName: entry.artistName,
          url: entry.url,
          mediaId: entry.mediaId,
          notes: entry.notes,
          artworkUrl:
            artists.find((artist) => artist.profileId === entry.artistProfileId)?.heroImage ?? null
        }))
    );
  }

  function getTrackArtwork(mediaItem: ShowMediaItem) {
    return artists.find((artist) => artist.profileId === mediaItem.artistProfileId)?.heroImage ?? null;
  }

  function buildDeckQueue(mediaItem: ShowMediaItem) {
    return selectedMedia
      .filter((entry) => !isVideoMedia(entry))
      .map((entry) => ({
      id: entry.mediaId,
      title: entry.title,
      artistName: entry.artistName,
      url: entry.url,
      mediaId: entry.mediaId,
      notes: entry.notes,
      artworkUrl: getTrackArtwork(entry)
      }));
  }

  function loadDeck(deck: 'A' | 'B', mediaItem: ShowMediaItem) {
    if (deck === 'A') {
      setDeckATrackId(mediaItem.mediaId);
    } else {
      setDeckBTrackId(mediaItem.mediaId);
    }

    setMessage(`${mediaItem.title} loaded onto Deck ${deck}.`);
  }

  function playDeckTrack(deck: 'A' | 'B', mediaItem: ShowMediaItem | null) {
    if (!mediaItem) {
      setMessage(`Load a playlist song onto Deck ${deck} first.`);
      return;
    }

    if (isVideoMedia(mediaItem)) {
      setPreviewMediaItem(mediaItem);
      setMessage(`${mediaItem.title} loaded onto Deck ${deck} and opened in the preview monitor.`);
      return;
    }

    const artworkUrl = getTrackArtwork(mediaItem);

    if (currentTrack?.url === mediaItem.url) {
      togglePlayback();
      return;
    }

    playTrack(
      {
        id: `${deck.toLowerCase()}-${mediaItem.mediaId}`,
        title: mediaItem.title,
        artistName: mediaItem.artistName,
        url: mediaItem.url,
        mediaId: mediaItem.mediaId,
        notes: mediaItem.notes,
        artworkUrl
      },
      buildDeckQueue(mediaItem)
    );
  }

  function cueDeckTrack(deck: 'A' | 'B', mediaItem: ShowMediaItem | null) {
    if (!mediaItem) {
      setMessage(`Load a playlist song onto Deck ${deck} first.`);
      return;
    }

    playTrack(
      {
        id: `${deck.toLowerCase()}-${mediaItem.mediaId}-cue`,
        title: mediaItem.title,
        artistName: mediaItem.artistName,
        url: mediaItem.url,
        mediaId: mediaItem.mediaId,
        notes: mediaItem.notes,
        artworkUrl: getTrackArtwork(mediaItem)
      },
      buildDeckQueue(mediaItem)
    );
    setMessage(`${mediaItem.title} cued on Deck ${deck}.`);
  }

  function handleDeckDragOver(event: React.DragEvent<HTMLElement>) {
    if (!draggedMedia) {
      return;
    }

    event.preventDefault();
  }

  function handleDeckDrop(event: React.DragEvent<HTMLElement>, deck: 'A' | 'B') {
    if (!draggedMedia) {
      return;
    }

    event.preventDefault();

    if (draggedMedia.source !== 'playlist') {
      clearPlaylistDragState();
      setMessage('Add the song to the playlist first, then drag it onto a deck.');
      return;
    }

    loadDeck(deck, draggedMedia.mediaItem);
    clearPlaylistDragState();
  }

  function assignSampleToPad(slotNumber: number, sampleId: string) {
    if (!sampleId) {
      setPadAssignments((current) => current.filter((assignment) => assignment.assignedPad !== slotNumber));
      setSequence((current) => current.filter((item) => !(item.kind === 'SAMPLE' && item.refId === buildPadRefId(slotNumber))));
      setPadMenu(null);
      setMessage(`Pad ${String(slotNumber).padStart(2, '0')} cleared.`);
      return;
    }

    const sample = availableSampleClips.find((entry) => entry.sampleId === sampleId);
    if (!sample) {
      setMessage('Could not assign that sample clip.');
      return;
    }

    const assignedSample: PadAssignment = {
      ...sample,
      colorHex: getPadColor(slotNumber, sample),
      assignedPad: slotNumber
    };

    setPadAssignments((current) =>
      [...current.filter((assignment) => assignment.assignedPad !== slotNumber), assignedSample].sort(
        (left, right) => (left.assignedPad ?? 99) - (right.assignedPad ?? 99)
      )
    );
    setSequence((current) =>
      current.map((item) =>
        item.kind === 'SAMPLE' && item.refId === buildPadRefId(slotNumber)
          ? { ...item, label: buildPadLabel(slotNumber, sample.title) }
          : item
      )
    );
    setPadMenu(null);
    setMessage(
      `${sample.title} assigned to pad ${String(slotNumber).padStart(2, '0')}${sample.localOnly ? ' for this browser session only' : ''}.`
    );
  }

  function removeMediaFromPlaylist(mediaId: string) {
    setSelectedMedia((current) => {
      const nextMedia = current.filter((entry) => entry.mediaId !== mediaId);
      setSequence((currentSequence) => currentSequence.filter((item) => !(item.kind === 'MEDIA' && item.refId === mediaId)));
      return nextMedia;
    });

    if (deckATrackId === mediaId) {
      setDeckATrackId(null);
    }

    if (deckBTrackId === mediaId) {
      setDeckBTrackId(null);
    }

    setMessage('Track removed from the playlist.');
  }

  function handleLibraryDragStart(mediaItem: ShowMediaItem) {
    setDraggedMedia({ source: 'library', mediaItem });
  }

  function handlePlaylistDragStart(mediaItem: ShowMediaItem) {
    setDraggedMedia({ source: 'playlist', mediaItem });
  }

  function handleSampleDragStart(sample: PadAssignment) {
    setDraggedSample({ sample });
  }

  function handlePlaylistDragOver(event: React.DragEvent<HTMLElement>, index: number) {
    if (!draggedMedia) {
      return;
    }

    event.preventDefault();
    setPlaylistDropIndex(index);
  }

  function handlePlaylistDrop(event: React.DragEvent<HTMLElement>, index: number) {
    if (!draggedMedia) {
      return;
    }

    event.preventDefault();
    addOrMoveMediaInPlaylist(draggedMedia.mediaItem, index);
    clearPlaylistDragState();
  }

  function handlePadDragOver(event: React.DragEvent<HTMLButtonElement>) {
    if (!draggedSample) {
      return;
    }

    event.preventDefault();
  }

  function handlePadDrop(event: React.DragEvent<HTMLButtonElement>, slotNumber: number) {
    if (!draggedSample) {
      return;
    }

    event.preventDefault();
    assignSampleToPad(slotNumber, draggedSample.sample.sampleId);
    clearSampleDragState();
  }

  function triggerPad(slotNumber: number) {
    const assignment = getPadAssignment(slotNumber);
    if (!assignment) {
      setMessage(`Assign a sample to pad ${String(slotNumber).padStart(2, '0')} first.`);
      return;
    }

    setActivePadSlot(slotNumber);
    window.setTimeout(() => {
      setActivePadSlot((current) => (current === slotNumber ? null : current));
    }, 180);

    playTrack({
      id: `${assignment.sampleId}-pad-${slotNumber}`,
      title: buildPadLabel(slotNumber, assignment.title),
      artistName: 'iHYPE sample pad',
      url: assignment.url,
      notes: assignment.notes ?? 'Royalty-free clip'
    });
    setMessage(`${buildPadLabel(slotNumber, assignment.title)} triggered.`);
  }

  function addAssignedPadToSequence(slotNumber: number) {
    const assignment = getPadAssignment(slotNumber);
    if (!assignment) {
      setMessage(`Assign a clip to pad ${String(slotNumber).padStart(2, '0')} before adding it.`);
      return;
    }

    if (assignment.localOnly) {
      setMessage('Local uploaded sound effects stay in this browser session only and are not added to saved show plans.');
      return;
    }

    setSequence((current) => [
      ...current,
      {
        id: createClientId('seq-sample'),
        kind: 'SAMPLE',
        refId: buildPadRefId(slotNumber),
        label: buildPadLabel(slotNumber, assignment.title)
      }
    ]);
    setActiveUtilityPanel('queue');
    setMessage(`${buildPadLabel(slotNumber, assignment.title)} added to the show flow.`);
  }

  async function startVoiceRecording() {
    if (!microphoneSupported) {
      setMessage('This browser does not expose microphone recording support.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recorderChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          recorderChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const durationSeconds = Math.max(
          1,
          Math.round(((Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000) * 10) / 10
        );
        const audioBlob = new Blob(recorderChunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        });

        recorderRef.current = null;
        recordingStartedAtRef.current = null;
        clearRecorderStream();

        if (!audioBlob.size) {
          setRecordingState('idle');
          setMessage('The recording did not capture any audio. Try another take.');
          return;
        }

        try {
          const dataUrl = await blobToDataUrl(audioBlob);
          setRecordedVoiceTake({
            dataUrl,
            durationSeconds,
            mimeType: recorder.mimeType || 'audio/webm'
          });
          setVoiceDuration(String(durationSeconds));
          setActiveUtilityPanel('voice');
          setRecordingState('idle');
          setMessage('Voice-over take captured. Add it to the playlist when you are ready.');
        } catch {
          setRecordingState('idle');
          setMessage('The take recorded, but the preview clip could not be prepared.');
        }
      };

      resetTakePreviewPlayback();
      setRecordedVoiceTake(null);
      setRecordingState('recording');
      recorder.start();
      setMessage('Recording take. Stop when it sounds right.');
    } catch {
      clearRecorderStream();
      recorderRef.current = null;
      setRecordingState('idle');
      setMessage('Could not access the microphone. Check browser permissions and try again.');
    }
  }

  function stopVoiceRecording() {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }

    setRecordingState('processing');
    recorderRef.current.stop();
  }

  function resetTakePreviewPlayback() {
    const audio = takePreviewAudioRef.current;
    if (!audio) {
      setIsTakePreviewPlaying(false);
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    setIsTakePreviewPlaying(false);
  }

  async function toggleTakePreviewPlayback() {
    const audio = takePreviewAudioRef.current;
    if (!audio || !recordedVoiceTake) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setMessage('Could not start take playback.');
      }
      return;
    }

    audio.pause();
  }

  function clearRecordedVoiceTake() {
    resetTakePreviewPlayback();
    setRecordedVoiceTake(null);
    setVoiceDuration('20');
    setMessage('Recorded take cleared.');
  }

  function addVoiceOver() {
    const trimmedTitle = voiceTitle.trim();
    const trimmedScript = voiceScript.trim();

    if (!trimmedTitle) {
      setMessage('Voice-over cues need a title.');
      return;
    }

    if (!trimmedScript && !recordedVoiceTake) {
      setMessage('Add a script, a recorded take, or both before saving the voice-over cue.');
      return;
    }

    const parsedDuration = Number(voiceDuration || 0) || undefined;
    const voiceCue: VoiceOverCue = {
      id: createClientId('voice'),
      title: trimmedTitle,
      script: trimmedScript,
      durationSeconds: recordedVoiceTake?.durationSeconds ?? parsedDuration,
      cueAfterMediaId: voiceCueAfterMediaId || undefined,
      overdubMediaId: voiceCueAfterMediaId || undefined,
      recordingDataUrl: recordedVoiceTake?.dataUrl,
      recordingMimeType: recordedVoiceTake?.mimeType
    };

    setVoiceOvers((current) => [...current, voiceCue]);
    setSequence((current) => [
      ...current,
      {
        id: createClientId('seq-voice'),
        kind: 'VOICE_OVER',
        refId: voiceCue.id,
        label: voiceCue.title
      }
    ]);
    setVoiceTitle('');
    setVoiceScript('');
    setVoiceDuration('20');
    setVoiceCueAfterMediaId('');
    resetTakePreviewPlayback();
    setRecordedVoiceTake(null);
    setActiveUtilityPanel('queue');
    setMessage(`${voiceCue.title} added to the show flow.`);
  }

  function moveSequenceItem(itemId: string, direction: -1 | 1) {
    setSequence((current) => {
      const currentIndex = current.findIndex((item) => item.id === itemId);
      const nextIndex = currentIndex + direction;
      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(currentIndex, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function removeSequenceItem(item: ShowSequenceItem) {
    const nextSequence = sequence.filter((entry) => entry.id !== item.id);
    setSequence(nextSequence);

    if (item.kind === 'MEDIA' && !nextSequence.some((entry) => entry.kind === 'MEDIA' && entry.refId === item.refId)) {
      setSelectedMedia((current) => current.filter((entry) => entry.mediaId !== item.refId));
    }

    if (item.kind === 'VOICE_OVER') {
      setVoiceOvers((current) => current.filter((entry) => entry.id !== item.refId));
    }
  }

  function buildLiveEventLegalNotes() {
    return [
      'Promoter-created live event draft.',
      selectedPromoter ? `Promoter: ${selectedPromoter.name}` : null,
      selectedHeadliner ? `Headliner: ${selectedHeadliner.name}` : null,
      selectedLiveVenue ? `Requested venue: ${formatVenueLabel(selectedLiveVenue)}` : null,
      'Venue owner approval is required before ticketing opens or fan payment tokens are charged.'
    ]
      .filter(Boolean)
      .join('\n');
  }

  async function handleLiveEventSubmit() {
    setMessage(null);
    setLastSavedShowHref(null);

    if (!title.trim()) {
      setMessage('Give the live event a title.');
      return;
    }

    if (!selectedPromoterProfileId) {
      setMessage('Choose which promoter profile is creating the live event draft.');
      return;
    }

    if (!headlinerProfileId) {
      setMessage('Choose an artist or act for the live event.');
      return;
    }

    if (!selectedVenueProfileId) {
      setMessage('Choose a venue for this live event draft.');
      return;
    }

    if (!liveStartsAt) {
      setMessage('Choose a start time for the live event.');
      return;
    }

    const startsAt = new Date(liveStartsAt);
    const endsAt = liveEndsAt ? new Date(liveEndsAt) : null;

    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      setMessage('Choose valid date and time values.');
      return;
    }

    if (endsAt && endsAt <= startsAt) {
      setMessage('End time must be after the start time.');
      return;
    }

    setPending(true);

    const response = await fetch('/api/shows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        status: 'DRAFT',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt ? endsAt.toISOString() : undefined,
        venueProfileId: selectedVenueProfileId,
        headlinerProfileId,
        promoterProfileId: selectedPromoterProfileId,
        isTicketed: false,
        bookingLegalNotes: buildLiveEventLegalNotes(),
        tags: [
          'live-event',
          'venue-approval-required',
          ...liveTags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        ]
      })
    });

    const data = await response.json();

    if (response.ok) {
      const nextShowHref = `/shows/${data.slug}`;

      if (setListTracks.length > 0 && data.id) {
        await fetch(`/api/shows/${data.id}/tracks/batch`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: setListTracks.map((t, i) => ({
              position: i,
              title: t.title,
              artistName: t.artistName,
              mediaHexId: t.mediaHexId
            }))
          })
        }).catch(() => null);
      }

      setTitle('');
      setDescription('');
      setLiveStartsAt('');
      setLiveEndsAt('');
      setLiveTags('live-event, venue-review');
      setSetListTracks([]);
      setLastSavedShowHref(nextShowHref);
      setMessage(`Live event draft saved. ${data.title} is ready for venue review before ticketing opens.`);
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not save the live event draft.');
    }

    setPending(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creatorMode === 'liveEvent') {
      await handleLiveEventSubmit();
      return;
    }

    setMessage(null);
    setLastSavedShowHref(null);

    if (!title.trim()) {
      setMessage('Give the show a title.');
      return;
    }

    if (!selectedPromoterProfileId) {
      setMessage('Choose which promoter profile is publishing the show.');
      return;
    }

    if (!selectedMedia.length) {
      setMessage('Add at least one uploaded artist media item to the playlist.');
      return;
    }

    if (!headlinerProfileId) {
      setMessage('Choose a headliner artist.');
      return;
    }

    const persistedSamplePads = padAssignments
      .filter((assignment) => !assignment.localOnly)
      .map(({ localOnly: _localOnly, ...assignment }) => assignment);

    const productionPlan: ShowProductionPlan = {
      mediaItems: selectedMedia,
      voiceOvers,
      samplePads: persistedSamplePads,
      sequence,
      advertising: {
        enabled: true,
        scope: advertisingScope,
        frequency: 3,
        clips: advertisingClips
      }
    };

    const startsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const nextStatus = saveIntent === 'publish' ? 'SCHEDULED' : 'DRAFT';

    setPending(true);

    const response = await fetch('/api/shows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        status: nextStatus,
        startsAt,
        headlinerProfileId,
        promoterProfileId: selectedPromoterProfileId,
        isTicketed: false,
        tags: [
          'prerecorded-show',
          'promoter-curated',
          'ad-supported',
          nextStatus === 'SCHEDULED' ? 'playback-ready' : 'preview-draft'
        ],
        productionPlan
      })
    });

    const data = await response.json();

    if (response.ok) {
      const nextShowHref = `/shows/${data.slug}`;

      if (setListTracks.length > 0 && data.id) {
        await fetch(`/api/shows/${data.id}/tracks/batch`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: setListTracks.map((t, i) => ({
              position: i,
              title: t.title,
              artistName: t.artistName,
              mediaHexId: t.mediaHexId
            }))
          })
        }).catch(() => null);
      }

      setTitle('');
      setDescription('');
      setHeadlinerProfileId(artists[0]?.profileId ?? '');
      setSelectedMedia([]);
      setVoiceOvers([]);
      setPadAssignments([]);
      setSequence([]);
      setDeckATrackId(null);
      setDeckBTrackId(null);
      setVoiceTitle('');
      setVoiceScript('');
      setVoiceDuration('20');
      setVoiceCueAfterMediaId('');
      setRecordedVoiceTake(null);
      setPreviewMediaItem(null);
      setActiveUtilityPanel('library');
      setSetListTracks([]);
      setLastSavedShowHref(nextShowHref);
      setPending(false);
      setMessage(
        nextStatus === 'SCHEDULED'
          ? `Published for playback. ${data.title} is now ready for fans.`
          : `Preview saved. ${data.title} is ready for promoter-only review.`
      );
      router.refresh();
      return;
    }

    setPending(false);
    setMessage(data.error ?? 'Could not create the show.');
  }

  const activePadAssignment = padMenu ? getPadAssignment(padMenu.slotNumber) : null;
  const selectedPreloadedSampleId =
    activePadAssignment && !activePadAssignment.localOnly ? activePadAssignment.sampleId : '';
  const selectedLocalSampleId =
    activePadAssignment && activePadAssignment.localOnly ? activePadAssignment.sampleId : '';
  const utilityTabs: Array<{
    id: CreatorUtilityPanel;
    label: string;
    count: number;
    hint: string;
  }> = [
    {
      id: 'library',
      label: 'Add media',
      count: playableArtists.length,
      hint: 'Grab artist songs or videos fast, then push them into the playlist.'
    },
    {
      id: 'voice',
      label: 'Voice',
      count: voiceOvers.length + recordedVoiceCount,
      hint: 'Capture a take, convert it into a cue, and keep the voice work in one place.'
    },
    {
      id: 'queue',
      label: 'Flow',
      count: cueSequence.length,
      hint: 'Check the transitions, ads, pads, and non-song flow before you save or publish.'
    },
    {
      id: 'setlist',
      label: 'Set List',
      count: setListTracks.length,
      hint: 'Build the public track order for your show. Search any artist on iHYPE and arrange the set.'
    }
  ];
  const activeUtilityTab = utilityTabs.find((tab) => tab.id === activeUtilityPanel) ?? utilityTabs[0];
  const headlinerEntryCount = selectedHeadliner?.entries.length ?? 0;
  const setupStatusItems = [
    {
      label: 'Promoter',
      value: selectedPromoter?.name ?? 'Pick one',
      ready: Boolean(selectedPromoterProfileId)
    },
    {
      label: 'Artist',
      value: selectedHeadliner?.name ?? 'Pick one',
      ready: Boolean(headlinerProfileId)
    },
    {
      label: 'Playlist',
      value: selectedMedia.length ? `${selectedMedia.length} loaded` : 'Add media',
      ready: selectedMedia.length > 0
    }
  ];
  const setupReady = Boolean(title.trim() && selectedPromoterProfileId && headlinerProfileId);
  const playlistReady = selectedMedia.length > 0;
  const flowReady = Boolean(cueSequence.length || voiceOvers.length || padAssignments.length);
  const voiceMinutes = voiceOvers.reduce((total, voiceCue) => total + (voiceCue.durationSeconds ?? 0), 0) / 60;
  const estimatedShowMinutes = Math.max(0, Math.round(selectedMedia.length * 4 + voiceMinutes));
  const workflowSteps = [
    {
      label: 'Setup',
      detail: setupReady ? 'Ready' : 'Title, promoter, artist',
      state: setupReady ? 'done' : 'active'
    },
    {
      label: 'Playlist',
      detail: playlistReady ? `${selectedMedia.length} loaded` : 'Add artist media',
      state: playlistReady ? 'done' : setupReady ? 'active' : 'upcoming'
    },
    {
      label: 'Record',
      detail: flowReady ? `${cueSequence.length} cues` : 'Voice, pads, flow',
      state: flowReady ? 'done' : playlistReady ? 'active' : 'upcoming'
    },
    {
      label: 'Playback',
      detail: lastSavedShowHref ? 'Saved' : 'Preview or publish',
      state: lastSavedShowHref ? 'done' : playlistReady ? 'active' : 'upcoming'
    }
  ];
  const mediaTimelineItems: TimelineLaneItem[] = selectedMedia.slice(0, 8).map((mediaItem) => ({
    id: mediaItem.mediaId,
    label: mediaItem.title,
    meta: mediaItem.artistName,
    kind: 'media'
  }));
  const voiceTimelineItems: TimelineLaneItem[] = voiceOvers.slice(0, 8).map((voiceCue) => ({
    id: voiceCue.id,
    label: voiceCue.title,
    meta: `${formatDurationLabel(voiceCue.durationSeconds)} ${voiceCue.recordingDataUrl ? 'take' : 'script'}`,
    kind: 'voice'
  }));
  const sampleTimelineItems: TimelineLaneItem[] = sequence
    .filter((sequenceItem) => sequenceItem.kind === 'SAMPLE')
    .slice(0, 8)
    .map((sequenceItem) => ({
      id: sequenceItem.id,
      label: sequenceItem.label,
      meta: 'Sampler cue',
      kind: 'sample'
    }));
  const adSequenceItems = sequence.filter((sequenceItem) => sequenceItem.kind === 'AD');
  const adTimelineItems: TimelineLaneItem[] = [
    ...adSequenceItems.slice(0, 8).map((sequenceItem) => ({
      id: sequenceItem.id,
      label: sequenceItem.label,
      meta: 'Ad cue',
      kind: 'ad' as const
    })),
    ...advertisingClips.slice(0, Math.max(0, 8 - adSequenceItems.length)).map((clip) => ({
      id: clip.clipId,
      label: clip.title,
      meta: `${clip.scope} ${formatDurationLabel(clip.durationSeconds)}`,
      kind: 'ad' as const
    }))
  ];

  function buildSuggestedShowTitle() {
    const artistName = selectedHeadliner?.name ?? 'Featured Artist';
    const promoterName = selectedPromoter?.name ?? 'Promoter';
    return `${artistName} x ${promoterName} Session`;
  }

  function autofillShowTitle() {
    setTitle(buildSuggestedShowTitle());
    setMessage('Suggested title added.');
  }

  function loadStarterPlaylist() {
    if (!selectedHeadliner) {
      setMessage('Pick a headliner first, then load a starter set.');
      return;
    }

    const starterEntries = selectedHeadliner.entries.slice(0, 3);
    if (!starterEntries.length) {
      setMessage('That artist does not have uploaded songs or videos yet.');
      return;
    }

    starterEntries.forEach((entry) => addMedia(selectedHeadliner, entry));
    setActiveUtilityPanel('library');
    setMessage(`Loaded ${starterEntries.length} ${starterEntries.length === 1 ? 'item' : 'items'} from ${selectedHeadliner.name}.`);
  }

  function renderTimelineLane(label: string, emptyLabel: string, items: TimelineLaneItem[]) {
    return (
      <div className="composer-timeline-lane">
        <div className="composer-timeline-label">{label}</div>
        <div className="composer-timeline-track">
          {items.length ? (
            items.map((item, index) => (
              <span
                className={`composer-timeline-clip ${item.kind}`}
                key={item.id}
                style={buildTimelineClipStyle(index, items.length)}
                title={`${item.label} - ${item.meta}`}
              >
                <strong>{item.label}</strong>
                <small>{item.meta}</small>
              </span>
            ))
          ) : (
            <span className="composer-timeline-empty">{emptyLabel}</span>
          )}
        </div>
      </div>
    );
  }

  function renderDeckCard(deck: 'A' | 'B', track: ShowMediaItem | null, level: number) {
    return (
      <div
        className={
          draggedMedia?.source === 'playlist'
            ? 'composer-card composer-deck-card composer-player-card is-dragging'
            : 'composer-card composer-deck-card composer-player-card'
        }
        onDragOver={handleDeckDragOver}
        onDrop={(event) => handleDeckDrop(event, deck)}
      >
        <div className={workstationHeaderClassName}>
          <div className={sectionBadgeClassName}>Deck {deck}</div>
          <div className="composer-deck-screen">
            <strong>{track?.title ?? `Deck ${deck}`}</strong>
            <span>{track ? track.artistName : 'Drop from playlist'}</span>
          </div>
        </div>
        <div className="composer-player-stage composer-player-stage-compact">
          <div className="composer-song-screen">
            <span className="composer-song-screen-label">Track</span>
            <strong>{track?.title ?? 'Standby'}</strong>
            <span>
              {track
                ? `${track.artistName}${isVideoMedia(track) ? ' | video' : ' | song'}`
                : 'Playlist drop zone'}
            </span>
            {track ? <div className="composer-media-code">{track.mediaId}</div> : null}
          </div>
          <div className="composer-jog-wheel">
            <span>{level}%</span>
          </div>
          <div className="composer-transport">
            <button className="button small secondary" onClick={() => playDeckTrack(deck, track)} type="button">
              {track && currentTrack?.url === track.url && isPlaying ? 'Pause' : 'Play'}
            </button>
            <button className="button small secondary" onClick={() => cueDeckTrack(deck, track)} type="button">
              Cue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="panel composer-panel composer-panel-streamlined">
      <div className={headerClassName}>
        <div className={headerCopyClassName}>
          <div className={sectionBadgeClassName}>Show Creation</div>
          <h2>Build a show fast</h2>
          <p className="meta">Choose Radio Show for prerecorded playback or Live Event for venue/date drafts.</p>
        </div>
        <div className={summaryStripClassName}>
          {creatorMode === 'radio' ? (
            <>
              <div className="stat">
                <strong>{selectedMedia.length}</strong>
                Media
              </div>
              <div className="stat">
                <strong>{cueSequence.length}</strong>
                Cues
              </div>
              <div className="stat">
                <strong>{recordedVoiceCount}</strong>
                Takes
              </div>
              <div className="stat">
                <strong>{advertisingClips.length}</strong>
                Ad clips
              </div>
            </>
          ) : (
            <>
              <div className="stat">
                <strong>{venues.length}</strong>
                Venues
              </div>
              <div className="stat">
                <strong>{artists.length}</strong>
                Acts
              </div>
              <div className="stat">
                <strong>DRAFT</strong>
                Event
              </div>
              <div className="stat">
                <strong>0</strong>
                Tickets
              </div>
            </>
          )}
        </div>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="composer-mode-grid" role="radiogroup" aria-label="Promoter show format">
          <button
            aria-pressed={creatorMode === 'radio'}
            className={creatorMode === 'radio' ? 'composer-mode-card active' : 'composer-mode-card'}
            onClick={() => {
              setCreatorMode('radio');
              setMessage(null);
            }}
            type="button"
          >
            <span className="composer-mode-icon">Radio</span>
            <strong>Radio Show</strong>
            <small>Prerecorded DJ/radio-style episode using artist media, voice takes, sampler pads, and playback publishing.</small>
          </button>
          <button
            aria-pressed={creatorMode === 'liveEvent'}
            className={creatorMode === 'liveEvent' ? 'composer-mode-card active' : 'composer-mode-card'}
            onClick={() => {
              setCreatorMode('liveEvent');
              setMessage(null);
            }}
            type="button"
          >
            <span className="composer-mode-icon live">Event</span>
            <strong>Live Event</strong>
            <small>Venue/date draft for a ticketed or free in-person show. Venue approval is required before ticketing opens.</small>
          </button>
        </div>

        {creatorMode === 'radio' ? (
          <>
        <div className="composer-stepper" aria-label="Show creator progress">
          {workflowSteps.map((step, index) => (
            <div className={`composer-stepper-item ${step.state}`} key={step.label}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="composer-quick-setup">
          <div className="composer-quick-setup-strip">
            {setupStatusItems.map((item) => (
              <div
                className={item.ready ? 'composer-quick-setup-card ready' : 'composer-quick-setup-card'}
                key={item.label}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="composer-quick-setup-actions">
            <button className="button small secondary" onClick={autofillShowTitle} type="button">
              Auto title
            </button>
            <button className="button small secondary" onClick={loadStarterPlaylist} type="button">
              Load first 3
            </button>
            <button className="button small secondary" onClick={() => setActiveUtilityPanel('library')} type="button">
              Open media
            </button>
            <button className="button small secondary" onClick={() => setActiveUtilityPanel('voice')} type="button">
              Record voice
            </button>
            <button className="button small secondary" onClick={() => setActiveUtilityPanel('queue')} type="button">
              Review flow
            </button>
          </div>
        </div>

        <div className="composer-action-bar">
          <div className="composer-action-bar-copy">
            <strong>{title.trim() || buildSuggestedShowTitle()}</strong>
            <span className="meta">
              {selectedHeadliner
                ? `${headlinerEntryCount} uploaded ${headlinerEntryCount === 1 ? 'item' : 'items'} ready from ${selectedHeadliner.name}.`
                : 'Choose a headliner to unlock quick media loading.'}
            </span>
          </div>
          <div className="cta-row composer-action-bar-buttons">
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => setSaveIntent('preview')}
              type="submit"
            >
              {pending && saveIntent === 'preview' ? 'Saving preview...' : 'Save preview draft'}
            </button>
            <button
              className="button"
              disabled={pending}
              onClick={() => setSaveIntent('publish')}
              type="submit"
            >
              {pending && saveIntent === 'publish' ? 'Publishing...' : 'Publish playback'}
            </button>
          </div>
        </div>

        <div className="grid grid-3 composer-setup-grid">
          <label className="field">
            <span>Show title</span>
            <input onChange={(event) => setTitle(event.target.value)} placeholder="Midnight Frequency Radio Hour" required value={title} />
          </label>
          <label className="field">
            <span>Promoter profile</span>
            <select onChange={(event) => setSelectedPromoterProfileId(event.target.value)} required value={selectedPromoterProfileId}>
              <option value="">Select a promoter profile</option>
              {promoters.map((promoter) => (
                <option key={promoter.profileId} value={promoter.profileId}>
                  {promoter.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Headliner artist</span>
            <select onChange={(event) => setHeadlinerProfileId(event.target.value)} required value={headlinerProfileId}>
              <option value="">Select an artist</option>
              {artists.map((artist) => (
                <option key={artist.profileId} value={artist.profileId}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Description</span>
          <textarea
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short show note."
            rows={2}
            value={description}
          />
        </label>

        <div className="composer-timeline-board" aria-label="Prerecorded show timeline">
          <div className="composer-timeline-head">
            <div>
              <span className={sectionBadgeClassName}>Timeline</span>
              <strong>{estimatedShowMinutes ? `${estimatedShowMinutes} min playback draft` : 'Playback draft'}</strong>
            </div>
            <p className="meta">
              The board maps the prerecorded show before fans hear it. Drag songs in the playlist, add voice cues, and place sampler moments.
            </p>
          </div>
          <div className="composer-timeline-lanes">
            {renderTimelineLane('Songs / video', 'Add artist media to start the show map.', mediaTimelineItems)}
            {renderTimelineLane('Voice', 'Record or script a voice cue from the Voice tab.', voiceTimelineItems)}
            {renderTimelineLane('Sampler', 'Assign a pad, then add it to the show flow.', sampleTimelineItems)}
            {renderTimelineLane('Ads', 'Approved ad clips appear here when real inventory is configured.', adTimelineItems)}
          </div>
        </div>

        <div className="composer-grid composer-workstation-grid">
          <div className="composer-column composer-deck-column composer-deck-a">
            {renderDeckCard('A', deckATrack, deckALevel)}
          </div>

          <div className="composer-column composer-control-column composer-deck-column composer-deck-b">
            {renderDeckCard('B', deckBTrack, deckBLevel)}
          </div>

          <div className="composer-column composer-playlist-column composer-mixer-column">
            <div className="composer-card composer-mixer-card composer-playlist-card">
              <div className={workstationHeaderClassName}>
                <div className={sectionBadgeClassName}>Playlist</div>
              </div>

              <div className="composer-recorder-strip">
                <div className="composer-recorder-status-block">
                  <span className={sectionBadgeClassName}>Master Recording</span>
                  <span className="voice-recorder-status">
                    {recordingState === 'recording'
                      ? 'Rec'
                      : recordingState === 'processing'
                        ? 'Prep'
                        : recordedVoiceTake
                          ? 'Ready'
                          : microphoneSupported
                            ? 'Idle'
                            : 'Off'}
                  </span>
                </div>
                {recordedVoiceTake ? (
                  <audio
                    className="composer-hidden-audio"
                    onEnded={() => setIsTakePreviewPlaying(false)}
                    onPause={() => setIsTakePreviewPlaying(false)}
                    onPlay={() => setIsTakePreviewPlaying(true)}
                    ref={takePreviewAudioRef}
                    src={recordedVoiceTake.dataUrl}
                  />
                ) : null}
                <div className="composer-media-actions composer-recorder-actions">
                  <button
                    className="button small secondary"
                    disabled={!microphoneSupported || recordingState !== 'idle'}
                    onClick={startVoiceRecording}
                    type="button"
                  >
                    Rec
                  </button>
                  <button
                    className="button small secondary"
                    disabled={recordingState !== 'recording'}
                    onClick={stopVoiceRecording}
                    type="button"
                  >
                    Stop
                  </button>
                  <button
                    className="button small secondary"
                    disabled={!recordedVoiceTake}
                    onClick={toggleTakePreviewPlayback}
                    type="button"
                  >
                    {isTakePreviewPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    className="button small secondary"
                    disabled={!recordedVoiceTake}
                    onClick={clearRecordedVoiceTake}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                {recordedVoiceTake ? <span className="meta">{recordedVoiceTake.durationSeconds}s take ready.</span> : null}
              </div>

              {previewMediaItem ? (
                <div className="composer-preview-monitor">
                  <div className="composer-preview-monitor-head">
                    <div className={sectionBadgeClassName}>Preview</div>
                    <span className="meta">
                      {previewMediaItem.mediaType === 'video' ? 'Video monitor' : 'Media monitor'}
                    </span>
                  </div>
                  {isVideoMedia(previewMediaItem) ? (
                    <video
                      className="composer-preview-video"
                      controls
                      poster={previewMediaItem.previewImageUrl ?? undefined}
                      src={previewMediaItem.url}
                    />
                  ) : (
                    <audio className="composer-audio-preview" controls src={previewMediaItem.url} />
                  )}
                </div>
              ) : null}

              <div className="composer-sampler-toolbar composer-sampler-toolbar-inline">
                <div className={sectionBadgeClassName}>Sampler</div>
                <label className="button small secondary composer-local-upload-button">
                  <input accept="audio/*" multiple onChange={handleCustomSampleUpload} type="file" />
                  Upload
                </label>
              </div>

              <div className="composer-sample-bank">
                {availableSampleClips.map((sample) => (
                  <button
                    className="composer-sample-chip"
                    draggable
                    key={sample.sampleId}
                    onDragEnd={clearSampleDragState}
                    onDragStart={() => handleSampleDragStart(sample)}
                    type="button"
                  >
                    {sample.title}
                  </button>
                ))}
              </div>

              <div className="composer-mpc-shell composer-mpc-shell-minimal composer-mpc-shell-inline">
                <div className="composer-pad-grid composer-pad-grid-mpc composer-pad-grid-mpc-inline">
                  {samplePadSlots.map((slotNumber) => {
                    const assignment = getPadAssignment(slotNumber);
                    const padColor = getPadColor(slotNumber, assignment);
                    const isCurrentTrack = assignment ? currentTrack?.url === assignment.url : false;
                    const isPadActive = activePadSlot === slotNumber || Boolean(assignment && isCurrentTrack && isPlaying);
                    const padClassName = [
                      'composer-pad-button',
                      assignment ? 'assigned' : '',
                      isPadActive ? 'active' : ''
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <button
                        aria-label={
                          assignment
                            ? `${buildPadLabel(slotNumber, assignment.title)}. Left click to trigger. Right click to reassign.`
                            : `Pad ${String(slotNumber).padStart(2, '0')}. Right click to assign a sample.`
                        }
                        className={padClassName}
                        key={slotNumber}
                        onClick={() => triggerPad(slotNumber)}
                        onContextMenu={(event) => handlePadContextMenu(event, slotNumber)}
                        onDragOver={handlePadDragOver}
                        onDrop={(event) => handlePadDrop(event, slotNumber)}
                        onKeyDown={(event) => handlePadKeyboardMenu(event, slotNumber)}
                        style={{ '--pad-color': padColor } as CSSProperties}
                        title={assignment?.title ?? `Pad ${String(slotNumber).padStart(2, '0')}`}
                        type="button"
                      />
                    );
                  })}
                </div>

                {padMenu ? (
                  <div
                    className="composer-pad-menu"
                    ref={padMenuRef}
                    style={{ left: padMenu.x, top: padMenu.y }}
                  >
                    <div className="composer-pad-menu-header">
                      <strong>Pad {String(padMenu.slotNumber).padStart(2, '0')}</strong>
                      <span>Assign sample</span>
                    </div>
                    <button
                      className="composer-pad-menu-item clear"
                      onClick={() => assignSampleToPad(padMenu.slotNumber, '')}
                      type="button"
                    >
                      Clear pad
                    </button>
                    {activePadAssignment && !activePadAssignment.localOnly ? (
                      <button
                        className="composer-pad-menu-item"
                        onClick={() => addAssignedPadToSequence(padMenu.slotNumber)}
                        type="button"
                      >
                        <span>Add pad to show</span>
                        <small>{activePadAssignment.title}</small>
                      </button>
                    ) : null}
                    <div className="composer-pad-color-grid">
                      {PAD_COLORS.map((colorHex) => (
                        <button
                          aria-label={`Set pad color ${colorHex}`}
                          className={
                            getPadColor(padMenu.slotNumber) === colorHex
                              ? 'composer-pad-color-swatch selected'
                              : 'composer-pad-color-swatch'
                          }
                          key={colorHex}
                          onClick={() => setPadColor(padMenu.slotNumber, colorHex)}
                          style={{ '--pad-color': colorHex } as CSSProperties}
                          type="button"
                        />
                      ))}
                    </div>
                    <div className="composer-pad-menu-select-grid">
                      <label className="composer-pad-menu-select">
                        <span>Preloaded</span>
                        <select
                          aria-label="Preloaded sample choices"
                          onChange={(event) => {
                            if (event.target.value) {
                              assignSampleToPad(padMenu.slotNumber, event.target.value);
                            }
                          }}
                          value={selectedPreloadedSampleId}
                        >
                          <option value="">Choose built-in effect</option>
                          {royaltyFreeSampleClips.map((sample) => (
                            <option key={sample.sampleId} value={sample.sampleId}>
                              {sample.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="composer-pad-menu-local">
                        <div className="composer-pad-menu-local-row">
                          <span>Local</span>
                          <label className="composer-pad-menu-upload">
                            <input accept="audio/*" multiple onChange={handleCustomSampleUpload} type="file" />
                            Upload
                          </label>
                        </div>
                        <select
                          aria-label="Local uploaded sample choices"
                          disabled={!customSampleClips.length}
                          onChange={(event) => {
                            if (event.target.value) {
                              assignSampleToPad(padMenu.slotNumber, event.target.value);
                            }
                          }}
                          value={selectedLocalSampleId}
                        >
                          <option value="">
                            {customSampleClips.length ? 'Choose local sound' : 'No local sounds loaded'}
                          </option>
                          {customSampleClips.map((sample) => (
                            <option key={sample.sampleId} value={sample.sampleId}>
                              {sample.title}
                            </option>
                          ))}
                        </select>
                        {!customSampleClips.length ? (
                          <small>Uploads stay in this browser only and clear on refresh.</small>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="composer-crossfader-shell composer-crossfader-shell-compact">
                <div className="composer-crossfader-row">
                  <div className="composer-crossfader-meter">
                    <span>A</span>
                    <strong>{deckALevel}%</strong>
                  </div>
                  <input
                    aria-label="Crossfader"
                    className="composer-crossfader"
                    max={100}
                    min={0}
                    onChange={(event) => setCrossfaderPosition(Number(event.target.value))}
                    step={1}
                    type="range"
                    value={crossfaderPosition}
                  />
                  <div className="composer-crossfader-meter">
                    <span>B</span>
                    <strong>{deckBLevel}%</strong>
                  </div>
                </div>
              </div>

              <div
                className={
                  draggedMedia
                    ? 'composer-playlist-dropzone composer-playlist-dropzone-compact is-dragging'
                    : 'composer-playlist-dropzone composer-playlist-dropzone-compact'
                }
                onDragOver={(event) => handlePlaylistDragOver(event, selectedMedia.length)}
                onDrop={(event) => handlePlaylistDrop(event, selectedMedia.length)}
              >
                {selectedMedia.length ? (
                  <>
                    <div
                      className={playlistDropIndex === 0 ? 'composer-playlist-slot active' : 'composer-playlist-slot'}
                      onDragOver={(event) => handlePlaylistDragOver(event, 0)}
                      onDrop={(event) => handlePlaylistDrop(event, 0)}
                    />
                    {selectedMedia.map((mediaItem, index) => {
                      const heroImage = artists.find((artist) => artist.profileId === mediaItem.artistProfileId)?.heroImage ?? null;
                      const isCurrentTrack = currentTrack?.url === mediaItem.url;
                      const isVideoItem = isVideoMedia(mediaItem);

                      return (
                        <div className="composer-playlist-stack" key={mediaItem.mediaId}>
                          <article
                            className="composer-playlist-item"
                            draggable
                            onDragEnd={clearPlaylistDragState}
                            onDragStart={() => handlePlaylistDragStart(mediaItem)}
                          >
                            <div className="composer-playlist-copy">
                              <span className="composer-sequence-index">{String(index + 1).padStart(2, '0')}</span>
                              <div>
                                <strong>{mediaItem.title}</strong>
                                <p className="meta">
                                  {mediaItem.artistName}
                                  {isVideoItem ? ' | video' : ' | song'}
                                </p>
                                <div className="composer-media-code">{mediaItem.mediaId}</div>
                              </div>
                            </div>
                            <div className="composer-media-actions">
                              <button
                                className="button small secondary"
                                onClick={() => loadDeck('A', mediaItem)}
                                type="button"
                              >
                                Deck A
                              </button>
                              <button
                                className="button small secondary"
                                onClick={() => loadDeck('B', mediaItem)}
                                type="button"
                              >
                                Deck B
                              </button>
                              <button
                                className="button small secondary"
                                onClick={() => {
                                  if (!isVideoItem && isCurrentTrack) {
                                    togglePlayback();
                                  } else {
                                    playPlaylistMedia(mediaItem, heroImage);
                                  }
                                }}
                                type="button"
                              >
                                {isVideoItem ? 'Preview' : isCurrentTrack && isPlaying ? 'Pause' : 'Play'}
                              </button>
                              <button
                                className="button small secondary"
                                onClick={() => removeMediaFromPlaylist(mediaItem.mediaId)}
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                          </article>
                          <div
                            className={playlistDropIndex === index + 1 ? 'composer-playlist-slot active' : 'composer-playlist-slot'}
                            onDragOver={(event) => handlePlaylistDragOver(event, index + 1)}
                            onDrop={(event) => handlePlaylistDrop(event, index + 1)}
                          />
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div
                    className="composer-playlist-empty"
                    onDragOver={(event) => handlePlaylistDragOver(event, 0)}
                    onDrop={(event) => handlePlaylistDrop(event, 0)}
                  >
                    Drop songs here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="composer-utility-shell">
          <div className="composer-tool-nav" role="tablist" aria-label="Show creator tools">
            {utilityTabs.map((tab) => (
              <button
                aria-selected={activeUtilityPanel === tab.id}
                className={activeUtilityPanel === tab.id ? 'composer-tool-tab active' : 'composer-tool-tab'}
                key={tab.id}
                onClick={() => setActiveUtilityPanel(tab.id)}
                role="tab"
                type="button"
              >
                <span>{tab.label}</span>
                <strong>{tab.count}</strong>
              </button>
            ))}
          </div>
          <p className="meta composer-tool-hint">{activeUtilityTab.hint}</p>

          {activeUtilityPanel === 'library' ? (
            <div className="composer-card composer-utility-card">
              <div className={workstationHeaderClassName}>
                <div className={sectionBadgeClassName}>Add Media</div>
                <span className="meta">{playableArtists.length} artists</span>
              </div>
              <div className="composer-utility-scroll composer-library-list">
                {playableArtists.length ? (
                  playableArtists.map((artist) => (
                    <div className="composer-library-group" key={artist.profileId}>
                      <div className="composer-library-heading">
                        <strong>{artist.name}</strong>
                        <span className="meta">{artist.entries.length}</span>
                      </div>
                      {artist.entries.map((entry) => {
                        const isCurrentTrack = currentTrack?.url === entry.url;
                        const isVideoEntry = entry.mediaType === 'video';
                        return (
                          <article
                            className="composer-media-card composer-media-card-draggable"
                            draggable
                            key={entry.hexId}
                            onDragEnd={clearPlaylistDragState}
                            onDragStart={() =>
                              handleLibraryDragStart({
                                mediaId: entry.hexId,
                                title: entry.title,
                                url: entry.url,
                                artistProfileId: artist.profileId,
                                artistName: artist.name,
                                notes: entry.notes,
                                mimeType: entry.mimeType,
                                mediaType: entry.mediaType ?? (isVideoEntry ? 'video' : 'audio'),
                                previewImageUrl: entry.previewImageUrl ?? artist.heroImage
                              })
                            }
                          >
                            <div>
                              <div className="composer-media-code">{entry.hexId}</div>
                              <strong>{entry.title}</strong>
                              <p className="meta">{isVideoEntry ? 'Video' : 'Song'}</p>
                              {entry.notes ? <p className="meta">{entry.notes}</p> : null}
                            </div>
                            <div className="composer-media-actions">
                              <button
                                className="button small secondary"
                                onClick={() => copyToClipboard(entry.hexId, 'Media ID')}
                                type="button"
                              >
                                Copy
                              </button>
                              <button
                                className="button small secondary"
                                onClick={() => {
                                  if (!isVideoEntry && isCurrentTrack) {
                                    togglePlayback();
                                  } else {
                                    if (isVideoEntry) {
                                      setPreviewMediaItem({
                                        mediaId: entry.hexId,
                                        title: entry.title,
                                        url: entry.url,
                                        artistProfileId: artist.profileId,
                                        artistName: artist.name,
                                        notes: entry.notes,
                                        mimeType: entry.mimeType,
                                        mediaType: 'video',
                                        previewImageUrl: entry.previewImageUrl ?? artist.heroImage
                                      });
                                    } else {
                                      playTrack(
                                        {
                                          id: `${artist.slug}-${entry.hexId}`,
                                          title: entry.title,
                                          artistName: artist.name,
                                          url: entry.url,
                                          mediaId: entry.hexId,
                                          artistProfileSlug: artist.slug,
                                          notes: entry.notes,
                                          artworkUrl: artist.heroImage
                                        },
                                        artist.entries
                                          .filter((item) => item.mediaType !== 'video')
                                          .map((item) => ({
                                            id: `${artist.slug}-${item.hexId}`,
                                            title: item.title,
                                            artistName: artist.name,
                                            url: item.url,
                                            mediaId: item.hexId,
                                            artistProfileSlug: artist.slug,
                                            notes: item.notes,
                                            artworkUrl: artist.heroImage
                                          }))
                                      );
                                    }
                                  }
                                }}
                                type="button"
                              >
                                {isVideoEntry ? 'Preview' : isCurrentTrack && isPlaying ? 'Pause' : 'Preview'}
                              </button>
                              <button className="button small" onClick={() => addMedia(artist, entry)} type="button">
                                Add
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div className="empty">No uploads yet.</div>
                )}
              </div>
            </div>
          ) : null}

          {activeUtilityPanel === 'voice' ? (
            <div className="composer-card composer-utility-card">
              <div className={workstationHeaderClassName}>
                <div className={sectionBadgeClassName}>Voice</div>
                <span className="meta">
                  {voiceOvers.length} cues | {recordedVoiceCount} takes
                </span>
              </div>
              <div className="composer-voice-drawer-body composer-voice-panel-body">
                <div className="grid grid-2">
                  <label className="field">
                    <span>Title</span>
                    <input onChange={(event) => setVoiceTitle(event.target.value)} placeholder="Intro" value={voiceTitle} />
                  </label>
                  <label className="field">
                    <span>Sec</span>
                    <input min="0" onChange={(event) => setVoiceDuration(event.target.value)} step="0.1" type="number" value={voiceDuration} />
                  </label>
                </div>
                <label className="field">
                  <span>Notes</span>
                  <textarea
                    onChange={(event) => setVoiceScript(event.target.value)}
                    placeholder="Read or note"
                    rows={3}
                    value={voiceScript}
                  />
                </label>
                <label className="field">
                  <span>Overdub on</span>
                  <select onChange={(event) => setVoiceCueAfterMediaId(event.target.value)} value={voiceCueAfterMediaId}>
                    <option value="">No cue</option>
                    {selectedMedia.map((mediaItem) => (
                      <option key={mediaItem.mediaId} value={mediaItem.mediaId}>
                        {mediaItem.mediaId} - {mediaItem.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="composer-voice-actions">
                  <span className="meta">
                    {recordedVoiceTake ? `${recordedVoiceTake.durationSeconds}s take queued from master recorder.` : 'Use the master recorder above for mic takes.'}
                  </span>
                  <button className="button small" onClick={addVoiceOver} type="button">
                    Add cue
                  </button>
                </div>

                <div className="composer-utility-scroll composer-voice-list">
                  {voiceOvers.length ? (
                    voiceOvers.map((voiceCue) => (
                      <div className="composer-voice-card" key={voiceCue.id}>
                        <div>
                          <strong>{voiceCue.title}</strong>
                          <p className="meta">
                            {voiceCue.durationSeconds ? `${voiceCue.durationSeconds}s` : 'Open'}
                            {voiceCue.cueAfterMediaId ? ` | ${voiceCue.cueAfterMediaId}` : ''}
                          </p>
                          {voiceCue.script ? <p>{voiceCue.script}</p> : null}
                          {voiceCue.recordingDataUrl ? <audio className="composer-audio-preview" controls src={voiceCue.recordingDataUrl} /> : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty">No voice cues.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeUtilityPanel === 'queue' ? (
            <div className="composer-card composer-utility-card">
              <div className={workstationHeaderClassName}>
                <div className={sectionBadgeClassName}>Flow</div>
                <span className="meta">{cueSequence.length} items</span>
              </div>
              <div className="composer-utility-scroll composer-cue-lane">
                {cueSequence.length ? (
                  <div className="composer-sequence-list">
                    {cueSequence.map((item, index) => (
                      <div className="composer-sequence-card" key={item.id}>
                        <div>
                          <span className="composer-sequence-index">{String(index + 1).padStart(2, '0')}</span>
                          <strong>{buildSequenceLabel(item.kind, item.label)}</strong>
                        </div>
                        <div className="composer-media-actions">
                          <button
                            className="button small secondary"
                            disabled={index === 0}
                            onClick={() => moveSequenceItem(item.id, -1)}
                            type="button"
                          >
                            Up
                          </button>
                          <button
                            className="button small secondary"
                            disabled={index === cueSequence.length - 1}
                            onClick={() => moveSequenceItem(item.id, 1)}
                            type="button"
                          >
                            Down
                          </button>
                          <button className="button small secondary" onClick={() => removeSequenceItem(item)} type="button">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">No cues yet.</div>
                )}
                {selectedHeadliner ? (
                  <div className="empty composer-session-note">
                    <strong>{selectedHeadliner.name}</strong> on <strong>{selectedPromoter?.name ?? 'your promoter profile'}</strong>.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeUtilityPanel === 'setlist' ? (
            <div className="composer-card composer-utility-card">
              <div className={workstationHeaderClassName}>
                <div className={sectionBadgeClassName}>Set List</div>
                <span className="meta">{setListTracks.length} track{setListTracks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="composer-utility-scroll">
                <p className="meta" style={{ marginBottom: '0.75rem' }}>
                  Search any artist on iHYPE and add their tracks in order. This becomes the public tracklist displayed on your show page.
                </p>
                <SetListBuilder onChange={setSetListTracks} value={setListTracks} />
              </div>
            </div>
          ) : null}
        </div>
          </>
        ) : (
          <div className="composer-live-event-panel">
            <div className="composer-live-event-head">
              <div>
                <div className={sectionBadgeClassName}>Live Event</div>
                <h3>Draft a venue show</h3>
              </div>
              <p className="meta">
                This saves a promoter-created live event draft. The venue still has to approve the event and open ticketing before fans can be charged.
              </p>
            </div>

            <div className="composer-live-event-notice">
              <strong>Radio shows and live events are separate.</strong>
              <span>
                Use Radio Show for prerecorded playback. Use Live Event when the idea needs a room, date, artist, and venue review.
              </span>
            </div>

            <div className="grid grid-3 composer-setup-grid">
              <label className="field">
                <span>Event title</span>
                <input
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Friday Signal Room"
                  required
                  value={title}
                />
              </label>
              <label className="field">
                <span>Promoter profile</span>
                <select onChange={(event) => setSelectedPromoterProfileId(event.target.value)} required value={selectedPromoterProfileId}>
                  <option value="">Select a promoter profile</option>
                  {promoters.map((promoter) => (
                    <option key={promoter.profileId} value={promoter.profileId}>
                      {promoter.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Artist or act</span>
                <select onChange={(event) => setHeadlinerProfileId(event.target.value)} required value={headlinerProfileId}>
                  <option value="">Select an artist</option>
                  {artists.map((artist) => (
                    <option key={artist.profileId} value={artist.profileId}>
                      {artist.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-3 composer-setup-grid">
              <label className="field">
                <span>Venue</span>
                <select
                  disabled={!venues.length}
                  onChange={(event) => setSelectedVenueProfileId(event.target.value)}
                  required
                  value={selectedVenueProfileId}
                >
                  <option value="">{venues.length ? 'Select a venue' : 'No venues available'}</option>
                  {venues.map((venue) => (
                    <option key={venue.profileId} value={venue.profileId}>
                      {formatVenueLabel(venue)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Start time</span>
                <input onChange={(event) => setLiveStartsAt(event.target.value)} required type="datetime-local" value={liveStartsAt} />
              </label>
              <label className="field">
                <span>End time</span>
                <input onChange={(event) => setLiveEndsAt(event.target.value)} type="datetime-local" value={liveEndsAt} />
              </label>
            </div>

            <label className="field">
              <span>Description</span>
              <textarea
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the room, lineup idea, audience fit, and what the venue needs to know."
                rows={4}
                value={description}
              />
            </label>

            <label className="field">
              <span>Tags</span>
              <input onChange={(event) => setLiveTags(event.target.value)} placeholder="live-event, venue-review" value={liveTags} />
            </label>

            <div className="composer-live-event-summary">
              <div>
                <span>Format</span>
                <strong>Live Event</strong>
              </div>
              <div>
                <span>Venue</span>
                <strong>{selectedLiveVenue ? selectedLiveVenue.name : 'Choose venue'}</strong>
              </div>
              <div>
                <span>Ticketing</span>
                <strong>Venue approval first</strong>
              </div>
            </div>

            <div className="composer-action-bar">
              <div className="composer-action-bar-copy">
                <strong>{title.trim() || 'Untitled live event draft'}</strong>
                <span className="meta">
                  {selectedLiveVenue
                    ? `${selectedLiveVenue.name} will be attached as a requested venue.`
                    : 'Choose a venue to attach this live event draft.'}
                </span>
              </div>
              <div className="cta-row composer-action-bar-buttons">
                <button className="button" disabled={pending || !venues.length} type="submit">
                  {pending ? 'Saving event draft...' : 'Save live event draft'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="cta-row composer-footer-bar">
          {lastSavedShowHref ? (
            <a className="button small secondary" href={lastSavedShowHref}>
              Open saved show
            </a>
          ) : null}
          {message ? <span className="meta">{message}</span> : null}
        </div>
      </form>
    </section>
  );
}
