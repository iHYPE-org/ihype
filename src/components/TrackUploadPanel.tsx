'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type ScanLayer = {
  layer: 0 | 1 | 2 | 3;
  name: string;
  configured: boolean;
  cleared: boolean;
  requiresManualReview: boolean;
  reasoning: string;
};

type LayerRevealState = 'pending' | 'checking' | 'done';

const STAGGER_MS = 550;

export function TrackUploadPanel({
  profileId,
  profileType,
  onUploaded,
}: {
  profileId: string;
  profileType: 'ARTIST' | 'DJ';
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [freeUseEnabled, setFreeUseEnabled] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanLayers, setScanLayers] = useState<ScanLayer[] | null>(null);
  const [revealed, setRevealed] = useState<Record<number, LayerRevealState>>({});
  const [finalMessage, setFinalMessage] = useState<string | null>(null);

  const isDj = profileType === 'DJ';
  const submitLabel = isDj ? 'Add to crate' : 'Upload track';

  // Sequentially reveal each layer's already-known result on a stagger, so
  // the scan reads as a live gate pass rather than an instant dump of JSON.
  // The scan itself already completed synchronously server-side (no
  // background job queue exists in this codebase to poll against) — this
  // animates the reveal of a result we already have, it does not simulate
  // work that didn't happen.
  useEffect(() => {
    if (!scanLayers) return;
    setRevealed({});
    const timers: ReturnType<typeof setTimeout>[] = [];
    scanLayers.forEach((layer, index) => {
      timers.push(setTimeout(() => {
        setRevealed((prev) => ({ ...prev, [layer.layer]: 'checking' }));
      }, index * STAGGER_MS));
      timers.push(setTimeout(() => {
        setRevealed((prev) => ({ ...prev, [layer.layer]: 'done' }));
      }, index * STAGGER_MS + STAGGER_MS * 0.7));
    });
    const totalMs = scanLayers.length * STAGGER_MS + 400;
    timers.push(setTimeout(() => {
      const flagged = scanLayers.find((l) => l.configured && (!l.cleared || l.requiresManualReview));
      setFinalMessage(flagged
        ? `Flagged for review: ${flagged.reasoning}`
        : 'All checks cleared — live now.');
    }, totalMs));
    return () => timers.forEach(clearTimeout);
  }, [scanLayers]);

  async function submit() {
    if (!file) { setError('Choose an audio file first.'); return; }
    if (!title.trim()) { setError('Give the track a title.'); return; }
    setSubmitting(true);
    setError(null);
    setScanLayers(null);
    setFinalMessage(null);

    try {
      const formData = new FormData();
      formData.set('profileId', profileId);
      formData.set('title', title.trim());
      formData.set('notes', notes.trim());
      formData.set('freeUseEnabled', String(freeUseEnabled));
      formData.set('file', file);

      const response = await fetch('/api/artist-media', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not upload this track.');
        setSubmitting(false);
        return;
      }

      setScanLayers(data.scan ?? []);
      setTitle('');
      setNotes('');
      setFreeUseEnabled(false);
      setFile(null);
      onUploaded?.();
      router.refresh();
    } catch {
      setError('Could not upload this track. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="artist-media-upload-panel">
      <div className="artist-media-upload-header">
        <div>
          <h3>{isDj ? 'Add to crate' : 'Upload track'}</h3>
          <p className="meta">
            {isDj
              ? 'Audio only (MP3/WAV/FLAC) — nothing airs until it clears the scan below.'
              : 'Audio only (MP3/WAV/FLAC). Every upload runs an automated scan before it\u2019s marked cleared.'}
          </p>
        </div>
      </div>

      <div className="artist-media-upload-form">
        {error ? <p className="meta" style={{ color: 'var(--danger, #ff5a5a)' }}>{error}</p> : null}
        <input
          accept="audio/*"
          disabled={submitting}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          type="file"
        />
        <input
          className="field"
          disabled={submitting}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Track title"
          type="text"
          value={title}
        />
        <textarea
          disabled={submitting}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          value={notes}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <input
            checked={freeUseEnabled}
            disabled={submitting}
            onChange={(e) => setFreeUseEnabled(e.target.checked)}
            type="checkbox"
          />
          Allow free use (promoters/DJs can add this to shows and playlists)
        </label>
        <button className="button small" disabled={submitting} onClick={submit} type="button">
          {submitting ? 'Uploading…' : submitLabel}
        </button>
      </div>

      {scanLayers && (
        <div className="track-scan-gate">
          {scanLayers.map((layer) => {
            const state = revealed[layer.layer] ?? 'pending';
            const flaggedHere = layer.configured && state === 'done' && (!layer.cleared || layer.requiresManualReview);
            return (
              <div className={`track-scan-layer track-scan-layer-${state}`} key={layer.layer}>
                <span className="track-scan-layer-icon">
                  {state === 'pending' ? '·' : state === 'checking' ? '…' : !layer.configured ? '—' : flaggedHere ? '!' : '✓'}
                </span>
                <span className="track-scan-layer-name">{layer.name}</span>
                {state === 'done' && !layer.configured && (
                  <span className="track-scan-layer-note">Not configured</span>
                )}
                {state === 'done' && layer.configured && flaggedHere && (
                  <span className="track-scan-layer-note track-scan-layer-note-flag">{layer.reasoning}</span>
                )}
              </div>
            );
          })}
          {finalMessage && <p className="meta track-scan-final">{finalMessage}</p>}
        </div>
      )}
    </div>
  );
}
