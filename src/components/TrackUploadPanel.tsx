'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

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

/**
 * The crate half of this component is gone with the DJ role. `profileType` had
 * exactly two values and only `"ARTIST"` was ever passed — `/promoters/[slug]`,
 * the one mount that sent `"DJ"`, was deleted in step 2c of the DJ removal.
 */
type AlbumOption = { id: string; title: string; releasedOn: string | null };

export function TrackUploadPanel({
  profileId,
  onUploaded,
  albums = [],
}: {
  profileId: string;
  onUploaded?: () => void;
  /** The artist's album folders, so a track can be filed at upload. */
  albums?: AlbumOption[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [freeUseEnabled, setFreeUseEnabled] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  /* Launch now, or on a date the artist picks (owner, 2026-09-02). The date
     is a local datetime in the picker and an ISO instant on the wire. Filing
     into a dated album with "now" selected takes the album's date server-side. */
  const [releaseMode, setReleaseMode] = useState<'now' | 'schedule'>('now');
  const [releaseAt, setReleaseAt] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanLayers, setScanLayers] = useState<ScanLayer[] | null>(null);
  const [revealed, setRevealed] = useState<Record<number, LayerRevealState>>({});
  const [finalMessage, setFinalMessage] = useState<string | null>(null);

  const submitLabel = t('trackUploadPanel.uploadTrackButton', 'Upload track');

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
      // "Held" not "flagged for review", because a flagged track is now
      // actually withheld from the page rather than published alongside a
      // report. Telling someone their track is live when it is not is the
      // kind of thing they only discover from a listener.
      setFinalMessage(flagged
        ? `${t('trackUploadPanel.heldForReviewPrefix', 'Held for review:')} ${flagged.reasoning} ${t('trackUploadPanel.heldForReviewSuffix', 'It stays off your page until someone checks it, usually within 48 hours.')}`
        : t('trackUploadPanel.allChecksClearedMessage', 'All checks cleared — live now.'));
    }, totalMs));
    return () => timers.forEach(clearTimeout);
  }, [scanLayers]);

  async function submit() {
    if (!file) { setError(t('trackUploadPanel.chooseAudioFileError', 'Choose an audio file first.')); return; }
    if (!title.trim()) { setError(t('trackUploadPanel.giveTrackTitleError', 'Give the track a title.')); return; }
    if (releaseMode === 'schedule' && (!releaseAt || Number.isNaN(new Date(releaseAt).getTime()))) {
      setError(t('trackUploadPanel.pickReleaseDateError', 'Pick a release date and time, or choose "Now".'));
      return;
    }
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
      if (artworkFile) formData.set('artwork', artworkFile);
      if (releaseMode === 'schedule' && releaseAt) formData.set('publishAt', new Date(releaseAt).toISOString());
      if (albumId) formData.set('albumId', albumId);

      const response = await fetch('/api/artist-media', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? t('trackUploadPanel.uploadErrorFallback', 'Could not upload this track.'));
        setSubmitting(false);
        return;
      }

      setScanLayers(data.scan ?? []);
      setTitle('');
      setNotes('');
      setFreeUseEnabled(false);
      setFile(null);
      setArtworkFile(null);
      setReleaseMode('now');
      setReleaseAt('');
      onUploaded?.();
      router.refresh();
    } catch {
      setError(t('trackUploadPanel.uploadNetworkErrorFallback', 'Could not upload this track. Check your connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="artist-media-upload-panel">
      <div className="artist-media-upload-header">
        <div>
          <h3>{t('trackUploadPanel.uploadTrackHeading', 'Upload track')}</h3>
          <p className="meta">
            {t('trackUploadPanel.artistAudioOnlyNotice', 'Audio only — MP3, AAC/M4A, WAV or FLAC, up to 60 MB. Lossless is welcome. Every upload runs an automated scan before it’s marked cleared.')}
          </p>
        </div>
      </div>

      <div className="artist-media-upload-form">
        {error ? <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        <input
          accept=".mp3,.m4a,.aac,.wav,.flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/wave,audio/flac,audio/x-flac"
          disabled={submitting}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          type="file"
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9375rem' }}>
          {t('trackUploadPanel.coverArtLabel', 'Cover art (optional)')}
          <input
            accept="image/jpeg,image/png,image/gif,image/webp"
            disabled={submitting}
            onChange={(e) => setArtworkFile(e.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <input
          className="field"
          disabled={submitting}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('trackUploadPanel.trackTitlePlaceholder', 'Track title')}
          type="text"
          value={title}
        />
        <textarea
          disabled={submitting}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('trackUploadPanel.notesPlaceholder', 'Notes (optional)')}
          rows={2}
          value={notes}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.9375rem' }}>
          <span style={{ fontWeight: 600 }}>{t('trackUploadPanel.releaseLabel', 'Release')}</span>
          {(['now', 'schedule'] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={releaseMode === mode}
              className={releaseMode === mode ? 'sub-tab active' : 'sub-tab'}
              disabled={submitting}
              onClick={() => setReleaseMode(mode)}
              type="button"
            >
              {mode === 'now' ? t('trackUploadPanel.releaseNow', 'Now') : t('trackUploadPanel.releaseOnDate', 'On a date')}
            </button>
          ))}
          {releaseMode === 'schedule' && (
            <input
              aria-label={t('trackUploadPanel.releaseAtLabel', 'Release date and time')}
              className="field"
              disabled={submitting}
              min={new Date(Date.now() - 60_000).toISOString().slice(0, 16)}
              onChange={(e) => setReleaseAt(e.target.value)}
              style={{ flex: '1 1 200px' }}
              type="datetime-local"
              value={releaseAt}
            />
          )}
        </div>
        {albums.length > 0 && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9375rem' }}>
            {t('trackUploadPanel.albumLabel', 'Album (optional)')}
            <select className="field" disabled={submitting} onChange={(e) => setAlbumId(e.target.value)} value={albumId}>
              <option value="">{t('trackUploadPanel.singleOption', 'Single')}</option>
              {albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
            </select>
          </label>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9375rem' }}>
          <input
            checked={freeUseEnabled}
            disabled={submitting}
            onChange={(e) => setFreeUseEnabled(e.target.checked)}
            type="checkbox"
          />
          {t('trackUploadPanel.allowFreeUseLabel', 'Allow free use (this track can air on the station and in playlists)')}
        </label>
        <button className="button small" disabled={submitting} onClick={submit} type="button">
          {submitting ? t('trackUploadPanel.uploadingButton', 'Uploading…') : submitLabel}
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
                  <span className="track-scan-layer-note">{t('trackUploadPanel.notConfiguredLabel', 'Not configured')}</span>
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
