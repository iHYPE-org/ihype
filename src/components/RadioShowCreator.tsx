'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, postJson } from '@/lib/api-client';
import { MUSIC_GENRES } from '@/lib/genres';
import {
  royaltyFreeSampleClips,
  buildAutoAdBreak,
  type ShowMediaItem,
  type VoiceOverCue,
  type ShowSamplePad,
  type ShowSequenceItem,
  type ShowAdClip,
  type AdvertisingScope,
  type ShowProductionPlan,
} from '@/lib/show-composer';

type CrateTrack = { hexId: string; title: string; artistName: string; durationSecs: number };
type DjProfile = { id: string; name: string; slug: string };

// A free-use track from ANY profile on the platform (GET /api/artist-media/free-use),
// as opposed to CrateTrack which is only the signed-in DJ's own uploads.
type LibraryTrack = {
  hexId: string;
  title: string;
  notes: string | null;
  mimeType: string | null;
  durationSecs: number | null;
  streamUrl: string;
  artist: { profileId: string; name: string; slug: string; avatarImage: string | null; genres: string[]; location: string };
};

type Block =
  | { uid: string; kind: 'MEDIA'; label: string; sub: string; dur: number; color: string; mediaItem: ShowMediaItem }
  | { uid: string; kind: 'VOICE_OVER'; label: string; sub: string; dur: number; color: string; voiceOver: VoiceOverCue }
  | { uid: string; kind: 'SAMPLE'; label: string; sub: string; dur: number; color: string; samplePad: ShowSamplePad }
  | { uid: string; kind: 'AD'; label: string; sub: string; dur: number; color: string; adClips: ShowAdClip[] };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

let UID = 100;
const uid = () => `b${++UID}`;

const TYPE_META: Record<Block['kind'], { label: string; color: string }> = {
  MEDIA: { label: 'Track', color: '#ff3e9a' },
  VOICE_OVER: { label: 'Voiceover', color: '#b983ff' },
  SAMPLE: { label: 'Sample', color: '#22e5d4' },
  AD: { label: 'Ad break', color: '#ff5029' },
};

const GENRES = MUSIC_GENRES;
const SCOPES: AdvertisingScope[] = ['local', 'regional', 'national', 'global'];

type DjAdPlan = {
  scope: AdvertisingScope;
  breaksPerHour: number;
  breakDurationSecs: number;
  targetAdLoadPct: number;
  advertiserTypes: string[];
  rationale: string;
  aiGenerated: boolean;
};

type DragPayload = { kind: 'crate'; track: CrateTrack } | { kind: 'block'; index: number };
type RecorderState =
  | { phase: 'idle' }
  | { phase: 'recording' }
  | { phase: 'processing' }
  | { phase: 'done'; url: string; durationSecs: number };

function PreviewIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12"><rect height="16" width="4" x="6" y="4" /><rect height="16" width="4" x="14" y="4" /></svg>
  ) : (
    <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12"><path d="M7 4v16l13-8z" /></svg>
  );
}

