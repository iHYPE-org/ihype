'use client';

import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SITE_CONFIG, siteThemes, type SiteConfig } from '@/lib/profile-site';
import { profileMicrositeThemePalettes } from '@/lib/profile-design';

type OwnerProfile = {
  id: string; slug: string; name: string; type: string; headline: string | null;
  bio: string | null; heroImage: string | null; verificationStatus: string;
};
type OwnerVideo = {
  id: string; title: string; quality: string; status: string; isPublished: boolean;
  durationSecs: number | null; muxPlaybackId: string | null; archiveKey: string | null; archiveUploadId: string | null;
};
type SitePayload = { profile: OwnerProfile; site: SiteConfig };
type VideoPayload = { videos: OwnerVideo[]; enabled: boolean; archiveEnabled: boolean };
type SectionId = keyof SiteConfig['sections'];
const sections: Array<{ id: SectionId; label: string; help: string }> = [
  { id: 'about', label: 'About', help: 'Your biography and story' },
  { id: 'shows', label: 'Shows', help: 'Upcoming iHYPE performances and tickets' },
  { id: 'music', label: 'Music', help: 'Your approved audio tracks' },
  { id: 'videos', label: 'Videos', help: 'Videos published on iHYPE' },
  { id: 'merch', label: 'Merchandise', help: 'Link to your existing shop' },
  { id: 'contact', label: 'Contact details', help: 'Publicly show the contact info from your profile' },
];

export function ProfileSiteBuilder({ profileId }: { profileId: string }) {
  const { t } = useI18n();
  const [site, setSite] = useState<SiteConfig>({ ...DEFAULT_SITE_CONFIG, sections: { ...DEFAULT_SITE_CONFIG.sections } });
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [videos, setVideos] = useState<OwnerVideo[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [archiveEnabled, setArchiveEnabled] = useState(false);
  const [archiveOriginal, setArchiveOriginal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [quality, setQuality] = useState<'1080p' | '2160p'>('1080p');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const publicUrl = profile ? `/site/${profile.slug}` : '';
  const theme = profileMicrositeThemePalettes[site.theme];

  const loadVideos = useCallback(async () => {
    const response = await fetch(`/api/site-videos?profileId=${encodeURIComponent(profileId)}`, { cache: 'no-store' });
    const json = await response.json() as VideoPayload & { error?: string };
    if (!response.ok) throw new Error(json.error || 'Could not load video library.');
    setVideos(json.videos);
    setEnabled(json.enabled);
    setArchiveEnabled(json.archiveEnabled);
  }, [profileId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/site-builder?profileId=${encodeURIComponent(profileId)}`, { cache: 'no-store' });
        const data = await response.json() as SitePayload & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Site unavailable.');
        if (!active) return;
        setProfile(data.profile);
        setSite(data.site);
        await loadVideos();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your website.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profileId, loadVideos]);

  async function saveSite(published: boolean) {
    if (!profile) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/site-builder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, site: { ...site, published } }),
      });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error || 'Could not save website.');
      setSite(current => ({ ...current, published }));
      setMessage(published
        ? 'Website published! The public link is ready to share.'
        : 'Draft saved. Your website is not publicly visible.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save website.'); }
    finally { setBusy(false); }
  }

  function updateSection(id: SectionId, checked: boolean) {
    setSite(current => ({ ...current, sections: { ...current.sections, [id]: checked } }));
  }

  async function archiveFile(file: File, videoId: string) {
    const start = await fetch('/api/site-videos/archive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', videoId, mimeType: file.type || 'video/mp4' }),
    });
    const started = await start.json() as { error?: string };
    if (!start.ok) throw new Error(started.error || 'Could not start archive.');
    const partSize = 8 * 1024 * 1024;
    const parts: Array<{ partNumber: number; etag: string }> = [];
    for (let offset = 0, partNumber = 1; offset < file.size; offset += partSize, partNumber++) {
      const response = await fetch(
        `/api/site-videos/archive?videoId=${encodeURIComponent(videoId)}&part=${partNumber}`,
        { method: 'PUT', body: file.slice(offset, offset + partSize), headers: { 'Content-Type': 'application/octet-stream' } },
      );
      const result = await response.json() as { etag?: string; error?: string };
      if (!response.ok || !result.etag) throw new Error(result.error || 'Archiving a video chunk failed.');
      parts.push({ partNumber, etag: result.etag });
      setMessage(`Mux upload complete. Archiving original: ${Math.min(100, Math.round(((offset + partSize) / file.size) * 100))}%`);
    }
    const complete = await fetch('/api/site-videos/archive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', videoId, parts }),
    });
    const completed = await complete.json() as { error?: string };
    if (!complete.ok) throw new Error(completed.error || 'Could not finish video archive.');
  }

  async function uploadVideo() {
    if (!selectedFile || !profile || !enabled || !rightsConfirmed) return;
    if (selectedFile.size > 2 * 1024 * 1024 * 1024) { setError('Maximum video size is 2 GiB during beta.'); return; }
    if (!selectedFile.type.startsWith('video/')) { setError('Choose a video file.'); return; }
    setError(''); setMessage('Preparing secure direct upload…'); setProgress(0); setUploading(true);
    try {
      const create = await fetch('/api/site-videos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId, title: selectedFile.name.replace(/\.[^.]+$/, '').slice(0, 160),
          fileSizeBytes: selectedFile.size, quality, rightsConfirmed: true,
        }),
      });
      const upload = await create.json() as { id?: string; uploadUrl?: string; error?: string };
      if (!create.ok || !upload.uploadUrl || !upload.id) throw new Error(upload.error || 'Could not create a video upload.');

      // Avoid proxying large files through the Cloudflare Worker. The Mux
      // signed URL sends the original directly from this browser to Mux.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', upload.uploadUrl!, true);
        xhr.setRequestHeader('Content-Type', selectedFile.type);
        xhr.upload.onprogress = evt => {
          if (evt.lengthComputable) setProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
        };
        xhr.onerror = () => reject(new Error('Network interrupted. The video is not published; retry with a new upload.'));
        xhr.onabort = () => reject(new Error('Upload canceled.'));
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
          ? resolve() : reject(new Error(`Video transfer failed (HTTP ${xhr.status}).`));
        xhr.send(selectedFile);
      });
      if (archiveOriginal && archiveEnabled) {
        await archiveFile(selectedFile, upload.id);
      }
      setMessage('Upload received. Video processing can take several minutes. Refresh status below to publish it.');
      setSelectedFile(null); setRightsConfirmed(false);
      if (fileRef.current) fileRef.current.value = '';
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video upload failed.');
    } finally { setUploading(false); }
  }

  async function discardArchive(video: OwnerVideo) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/site-videos/archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abort', videoId: video.id }),
      });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error || 'Could not discard incomplete archive.');
      setMessage('Incomplete R2 copy discarded.');
      await loadVideos();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not discard archive.'); }
    finally { setBusy(false); }
  }

  async function videoAction(video: OwnerVideo, action: 'publish' | 'unpublish' | 'delete') {
    if (action === 'delete' && !window.confirm('Delete this video from Mux and its optional R2 original?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/site-videos/${video.id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        ...(action === 'delete' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }),
      });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error || 'Video action failed.');
      setMessage(action === 'publish' ? 'Video is public.' : action === 'unpublish' ? 'Video playback was revoked.' : 'Video deleted.');
      await loadVideos();
    } catch (err) { setError(err instanceof Error ? err.message : 'Video update failed.'); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="ih-builder" role="status">{t("siteBuilder.loadingYourWebsiteBuilder", "Loading your website builder…")}</div>;
  if (!profile) return <div className="ih-builder" role="alert">{error || 'Artist or venue not found.'}</div>;

  return (
    <section className="ih-builder" aria-label={t("siteBuilder.onepageWebsiteAndVideoCreator", "One-page website and video creator")}>
      <div className="ih-builder-head">
        <div>
          <div className="ih-builder-eyebrow">MY PAGES / SITE CREATOR</div>
          <h1>{profile.name}: Website + Video</h1>
          <p>{t("siteBuilder.buildAFreeMobilefriendlyOnepage", "Build a free, mobile-friendly one-page website. Everything stays linked to your iHYPE profile.")}</p>
        </div>
        <Link href={`/app/me/profiles?profile=${profile.id}`} className="ih-builder-secondary">{t("siteBuilder.backToProfiles", "Back to profiles")}</Link>
      </div>
      {error && <p role="alert" className="ih-builder-alert">{error}</p>}
      {message && <p role="status" className="ih-builder-success">{message}</p>}
      {site.published && publicUrl && (
        <p className="ih-builder-live">{t("siteBuilder.websiteLive", "Website live:")}<a href={publicUrl} rel="noopener noreferrer" target="_blank">{typeof window === 'undefined' ? publicUrl : window.location.origin + publicUrl}</a></p>
      )}
      <div className="ih-builder-grid">
        <div className="ih-builder-editor">
          <div className="ih-builder-step"><span>01</span><h2>{t("siteBuilder.chooseYourLook", "Choose your look")}</h2></div>
          <div className="ih-builder-themes">
            {siteThemes.map(themeId => (
              <button
                key={themeId} type="button"
                className={`ih-builder-theme ih-builder-theme--${themeId} ${site.theme === themeId ? 'is-selected' : ''}`}
                style={{ background: profileMicrositeThemePalettes[themeId].background, color: profileMicrositeThemePalettes[themeId].ink, borderColor: profileMicrositeThemePalettes[themeId].accent }}
                aria-pressed={site.theme === themeId}
                onClick={() => setSite(current => ({ ...current, theme: themeId }))}
              >{themeId === 'spotlight' ? 'Spotlight' : themeId === 'paper' ? 'Paper' : 'Electric'}</button>
            ))}
          </div>

          <div className="ih-builder-step"><span>02</span><h2>{t("siteBuilder.writeAShortIntroduction", "Write a short introduction")}</h2></div>
          <label className="ih-builder-field" htmlFor="ih-builder-tagline">{t("siteBuilder.headlineOrTagline", "Headline or tagline")}</label>
          <input id="ih-builder-tagline" maxLength={180} value={site.tagline}
            onChange={e => setSite(current => ({ ...current, tagline: e.target.value }))}
            placeholder={t("siteBuilder.aNewSoundForThe", "A new sound for the next generation…")} />
          <small>{t("siteBuilder.leaveBlankToUseYour", "Leave blank to use your iHYPE profile headline.")}</small>

          <div className="ih-builder-step"><span>03</span><h2>{t("siteBuilder.chooseYourSections", "Choose your sections")}</h2></div>
          <div className="ih-builder-section-list">
            {sections.filter(s => !(profile.type === 'VENUE' && s.id === 'music')).map(section => (
              <label key={section.id} className="ih-builder-section">
                <input type="checkbox" checked={site.sections[section.id]}
                  onChange={e => updateSection(section.id, e.target.checked)} />
                <span><strong>{section.label}</strong><small>{section.help}</small></span>
              </label>
            ))}
          </div>
          <p className="ih-builder-note">{t("siteBuilder.photosMusicShowsAndMerchandise", "Photos, music, shows and merchandise reuse your iHYPE profile. Contact details stay hidden unless you explicitly turn them on.")}</p>
          <div className="ih-builder-save">
            <button disabled={busy || uploading} type="button" onClick={() => saveSite(false)}>{t("siteBuilder.saveDraftUnpublish", "Save draft / Unpublish")}</button>
            <button disabled={busy || uploading || profile.verificationStatus !== 'VERIFIED'} type="button"
              className="ih-builder-primary" onClick={() => saveSite(true)}>
              {site.published ? 'Save & keep published' : 'Publish website'}
            </button>
          </div>
          {profile.verificationStatus !== 'VERIFIED' && (
            <p className="ih-builder-note">{t("siteBuilder.youCanSaveAndCustomize", "You can save and customize right now. Ownership verification must be approved before publishing a public website.")}</p>
          )}
        </div>
        <aside className="ih-builder-preview" aria-label={t("siteBuilder.liveDesignPreview", "Live design preview")}>
          <div className="ih-builder-step"><span>PREVIEW</span><h2>{t("siteBuilder.yourOnepageWebsite", "Your one-page website")}</h2></div>
          <div className="ih-builder-preview-page" style={{ background: theme.background, color: theme.color }}>
            <div className="ih-builder-preview-hero" style={profile.heroImage ? { backgroundImage: `linear-gradient(0deg,#000b,#0007),url("${profile.heroImage}")` } : {}}>
              <strong className="ih-builder-preview-brand">iHYPE / {profile.type === 'ARTIST' ? 'Artist' : 'Venue'}</strong>
              <h3>{profile.name}</h3>
              <p>{site.tagline || profile.headline || 'Your music. Your story. Your stage.'}</p>
              <span className="ih-builder-preview-cta" style={{ background: theme.accent }}>{t("siteBuilder.explore", "Explore")}</span>
            </div>
            {sections.filter(s => site.sections[s.id] && !(profile.type === 'VENUE' && s.id === 'music')).map(s => (
              <div className="ih-builder-preview-section" key={s.id}>
                <strong>{s.label}</strong>
                <small>{s.id === 'about' ? (profile.bio || 'Your story and biography from iHYPE.') : s.help}</small>
              </div>
            ))}
            <div className="ih-builder-preview-foot">{t("siteBuilder.madeWithIHYPE", "Made with iHYPE")}</div>
          </div>
          <small>{t("siteBuilder.previewUpdatesImmediatelyPressSave", "Preview updates immediately. Press Save to keep changes.")}</small>
          {site.published && <a href={publicUrl} className="ih-builder-secondary" target="_blank" rel="noopener noreferrer">{t("siteBuilder.openPublishedWebsite", "Open published website ↗")}</a>}
        </aside>
      </div>

      <div className="ih-builder-video">
        <div className="ih-builder-step"><span>04</span><h2>{t("siteBuilder.uploadAndPublishVideos", "Upload and publish videos")}</h2></div>
        <p>{t("siteBuilder.upload1080pOrTrue4K", "Upload 1080p or true 4K directly to Mux. Viewers get adaptive playback; the optional original archive stays private in Cloudflare R2.")}</p>
        {!enabled ? (
          <p className="ih-builder-note" role="status">{t("siteBuilder.videoUploadsWillBeAvailable", "Video uploads will be available once iHYPE configures its Mux API token, webhook and spending caps. Your website builder is available now.")}</p>
        ) : (
          <div className="ih-builder-upload-form">
            <label className="ih-builder-field" htmlFor="ih-video-file">{t("siteBuilder.videoFileMaximum2GiB", "Video file (maximum 2 GiB during beta)")}</label>
            <input id="ih-video-file" type="file" accept="video/*" ref={fileRef} disabled={uploading}
              onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
            <label className="ih-builder-field" htmlFor="ih-video-quality">{t("siteBuilder.maximumPlaybackQuality", "Maximum playback quality")}</label>
            <select id="ih-video-quality" value={quality} disabled={uploading}
              onChange={e => setQuality(e.target.value as '1080p' | '2160p')}>
              <option value="1080p">{t("siteBuilder.1080pRecommendedLowerStorageCosts", "1080p (recommended, lower storage costs)")}</option>
              <option value="2160p">{t("siteBuilder.4K2160pHigherStorageAnd", "4K / 2160p (higher storage and delivery costs)")}</option>
            </select>
            {archiveEnabled && (
              <label className="ih-builder-section">
                <input type="checkbox" checked={archiveOriginal} disabled={uploading}
                  onChange={e => setArchiveOriginal(e.target.checked)} />
                <span><strong>{t("siteBuilder.saveAPrivateCopyTo", "Save a private copy to Cloudflare R2")}</strong>
                  <small>{t("siteBuilder.optionalArchivalDoublesUploadTraffic", "Optional archival doubles upload traffic and adds storage costs. Never publicly served.")}</small></span>
              </label>
            )}
            <label className="ih-builder-section">
              <input type="checkbox" checked={rightsConfirmed} disabled={uploading}
                onChange={e => setRightsConfirmed(e.target.checked)} />
              <span><strong>{t("siteBuilder.iHaveTheRightsAnd", "I have the rights and permission to upload this video")}</strong>
                <small>{t("siteBuilder.onlyUploadContentYouOwn", "Only upload content you own or are licensed to use; publish after review.")}</small></span>
            </label>
            <button type="button" className="ih-builder-primary" disabled={!selectedFile || !rightsConfirmed || uploading || busy}
              onClick={uploadVideo}>{uploading ? `Uploading… ${progress}%` : 'Upload video'}</button>
            {uploading && <progress value={progress} max={100} aria-label={t("siteBuilder.videoUploadProgress", "Video upload progress")} />}
          </div>
        )}

        <div className="ih-builder-step"><span>LIBRARY</span><h3>{t("siteBuilder.yourVideos", "Your videos")}</h3></div>
        <button type="button" className="ih-builder-secondary" onClick={() => loadVideos().catch(e => setError(String(e)))} disabled={uploading || busy}>{t("siteBuilder.refreshProcessingStatus", "Refresh processing status")}</button>
        {videos.length === 0 ? <p>{t("siteBuilder.noVideosYetPublishedVideos", "No videos yet. Published videos appear automatically on your one-page site.")}</p> : (
          <div className="ih-builder-video-list">
            {videos.map(video => (
              <div className="ih-builder-video-row" key={video.id}>
                <div>
                  <strong>{video.title}</strong>
                  <small>{video.quality === '2160p' ? '4K' : '1080p'} · {video.status.toLowerCase()} · {video.isPublished ? 'Public' : 'Private'}{video.archiveKey ? (video.archiveUploadId ? ' · R2 archive pending' : ' · R2 original') : ''}</small>
                </div>
                <div className="ih-builder-video-actions">
                  {video.status === 'READY' && (
                    <button type="button" disabled={busy || profile.verificationStatus !== 'VERIFIED'}
                      onClick={() => videoAction(video, video.isPublished ? 'unpublish' : 'publish')}>
                      {video.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                  )}
                  {video.archiveKey && !video.archiveUploadId && <a href={`/api/site-videos/archive?videoId=${video.id}`}>{t("siteBuilder.getOriginal", "Get original")}</a>}
                  {video.archiveUploadId && <button type="button" disabled={busy} onClick={() => discardArchive(video)}>{t("siteBuilder.discardUnfinishedArchive", "Discard unfinished archive")}</button>}
                  <button type="button" disabled={busy} onClick={() => videoAction(video, 'delete')}>{t("siteBuilder.delete", "Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