export function RadioShowCreator({ initialCrate, profile }: { initialCrate: CrateTrack[]; profile: DjProfile }) {
  const router = useRouter();
  const [title, setTitle] = useState('Untitled show');
  const [genre, setGenre] = useState(GENRES[0]);
  const [scope, setScope] = useState<AdvertisingScope>('regional');
  const [when, setWhen] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showId, setShowId] = useState<string | null>(null);
  const [showSlug, setShowSlug] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState<'draft' | 'schedule' | 'live' | null>(null);
  const [recorder, setRecorder] = useState<RecorderState>({ phase: 'idle' });
  const [samplePicker, setSamplePicker] = useState(false);
  const [libraryPicker, setLibraryPicker] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const librarySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryRequestId = useRef(0);
  const [adPreviewClips, setAdPreviewClips] = useState<ShowAdClip[] | null>(null);
  const [adPreviewIsMarketplace, setAdPreviewIsMarketplace] = useState(false);
  const [adPlan, setAdPlan] = useState<DjAdPlan | null>(null);
  const scopeTouchedRef = useRef(false);

  // AI advertising recommendation for this DJ — pre-sets the ad scope and
  // sizes ad breaks; the DJ can always override.
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ plan?: DjAdPlan }>('/api/radio/ad-plan')
      .then((data) => {
        if (cancelled || !data?.plan) return;
        setAdPlan(data.plan);
        if (!scopeTouchedRef.current) setScope(data.plan.scope);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const dragRef = useRef<DragPayload | null>(null);
  const timelineBodyRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const padCounterRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }

  const { starts, total, adTime, adBreaks } = useMemo(() => {
    let acc = 0;
    let ad = 0;
    let breaks = 0;
    const st = blocks.map((b) => {
      const s = acc;
      acc += b.dur;
      if (b.kind === 'AD') {
        ad += b.dur;
        breaks += 1;
      }
      return s;
    });
    return { starts: st, total: acc, adTime: ad, adBreaks: breaks };
  }, [blocks]);

  const adLoad = total ? Math.round((adTime / total) * 100) : 0;

  function crateTrackToMediaItem(t: CrateTrack): ShowMediaItem {
    return {
      mediaId: t.hexId,
      title: t.title,
      url: `/api/media/${t.hexId}`,
      artistProfileId: profile.id,
      artistName: t.artistName,
      mediaType: 'audio',
      durationSeconds: t.durationSecs,
    };
  }

  function addTrack(t: CrateTrack) {
    setBlocks((b) => [
      ...b,
      { uid: uid(), kind: 'MEDIA', label: t.title, sub: t.artistName, dur: t.durationSecs, color: TYPE_META.MEDIA.color, mediaItem: crateTrackToMediaItem(t) },
    ]);
    showToast(`Added “${t.title}” to the show`);
  }

  function libraryTrackToMediaItem(t: LibraryTrack): ShowMediaItem {
    return {
      mediaId: t.hexId,
      title: t.title,
      url: t.streamUrl,
      artistProfileId: t.artist.profileId,
      artistName: t.artist.name,
      notes: t.notes,
      mimeType: t.mimeType,
      mediaType: 'audio',
      durationSeconds: t.durationSecs ?? 180,
    };
  }

  function addLibraryTrack(t: LibraryTrack) {
    setBlocks((b) => [
      ...b,
      {
        uid: uid(),
        kind: 'MEDIA',
        label: t.title,
        sub: t.artist.name,
        dur: t.durationSecs ?? 180,
        color: TYPE_META.MEDIA.color,
        mediaItem: libraryTrackToMediaItem(t),
      },
    ]);
    showToast(`Added “${t.title}” by ${t.artist.name} to the show`);
  }

  // Platform-wide free-use library search (GET /api/artist-media/free-use) —
  // debounced so typing doesn't fire a request per keystroke. Runs once with
  // an empty query the moment the picker opens, to show recent tracks first.
  function runLibrarySearch(q: string) {
    const requestId = ++libraryRequestId.current;
    setLibraryLoading(true);
    setLibraryError('');
    apiFetch<{ tracks?: LibraryTrack[] }>(`/api/artist-media/free-use?q=${encodeURIComponent(q)}`)
      .then((data) => {
        if (requestId !== libraryRequestId.current) return;
        setLibraryTracks(data?.tracks ?? []);
      })
      .catch(() => {
        if (requestId !== libraryRequestId.current) return;
        setLibraryError('Could not load the free-use library. Try again.');
      })
      .finally(() => {
        if (requestId !== libraryRequestId.current) return;
        setLibraryLoading(false);
      });
  }

  function openLibraryPicker() {
    setLibraryPicker(true);
    runLibrarySearch(libraryQuery);
  }

  function closeLibraryPicker() {
    setLibraryPicker(false);
    stopPreview();
  }

  function onLibraryQueryChange(value: string) {
    setLibraryQuery(value);
    if (librarySearchTimer.current) clearTimeout(librarySearchTimer.current);
    librarySearchTimer.current = setTimeout(() => runLibrarySearch(value), 320);
  }

  // Preview: a single shared <audio> element auditions whichever sample or
  // ad clip the DJ taps play on — in the sample picker and the ad-break
  // preview modal — before it commits to the show.
  function togglePreview(previewId: string, url: string) {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (previewingId === previewId) {
      audio.pause();
      setPreviewingId(null);
      return;
    }
    audio.src = url;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    setPreviewingId(previewId);
  }
  function stopPreview() {
    previewAudioRef.current?.pause();
    setPreviewingId(null);
  }

  function closeSamplePicker() {
    setSamplePicker(false);
    stopPreview();
  }

  function addSample(sample: ShowSamplePad) {
    padCounterRef.current = (padCounterRef.current % 16) + 1;
    const instance: ShowSamplePad = { ...sample, assignedPad: padCounterRef.current };
    setBlocks((b) => [
      ...b,
      { uid: uid(), kind: 'SAMPLE', label: sample.title, sub: 'Free-use · cleared', dur: 6, color: TYPE_META.SAMPLE.color, samplePad: instance },
    ]);
    closeSamplePicker();
    showToast(`Added “${sample.title}” sample`);
  }

  async function openAdPreview() {
    // GET /api/radio/ad-clips already prefers real, purchased marketplace
    // ads (Coverage Builder campaigns) and only falls back to the
    // placeholder catalog server-side when none exist for this scope —
    // `isMarketplace` tells us which one came back so the modal copy stays
    // honest either way.
    try {
      const data = await apiFetch<{ clips?: ShowAdClip[]; isMarketplace?: boolean }>(`/api/radio/ad-clips?scope=${scope}`);
      if (data?.clips?.length) {
        setAdPreviewIsMarketplace(Boolean(data.isMarketplace));
        setAdPreviewClips(data.clips);
        return;
      }
    } catch {
      // Fall through to the client-side placeholder catalog below —
      // only reached if the request itself fails (e.g. offline).
    }

    const clips = buildAutoAdBreak(scope, adPlan?.breakDurationSecs ?? 90);
    if (!clips.length) {
      showToast('No ad clips available for this scope yet');
      return;
    }
    setAdPreviewIsMarketplace(false);
    setAdPreviewClips(clips);
  }
  function closeAdPreview() {
    setAdPreviewClips(null);
    setAdPreviewIsMarketplace(false);
    stopPreview();
  }
  function confirmAdBreak() {
    const clips = adPreviewClips;
    if (!clips?.length) return;
    const dur = clips.reduce((s, c) => s + (c.durationSeconds ?? 0), 0);
    setBlocks((b) => [
      ...b,
      { uid: uid(), kind: 'AD', label: `Ad break · ${scope}`, sub: `${clips.length} spot${clips.length > 1 ? 's' : ''}`, dur, color: TYPE_META.AD.color, adClips: clips },
    ]);
    showToast(`Added a ${fmt(dur)} ad break to the timeline`);
    closeAdPreview();
  }

  function removeBlock(u: string) {
    setBlocks((b) => b.filter((x) => x.uid !== u));
  }

  // Pointer Events (not the HTML5 drag-and-drop API) drive both the
  // crate→timeline insert and the in-timeline reorder. The native
  // draggable/dragstart/dragover/drop events this used to run on never fire
  // from touch input on iOS or Android — only from a mouse — so on a phone
  // the whole feature silently did nothing. Pointer Events unify
  // mouse/touch/pen behind one API and support setPointerCapture, so the
  // grip that starts the gesture keeps receiving move/up events for its
  // duration no matter where the finger travels on screen.
  function computeOverIndexAt(clientY: number): number | null {
    const container = timelineBodyRef.current;
    if (!container) return null;
    const items = [...container.querySelectorAll('[data-block]')] as HTMLElement[];
    let idx = items.length;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        idx = i;
        break;
      }
    }
    return idx;
  }
  function isPointOverTimeline(x: number, y: number): boolean {
    const el = timelineBodyRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function beginDrag(payload: DragPayload, e: ReactPointerEvent<HTMLElement>) {
    dragRef.current = payload;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onCratePointerDown(t: CrateTrack, e: ReactPointerEvent<HTMLElement>) {
    beginDrag({ kind: 'crate', track: t }, e);
  }
  function onBlockPointerDown(i: number, e: ReactPointerEvent<HTMLElement>) {
    beginDrag({ kind: 'block', index: i }, e);
  }
  function onDragPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (!dragRef.current) return;
    e.preventDefault();
    const over = isPointOverTimeline(e.clientX, e.clientY);
    setOverIndex(over ? computeOverIndexAt(e.clientY) : null);
  }
  function onDragPointerUp(e: ReactPointerEvent<HTMLElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    setOverIndex(null);
    if (!d) return;
    const over = isPointOverTimeline(e.clientX, e.clientY);
    if (!over) return; // released outside the timeline — cancel, nothing moves
    const idx = computeOverIndexAt(e.clientY) ?? blocks.length;

    if (d.kind === 'crate') {
      const t = d.track;
      setBlocks((b) => {
        const nb = [...b];
        nb.splice(idx, 0, { uid: uid(), kind: 'MEDIA', label: t.title, sub: t.artistName, dur: t.durationSecs, color: TYPE_META.MEDIA.color, mediaItem: crateTrackToMediaItem(t) });
        return nb;
      });
      showToast(`Placed “${t.title}” in the timeline`);
    } else {
      setBlocks((b) => {
        const nb = [...b];
        const [moved] = nb.splice(d.index, 1);
        let target = idx;
        if (d.index < idx) target -= 1;
        nb.splice(target, 0, moved);
        return nb;
      });
    }
  }
  function onDragPointerCancel() {
    dragRef.current = null;
    setOverIndex(null);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void processRecording();
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecorder({ phase: 'recording' });
    } catch {
      showToast('Microphone access denied or unavailable');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecorder({ phase: 'processing' });
  }

  async function processRecording() {
    const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const durationSecs = await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.src = dataUrl;
      audio.addEventListener('loadedmetadata', () => resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0));
      audio.addEventListener('error', () => resolve(0));
    });
    setRecorder({ phase: 'done', url: dataUrl, durationSecs });
  }

  function discardRecording() {
    setRecorder({ phase: 'idle' });
  }

  function placeVoiceover() {
    if (recorder.phase !== 'done') return;
    const voiceOver: VoiceOverCue = {
      id: uid(),
      title: 'Voiceover segment',
      script: '',
      durationSeconds: recorder.durationSecs,
      recordingDataUrl: recorder.url,
      recordingMimeType: 'audio/webm',
    };
    setBlocks((b) => [
      ...b,
      { uid: uid(), kind: 'VOICE_OVER', label: 'Voiceover segment', sub: `Your voice · ${fmt(recorder.durationSecs)}`, dur: recorder.durationSecs, color: TYPE_META.VOICE_OVER.color, voiceOver },
    ]);
    setRecorder({ phase: 'idle' });
    showToast('Voiceover added to the show');
  }

  function buildProductionPlan(): ShowProductionPlan {
    const mediaItems: ShowMediaItem[] = [];
    const voiceOvers: VoiceOverCue[] = [];
    const samplePads: ShowSamplePad[] = [];
    const adClipsUsed = new Map<string, ShowAdClip>();
    const sequence: ShowSequenceItem[] = [];

    for (const b of blocks) {
      if (b.kind === 'MEDIA') {
        mediaItems.push(b.mediaItem);
        sequence.push({ id: b.uid, kind: 'MEDIA', refId: b.mediaItem.mediaId, label: b.label });
      } else if (b.kind === 'VOICE_OVER') {
        voiceOvers.push(b.voiceOver);
        sequence.push({ id: b.uid, kind: 'VOICE_OVER', refId: b.voiceOver.id, label: b.label });
      } else if (b.kind === 'SAMPLE') {
        samplePads.push(b.samplePad);
        sequence.push({ id: b.uid, kind: 'SAMPLE', refId: `pad-${b.samplePad.assignedPad}`, label: b.label });
      } else {
        b.adClips.forEach((clip, index) => {
          adClipsUsed.set(clip.clipId, clip);
          sequence.push({ id: `${b.uid}-${index}`, kind: 'AD', refId: clip.clipId, label: b.label });
        });
      }
    }

    return {
      mediaItems,
      voiceOvers,
      samplePads,
      sequence,
      advertising: { enabled: true, scope, frequency: 3, clips: Array.from(adClipsUsed.values()) },
    };
  }

  async function persist(status: 'DRAFT' | 'SCHEDULED'): Promise<{ id: string; slug: string }> {
    const productionPlan = buildProductionPlan();
    const startsAt = when ? new Date(when).toISOString() : new Date().toISOString();

    if (!showId) {
      const show = await postJson<{ id: string; slug: string }>('/api/shows', {
        title,
        description: `${genre} radio show`,
        isRadioShow: true,
        promoterProfileId: profile.id,
        status,
        startsAt,
        productionPlan,
        tags: [genre.toLowerCase().replace(/\s+/g, '-')],
      });
      setShowId(show.id);
      setShowSlug(show.slug);
      return show;
    }

    await apiFetch(`/api/shows/${showId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, productionPlan, startsAt, status }),
    });
    return { id: showId, slug: showSlug! };
  }

  async function saveDraft() {
    if (!blocks.length) {
      showToast('Add at least one block first');
      return;
    }
    setSaving('draft');
    try {
      await persist('DRAFT');
      showToast('Draft saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save draft');
    } finally {
      setSaving(null);
    }
  }

  async function schedule() {
    if (!blocks.length) {
      showToast('Add at least one block first');
      return;
    }
    if (!when) {
      showToast('Choose a go-live date/time first');
      return;
    }
    setSaving('schedule');
    try {
      await persist('SCHEDULED');
      showToast('Show scheduled — listeners will be notified');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not schedule show');
    } finally {
      setSaving(null);
    }
  }

  async function goLive() {
    if (!blocks.length) {
      showToast('Add at least one block first');
      return;
    }
    setSaving('live');
    try {
      const show = await persist('SCHEDULED');
      await apiFetch(`/api/shows/${show.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'LIVE' }),
      });
      showToast('You are live — audio only, no video');
      router.push(`/shows/${show.slug}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not go live');
      setSaving(null);
    }
  }

  return (
    <div className="rsc-root">
      <div className="rsc-head">
        <div className="rsc-eyebrow">Radio Show Creator · {profile.name}</div>
        <input className="rsc-title-input" onChange={(e) => setTitle(e.target.value)} placeholder="Untitled show" value={title} />
        <div className="rsc-metarow">
          <label className="rsc-field">
            <span>Genre</span>
            <select className="rsc-select" onChange={(e) => setGenre(e.target.value)} value={genre}>
              {GENRES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="rsc-field">
            <span>Ad reach / scope</span>
            <select className="rsc-select" onChange={(e) => { scopeTouchedRef.current = true; setScope(e.target.value as AdvertisingScope); }} value={scope}>
              {SCOPES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            {adPlan && (
              <span className="rsc-ai-hint" title={adPlan.rationale}>
                AI: {adPlan.scope} · {adPlan.breaksPerHour} break{adPlan.breaksPerHour === 1 ? '' : 's'}/hr · target {adPlan.targetAdLoadPct}% load
              </span>
            )}
          </label>
          <label className="rsc-field">
            <span>Go live</span>
            <input className="rsc-dt" onChange={(e) => setWhen(e.target.value)} type="datetime-local" value={when} />
          </label>
          <div className="rsc-actions">
            <button className="rsc-btn rsc-btn-ghost" disabled={saving !== null} onClick={saveDraft} type="button">
              {saving === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
            <button className="rsc-btn rsc-btn-outline" disabled={saving !== null} onClick={schedule} type="button">
              {saving === 'schedule' ? 'Scheduling…' : 'Schedule'}
            </button>
            <button className="rsc-btn rsc-btn-solid" disabled={saving !== null} onClick={goLive} type="button">
              {saving === 'live' ? 'Going live…' : '● Go live'}
            </button>
          </div>
        </div>

        <div className="rsc-stats">
          <div className="rsc-stat"><div className="v">{fmt(total)}</div><div className="l">Runtime</div></div>
          <div className="rsc-stat"><div className="v">{blocks.length}</div><div className="l">Segments</div></div>
          <div className="rsc-stat"><div className="v" style={{ color: 'var(--accent)' }}>{adBreaks}</div><div className="l">Ad breaks</div></div>
          <div className="rsc-stat"><div className="v" style={{ color: adLoad > 25 ? 'var(--accent)' : 'var(--ink)' }}>{adLoad}%</div><div className="l">Ad load</div></div>
        </div>
      </div>

      <div className="rsc-body">
        <div className="rsc-panel rsc-crate-col">
          <div className="rsc-panel-head">
            <span className="rsc-panel-title">Your crate · {initialCrate.length} cleared</span>
            <span className="rsc-drag-hint">Drag →</span>
          </div>
          <div className="rsc-panel-body">
            {initialCrate.length === 0 ? (
              <p className="rsc-empty-note">No free-use tracks yet. Upload some from your DJ page&apos;s Crate tab.</p>
            ) : (
              initialCrate.map((t) => (
                <div className="rsc-crate-item" key={t.hexId}>
                  <span
                    className="rsc-grip"
                    onPointerCancel={onDragPointerCancel}
                    onPointerDown={(e) => onCratePointerDown(t, e)}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                  >
                    <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
                  </span>
                  <div className="rsc-crate-art" style={{ background: 'linear-gradient(135deg,#ff3e9a,#b983ff)' }} />
                  <div className="rsc-crate-info"><h5>{t.title}</h5><p>{t.artistName}</p></div>
                  <span className="rsc-crate-dur">{fmt(t.durationSecs)}</span>
                  <button className="rsc-crate-add" onClick={() => addTrack(t)} title="Add to show" type="button">
                    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="14"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              ))
            )}

            <div className="rsc-add-label">Add to show</div>

            {recorder.phase === 'idle' && (
              <button className="rsc-upload-btn" onClick={startRecording} type="button">
                <span className="rsc-upload-ico" style={{ background: 'rgba(185,131,255,.14)' }}>
                  <svg fill="none" height="17" stroke="#b983ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="17"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" /></svg>
                </span>
                <div><div className="rsc-upload-t">Record voiceover</div><div className="rsc-upload-s">Real mic recording, drop between tracks</div></div>
              </button>
            )}
            {recorder.phase === 'recording' && (
              <div className="rsc-recording-card">
                <span className="rsc-rec-dot" /> Recording… <button className="rsc-btn rsc-btn-ghost" onClick={stopRecording} type="button">Stop</button>
              </div>
            )}
            {recorder.phase === 'processing' && <div className="rsc-recording-card">Processing your recording…</div>}
            {recorder.phase === 'done' && (
              <div className="rsc-recording-card">
                <span>Recorded · {fmt(recorder.durationSecs)}</span>
                <audio className="rsc-vo-preview" controls src={recorder.url} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="rsc-btn rsc-btn-solid" onClick={placeVoiceover} type="button">Add to timeline</button>
                  <button className="rsc-btn rsc-btn-ghost" onClick={discardRecording} type="button">Discard</button>
                </div>
              </div>
            )}

            <button className="rsc-upload-btn" onClick={() => setSamplePicker(true)} type="button">
              <span className="rsc-upload-ico" style={{ background: 'rgba(34,229,212,.14)' }}>
                <svg fill="none" height="17" stroke="#22e5d4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="17"><path d="M2 12h3l2-7 4 14 3-9 2 5h6" /></svg>
              </span>
              <div><div className="rsc-upload-t">Add sample</div><div className="rsc-upload-s">Royalty-free · already cleared</div></div>
            </button>

            <button className="rsc-upload-btn" onClick={openLibraryPicker} type="button">
              <span className="rsc-upload-ico" style={{ background: 'rgba(255,62,154,.14)' }}>
                <svg fill="none" height="17" stroke="#ff3e9a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="17"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              </span>
              <div><div className="rsc-upload-t">Browse free-use library</div><div className="rsc-upload-s">Search cleared tracks from every artist on iHYPE</div></div>
            </button>
            <p className="rsc-fineprint">Voiceovers are your own recording, private to this show. Samples come from a pre-cleared royalty-free catalogue — nothing here needs a copyright check. The free-use library pulls in tracks other artists have opted into sharing platform-wide.</p>
          </div>
        </div>

        <div className="rsc-timeline-col">
          <div className="rsc-panel">
            <div className="rsc-panel-head">
              <span className="rsc-panel-title">Show timeline</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="rsc-ad-btn" onClick={openAdPreview} type="button">
                  <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13"><path d="M12 5v14M5 12h14" /></svg>
                  Ad break · ~1:30
                </button>
                {blocks.length > 0 && <button className="rsc-clear-btn" onClick={() => setBlocks([])} type="button">Clear</button>}
              </div>
            </div>
            {adPlan && adPlan.advertiserTypes.length > 0 && (
              <div className="rsc-ad-types">
                <span className="rsc-ad-types-label">AI-matched for this show:</span>
                {adPlan.advertiserTypes.map((t) => (
                  <span className="rsc-ad-type-chip" key={t}>{t}</span>
                ))}
              </div>
            )}
            <div className="rsc-panel-body rsc-tl-scroll" ref={timelineBodyRef}>
              {blocks.length === 0 && (
                <div className="rsc-tl-empty">
                  <svg fill="none" height="40" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24" width="40"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                  <div className="rsc-tl-empty-title">Build your set</div>
                  <div>Drag tracks from your crate, or record a voiceover, add a sample, or drop in an ad break.</div>
                </div>
              )}

              {blocks.map((b, i) => {
                const meta = TYPE_META[b.kind];
                return (
                  <div key={b.uid}>
                    {overIndex === i && <div className="rsc-drop-line" />}
                    <div className={b.kind === 'AD' ? 'rsc-tl-item rsc-tl-item-ad' : 'rsc-tl-item'} data-block>
                      <span
                        className="rsc-tl-grip"
                        onPointerCancel={onDragPointerCancel}
                        onPointerDown={(e) => onBlockPointerDown(i, e)}
                        onPointerMove={onDragPointerMove}
                        onPointerUp={onDragPointerUp}
                      >
                        <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
                      </span>
                      <span className="rsc-tl-pos">{fmt(starts[i])}</span>
                      <span className="rsc-tl-type" style={{ background: meta.color }} />
                      <div className="rsc-tl-main">
                        <h4><span className="rsc-tl-chip" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>{b.label}</h4>
                        {b.kind === 'AD' ? (
                          <div className="rsc-ad-spots">
                            {b.adClips.map((clip) => (
                              <div className="rsc-ad-spot" key={clip.clipId}>
                                <span className="rsc-as-name">{clip.title}</span>
                                <span className="rsc-as-scope">{clip.scope}</span>
                                <span className="rsc-as-dur">:{clip.durationSeconds ?? 0}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rsc-tl-sub">{b.sub}</div>
                        )}
                      </div>
                      <span className="rsc-tl-dur">{fmt(b.dur)}</span>
                      <button className="rsc-tl-rm" onClick={() => removeBlock(b.uid)} title="Remove" type="button">
                        <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="15"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {overIndex === blocks.length && blocks.length > 0 && <div className="rsc-drop-line" />}
            </div>
          </div>

          {blocks.length > 0 && (
            <div className="rsc-summary">
              <div><div className="rsc-s-v">{fmt(total)}</div><div className="rsc-s-l">Total runtime</div></div>
              <div><div className="rsc-s-v">{fmt(total - adTime)}</div><div className="rsc-s-l">Music + talk</div></div>
              <div><div className="rsc-s-v" style={{ color: 'var(--accent)' }}>{fmt(adTime)}</div><div className="rsc-s-l">Ad time</div></div>
              <div className="rsc-s-bar">
                <div className="rsc-s-bar-label"><span>Ad load</span><span>{adLoad}%</span></div>
                <div className="rsc-s-bar-track"><div className="rsc-s-bar-fill" style={{ width: `${Math.min(100, adLoad)}%` }} /></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {samplePicker && (
        <div className="rsc-modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) closeSamplePicker(); }}>
          <div className="rsc-modal">
            <div className="rsc-modal-head">
              <span>Add a sample</span>
              <span onClick={closeSamplePicker} style={{ cursor: 'pointer' }}>×</span>
            </div>
            <div className="rsc-modal-body">
              {royaltyFreeSampleClips.map((sample) => (
                <div className="rsc-sample-row" key={sample.sampleId}>
                  <button
                    className="rsc-sample-preview"
                    onClick={() => togglePreview(sample.sampleId, sample.url)}
                    title={previewingId === sample.sampleId ? 'Pause preview' : 'Preview sample'}
                    type="button"
                  >
                    <PreviewIcon playing={previewingId === sample.sampleId} />
                  </button>
                  <span className="rsc-sample-swatch" style={{ background: sample.colorHex ?? '#22e5d4' }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{sample.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-a50)' }}>{sample.category ?? 'fx'} · {sample.notes}</div>
                  </div>
                  <button className="rsc-sample-add" onClick={() => addSample(sample)} title="Add to show" type="button">
                    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="14"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {libraryPicker && (
        <div className="rsc-modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) closeLibraryPicker(); }}>
          <div className="rsc-modal rsc-modal-lg">
            <div className="rsc-modal-head">
              <span>Browse free-use library</span>
              <span onClick={closeLibraryPicker} style={{ cursor: 'pointer' }}>×</span>
            </div>
            <div style={{ padding: '10px 14px 0' }}>
              <input
                autoFocus
                className="rsc-select"
                onChange={(e) => onLibraryQueryChange(e.target.value)}
                placeholder="Search by track title or artist name…"
                style={{ width: '100%' }}
                type="text"
                value={libraryQuery}
              />
            </div>
            <div className="rsc-modal-body">
              {libraryLoading && <p className="rsc-empty-note">Searching…</p>}
              {!libraryLoading && libraryError && <p className="rsc-empty-note">{libraryError}</p>}
              {!libraryLoading && !libraryError && libraryTracks.length === 0 && (
                <p className="rsc-empty-note">
                  {libraryQuery ? `No free-use tracks match “${libraryQuery}”.` : 'No free-use tracks are available platform-wide yet.'}
                </p>
              )}
              {!libraryLoading && !libraryError && libraryTracks.map((t) => (
                <div className="rsc-sample-row" key={t.hexId}>
                  <button
                    className="rsc-sample-preview"
                    onClick={() => togglePreview(t.hexId, t.streamUrl)}
                    title={previewingId === t.hexId ? 'Pause preview' : 'Preview track'}
                    type="button"
                  >
                    <PreviewIcon playing={previewingId === t.hexId} />
                  </button>
                  <div className="rsc-crate-art" style={{ background: 'linear-gradient(135deg,#ff3e9a,#b983ff)' }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-a50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.artist.name}{t.artist.location ? ` · ${t.artist.location}` : ''}
                    </div>
                  </div>
                  <span className="rsc-crate-dur">{fmt(t.durationSecs ?? 180)}</span>
                  <button className="rsc-sample-add" onClick={() => addLibraryTrack(t)} title="Add to show" type="button">
                    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="14"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adPreviewClips && (
        <div className="rsc-modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) closeAdPreview(); }}>
          <div className="rsc-modal">
            <div className="rsc-modal-head">
              <span>Preview ad break</span>
              <span onClick={closeAdPreview} style={{ cursor: 'pointer' }}>×</span>
            </div>
            <div className="rsc-modal-body">
              <p className="rsc-fineprint" style={{ margin: '0 4px 4px' }}>
                {adPreviewIsMarketplace
                  ? <>Real advertiser campaigns purchased for &quot;{scope}&quot; reach — preview each spot, then add the break to your timeline. You&apos;ll be credited an impression each time one plays.</>
                  : <>No purchased ads for &quot;{scope}&quot; reach yet — auto-picked from the placeholder ad catalog instead. Preview each spot, then add the break to your timeline.</>}
              </p>
              {adPreviewClips.map((clip) => (
                <div className="rsc-sample-row" key={clip.clipId}>
                  <button
                    className="rsc-sample-preview"
                    onClick={() => togglePreview(clip.clipId, clip.url)}
                    title={previewingId === clip.clipId ? 'Pause preview' : 'Preview ad'}
                    type="button"
                  >
                    <PreviewIcon playing={previewingId === clip.clipId} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{clip.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-a50)' }}>{clip.scope} · :{clip.durationSeconds ?? 0}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
              <button className="rsc-btn rsc-btn-solid" onClick={confirmAdBreak} type="button">Add to timeline</button>
              <button className="rsc-btn rsc-btn-ghost" onClick={closeAdPreview} type="button">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <audio onEnded={() => setPreviewingId(null)} ref={previewAudioRef} style={{ display: 'none' }} />

      {toast && <div className="rsc-toast">{toast}</div>}

      <style>{`
        .rsc-root { max-width: 1200px; margin: 0 auto; padding: 0 0 120px; }
        .rsc-head { background: linear-gradient(140deg, rgba(255,62,154,.12), rgba(185,131,255,.07)); border-bottom: 1px solid rgba(255,62,154,.18); padding: 34px 32px 26px; }
        .rsc-eyebrow { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a55); margin-bottom: 10px; }
        .rsc-title-input { font-family: var(--font-display); font-size: 30px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); background: transparent; border: none; border-bottom: 2px solid transparent; padding: 2px 0; width: 100%; max-width: 640px; outline: none; }
        .rsc-title-input:focus { border-bottom-color: #b983ff; }
        .rsc-metarow { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; margin-top: 18px; }
        .rsc-field { display: flex; flex-direction: column; gap: 6px; }
        .rsc-field span { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a55); }
        .rsc-field .rsc-ai-hint { text-transform: none; letter-spacing: .04em; color: #22e5d4; cursor: help; }
        .rsc-select, .rsc-dt { font-family: var(--font-body); font-size: 13px; color: var(--ink); background: var(--bg2); border: 1px solid var(--hair-100); border-radius: 8px; padding: 9px 12px; outline: none; }
        .rsc-actions { display: flex; gap: 10px; margin-left: auto; align-items: flex-end; flex-wrap: wrap; }
        .rsc-btn { padding: 9px 16px; border-radius: 8px; font-family: var(--font-display); font-weight: 700; font-size: 13px; cursor: pointer; border: none; }
        .rsc-btn:disabled { opacity: .6; cursor: default; }
        .rsc-btn-ghost { background: var(--line); color: var(--ink); }
        .rsc-btn-outline { background: transparent; border: 1px solid var(--hair-160); color: var(--ink); }
        .rsc-btn-solid { background: var(--accent); color: #fff; }
        .rsc-stats { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
        .rsc-stat { border: 1px solid var(--hair-80); border-radius: 10px; padding: 10px 16px; background: var(--hair-20); min-width: 108px; }
        .rsc-stat .v { font-family: var(--font-display); font-weight: 800; font-size: 20px; }
        .rsc-stat .l { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-a55); margin-top: 3px; }
        .rsc-body { display: grid; grid-template-columns: 340px 1fr; gap: 24px; padding: 26px 32px 0; align-items: start; }
        @media (max-width: 820px) {
          .rsc-body { grid-template-columns: 1fr; }
          /* Timeline first on mobile — crate tracks to drag/tap in sit below it. */
          .rsc-timeline-col { order: 1; }
          .rsc-crate-col { order: 2; }
        }
        .rsc-panel { border: 1px solid var(--hair-70); border-radius: 14px; background: var(--bg2); overflow: hidden; }
        .rsc-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
        .rsc-panel-title { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-a60); }
        .rsc-drag-hint { font-family: var(--font-mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-a50); }
        .rsc-panel-body { padding: 12px; }
        .rsc-empty-note { font-size: 12px; color: var(--ink-a50); padding: 8px 4px; }
        .rsc-crate-item { display: flex; gap: 11px; align-items: center; padding: 9px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--hair-20); margin-bottom: 8px; }
        .rsc-crate-item:hover { background: var(--bg3); border-color: var(--hair-120); }
        .rsc-grip { color: var(--ink-a28); flex-shrink: 0; display: flex; padding: 6px; margin: -6px; cursor: grab; touch-action: none; }
        .rsc-grip:active { cursor: grabbing; }
        .rsc-crate-art { width: 40px; height: 40px; border-radius: 7px; flex-shrink: 0; }
        .rsc-crate-info { flex: 1; min-width: 0; }
        .rsc-crate-info h5 { font-family: var(--font-display); font-weight: 800; font-size: 13px; margin: 0 0 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rsc-crate-info p { font-size: 11px; color: var(--ink-a55); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rsc-crate-dur { font-family: var(--font-mono); font-size: 10px; color: var(--ink-a50); flex-shrink: 0; }
        .rsc-crate-add { flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--line-2); background: transparent; color: var(--ink); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .rsc-crate-add:hover { background: rgba(255,62,154,.14); border-color: rgba(255,62,154,.4); color: #ff3e9a; }
        .rsc-add-label { margin: 14px 2px 8px; font-family: var(--font-mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a55); }
        .rsc-upload-btn { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 11px 12px; border: 1px dashed var(--hair-160); border-radius: 10px; background: transparent; color: var(--ink); cursor: pointer; margin-bottom: 8px; }
        .rsc-upload-btn:hover { border-color: rgba(185,131,255,.5); background: rgba(185,131,255,.05); }
        .rsc-upload-ico { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rsc-upload-t { font-family: var(--font-display); font-weight: 800; font-size: 13px; }
        .rsc-upload-s { font-size: 11px; color: var(--ink-a55); margin-top: 1px; }
        .rsc-recording-card { padding: 12px; border-radius: 10px; background: rgba(255,80,41,.08); border: 1px solid rgba(255,80,41,.25); margin-bottom: 8px; font-size: 13px; }
        .rsc-vo-preview { display: block; width: 100%; margin-top: 8px; }
        .rsc-rec-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); margin-right: 6px; animation: rsc-pulse 1s ease-in-out infinite; }
        @keyframes rsc-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .rsc-fineprint { font-size: 11px; color: var(--ink-a50); line-height: 1.55; margin: 6px 4px 0; }
        .rsc-tl-scroll { min-height: 320px; }
        .rsc-tl-item { position: relative; display: flex; gap: 12px; align-items: center; padding: 12px 14px; border: 1px solid var(--hair-70); border-radius: 10px; background: var(--hair-20); margin-bottom: 9px; }
        .rsc-tl-item-ad { background: rgba(255,80,41,.05); border-color: rgba(255,80,41,.22); align-items: flex-start; }
        .rsc-tl-grip { color: var(--ink-a32); flex-shrink: 0; display: flex; align-self: center; padding: 6px; margin: -6px 0; cursor: grab; touch-action: none; }
        .rsc-tl-grip:active { cursor: grabbing; }
        .rsc-tl-pos { font-family: var(--font-mono); font-size: 10px; color: var(--ink-a55); width: 42px; flex-shrink: 0; text-align: right; }
        .rsc-tl-type { width: 8px; align-self: stretch; border-radius: 4px; flex-shrink: 0; }
        .rsc-tl-main { flex: 1; min-width: 0; }
        .rsc-tl-main h4 { font-family: var(--font-display); font-weight: 800; font-size: 14px; margin: 0 0 2px; }
        .rsc-tl-sub { font-size: 11px; color: var(--ink-a55); }
        .rsc-tl-chip { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 8px; text-transform: uppercase; letter-spacing: .12em; padding: 3px 7px; border-radius: 4px; margin-right: 8px; vertical-align: middle; }
        .rsc-tl-dur { font-family: var(--font-mono); font-size: 11px; color: var(--ink-a60); flex-shrink: 0; }
        .rsc-tl-rm { flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px; border: none; background: transparent; color: var(--ink-a50); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .rsc-tl-rm:hover { background: rgba(255,80,41,.14); color: var(--accent); }
        .rsc-drop-line { height: 2px; background: #b983ff; border-radius: 2px; margin: -5px 0 7px; box-shadow: 0 0 8px rgba(255,62,154,.6); }
        .rsc-ad-spots { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
        .rsc-ad-spot { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: rgba(0,0,0,.25); border: 1px solid var(--line); }
        .rsc-as-name { font-size: 12px; font-weight: 600; flex: 1; min-width: 0; }
        .rsc-as-scope { font-family: var(--font-mono); font-size: 9px; color: var(--ink-a50); text-transform: uppercase; flex-shrink: 0; }
        .rsc-as-dur { font-family: var(--font-mono); font-size: 10px; color: var(--ink-a60); flex-shrink: 0; }
        .rsc-tl-empty { text-align: center; padding: 60px 24px; color: var(--ink-a50); border: 2px dashed var(--hair-100); border-radius: 12px; }
        .rsc-tl-empty-title { font-family: var(--font-display); font-weight: 800; font-size: 16px; color: var(--ink); margin-bottom: 4px; }
        .rsc-ad-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(255,80,41,.4); background: rgba(255,80,41,.08); color: var(--accent); font-family: var(--font-display); font-weight: 800; font-size: 12px; cursor: pointer; }
        .rsc-ad-types { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px 16px; border-bottom: 1px solid var(--line); }
        .rsc-ad-types-label { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-a55); margin-right: 2px; }
        .rsc-ad-type-chip { font-family: var(--font-mono); font-size: 9px; letter-spacing: .06em; color: #22e5d4; background: rgba(34,229,212,.12); border-radius: 4px; padding: 3px 8px; }
        .rsc-clear-btn { padding: 7px 12px; border-radius: 8px; border: 1px solid var(--hair-120); background: transparent; color: var(--ink-a60); font-size: 12px; font-weight: 600; cursor: pointer; }
        .rsc-summary { display: flex; gap: 22px; flex-wrap: wrap; padding: 16px 18px; margin-top: 14px; border: 1px solid var(--hair-70); border-radius: 12px; background: var(--bg2); }
        .rsc-s-v { font-family: var(--font-display); font-weight: 800; font-size: 18px; }
        .rsc-s-l { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-a55); margin-top: 2px; }
        .rsc-s-bar { flex: 1; min-width: 160px; align-self: center; }
        .rsc-s-bar-label { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .rsc-s-bar-track { height: 6px; border-radius: 3px; background: var(--hair-80); overflow: hidden; }
        .rsc-s-bar-fill { height: 100%; background: var(--accent); border-radius: 3px; }
        .rsc-modal-wrap { position: fixed; inset: 0; background: rgba(0,0,0,.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .rsc-modal { width: 100%; max-width: 420px; background: var(--bg2); border: 1px solid var(--hair-100); border-radius: 16px; overflow: hidden; max-height: 80vh; overflow-y: auto; }
        .rsc-modal-lg { max-width: 520px; }
        .rsc-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--line); font-family: var(--font-display); font-weight: 800; font-size: 15px; }
        .rsc-modal-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
        .rsc-sample-row { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 9px; border: 1px solid var(--line); background: var(--hair-20); }
        .rsc-sample-row:hover { background: var(--bg3); }
        .rsc-sample-swatch { width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0; }
        .rsc-sample-preview, .rsc-sample-add { flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--line-2); background: transparent; color: var(--ink); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .rsc-sample-preview:hover { background: rgba(34,229,212,.14); border-color: rgba(34,229,212,.4); color: #22e5d4; }
        .rsc-sample-add:hover { background: rgba(255,62,154,.14); border-color: rgba(255,62,154,.4); color: #ff3e9a; }
        .rsc-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--bg3); border: 1px solid rgba(34,229,212,.35); color: var(--ink); padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; z-index: 1100; box-shadow: 0 8px 30px rgba(0,0,0,.4); }
      `}</style>
    </div>
  );
}
