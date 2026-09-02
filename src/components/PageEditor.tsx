'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  profileDesignPresets,
  profileAccentTones,
  profileBackdropTones,
  profileFontPresets,
  getProfileDesignPreset,
  getProfileAccentTone,
  getProfileBackdropTone,
} from '@/lib/profile-design';
import { parsePressKit, serializePressKit } from '@/lib/press-kit';
import { statOptionsForRole, type StatKey } from '@/lib/profile-stats-catalog';
import { MUSIC_GENRES } from '@/lib/genres';
import { useI18n } from '@/components/I18nProvider';
import { TrackUploadPanel } from '@/components/TrackUploadPanel';

type AvailabilityEntry = { id: string; date: string; note: string | null; kind?: 'TOUR' | 'AVAILABLE' };
type RecentHyper = { id: string; name: string; image: string | null; at: string };
/* Albums, the folder version (2026-09-02). See /api/albums. */
type AlbumRow = { id: string; title: string; artworkUrl: string | null; releasedOn: string | null; sortOrder: number; trackCount: number };
type TrackRow = { hexId: string; title: string; artworkUrl: string | null; albumId: string | null; createdAt: string };
/* One tile of the owner's stats board — see src/lib/profile-stat-board.ts.
   `value: null` is "could not read", rendered as a dash, never as 0. */
type StatBoardEntry = { key: string; label: string; hint: string; value: number | null };

type EditorProfile = {
  id: string;
  slug: string;
  type: string;
  name: string;
  pressKitContent: string | null;
  headline: string | null;
  bio: string | null;
  aboutContent: string | null;
  topFiveContent: string | null;
  mediaContent: string | null;
  nowPlaying: string | null;
  links: string | null;
  merchUrl: string | null;
  merchContent: string | null;
  tourContent: string | null;
  requestContent: string | null;
  upcomingContent: string | null;
  previousShowHighlights: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  hometown: string | null;
  members: string | null;
  contactInfo: string | null;
  capacity: number | null;
  hoursText: string | null;
  parkingDetails: string | null;
  stayRecommendations: string | null;
  heroImage: string | null;
  avatarImage: string | null;
  logoImage: string | null;
  galleryImage: string | null;
  themePreset: string | null;
  themeAccentTone: string | null;
  themeBackdropTone: string | null;
  themeFontPreset: string | null;
  fanShareEnabled: boolean | null;
  pinnedStats: string[];
};

/**
 * FOUR SECTIONS, AND WHICH FOUR DEPENDS ON THE TYPE.
 *
 * Set by the owner 2026-09-01 — "artist page too busy, we need to tone down
 * the customization", then the two shapes verbatim. What this replaced was one
 * seven-section list shared by every profile type and filtered down with
 * per-type conditions, which is how an artist ended up with Basics, About,
 * Media, Details, Press kit, Stats, Theme AND an AI tab: nothing in the
 * structure said what a section was FOR, so each new field found a home and
 * the page grew.
 *
 * Naming the sets per type is the fix. A venue's second section is Event Info
 * because that is what a venue publishes; an artist's is Media because that is
 * what an artist publishes. Neither has to carry the other's fields, and
 * "where does this new field go" now has an answer that can be wrong.
 *
 * A fan gets two. Fans have no catalogue, no room and no press kit, and the
 * old editor gave them a Theme tab and a Details tab that rendered nothing.
 */
const ARTIST_SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'media', label: 'Media' },
  { id: 'presskit', label: 'Press kit' },
  { id: 'stats', label: 'Stats' },
] as const;

const VENUE_SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'eventinfo', label: 'Event Info' },
  { id: 'contact', label: 'Contact' },
  { id: 'stats', label: 'Stats' },
] as const;

const FAN_SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'stats', label: 'Stats' },
] as const;

const SECTIONS = [
  ...ARTIST_SECTIONS,
  ...VENUE_SECTIONS,
  ...FAN_SECTIONS,
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

function sectionsForType(type: string): readonly { id: SectionId; label: string }[] {
  if (type === 'VENUE') return VENUE_SECTIONS;
  if (type === 'LISTENER') return FAN_SECTIONS;
  return ARTIST_SECTIONS;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--hair-100)', background: 'var(--hair-30)',
  color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '0 0 8px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function TextField({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return <input maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} type="text" value={value} />;
}

function TextAreaField({ value, onChange, placeholder, rows = 4, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number }) {
  return <textarea maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.5 }} value={value} />;
}

function ImageField({ label, value, onUpload, uploading }: { label: string; value: string | null; onUpload: (file: File) => void; uploading: boolean }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
          background: value ? `url(${value}) center/cover` : 'var(--hair-50)',
          border: '1px solid var(--hair-100)',
        }} />
        <div style={{ flex: 1 }}>
          <button
            className="settings-btn settings-btn-ghost"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {uploading ? t('pageEditor.imageUploading', 'Uploading…') : value ? t('pageEditor.imageReplace', 'Replace image') : t('pageEditor.imageUpload', 'Upload image')}
          </button>
          <input
            accept="image/jpeg,image/png,image/gif,image/webp"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
            ref={inputRef}
            type="file"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The Creator editing surface — turns the existing, previously-unused
 * /api/profile-editor endpoint into a real mobile-first editor covering
 * every field it accepts, plus the (also previously dormant) theme preset
 * system from profile-design.ts. Grouped into pill sub-tabs rather than one
 * long form since the full field set is large; role-specific fields
 * (tour dates vs. venue hours) only show for the relevant profile type.
 */
export function PageEditor({ profileId, initialSection }: { profileId: string; initialSection?: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<EditorProfile | null>(null);
  /* 'about' is the new front door — 'basics' is gone, and a deep link naming a
     retired section (?editor=theme from a bookmark or an old email) must land
     somewhere real rather than on a blank pane. Whether the named section is
     valid FOR THIS TYPE is settled below, once the profile has loaded and its
     type is known. */
  const resolvedInitialSection = SECTIONS.some((item) => item.id === initialSection)
    ? initialSection as SectionId
    : 'about';
  const [section, setSection] = useState<SectionId>(resolvedInitialSection);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  // Press kit sub-form: friendly text fields serialized into the single
  // pressKitContent JSON column on every change.
  const [kitTagline, setKitTagline] = useState('');
  const [kitQuotesText, setKitQuotesText] = useState('');
  const [kitAchievementsText, setKitAchievementsText] = useState('');
  const [kitContactEmail, setKitContactEmail] = useState('');
  // Genre tags — a separate endpoint (/api/profile/genre) from the batch
  // profile-editor save, so it gets its own save button/state below.
  const [genresText, setGenresText] = useState('');
  const [genresSaving, setGenresSaving] = useState(false);
  const [genresSavedAt, setGenresSavedAt] = useState<number | null>(null);
  const [genresError, setGenresError] = useState<string | null>(null);
  // Booking availability — /api/profile/availability manages its own list
  // of dates independently (add/remove), not part of the batch save either.
  const [availDates, setAvailDates] = useState<AvailabilityEntry[]>([]);
  const [availDateInput, setAvailDateInput] = useState('');
  const [availNoteInput, setAvailNoteInput] = useState('');
  /* Which kind the add form will write. TOUR first because the calendar's
     headline use is "where am I playing" — booking availability is the
     secondary meaning that happened to be here first. */
  const [availKindInput, setAvailKindInput] = useState<'TOUR' | 'AVAILABLE'>('TOUR');
  const [availSaving, setAvailSaving] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  // Recent activity — read-only feed from /api/profile/activity (who hyped
  // this profile recently); there's nothing to edit, just to show.
  const [hypers, setHypers] = useState<RecentHyper[] | null>(null);
  // The stats board — fixed real counts for artists and venues, from
  // /api/profile/stats. `null` while loading; 'unavailable' when the request
  // failed or the type has no board (a fan's Stats is the picker below).
  const [statBoard, setStatBoard] = useState<StatBoardEntry[] | null | 'unavailable'>(null);
  // Albums and the tracks they hold — /api/albums and /api/artist-media, both
  // owner-gated, both refreshed after an upload or a folder change.
  const [albums, setAlbums] = useState<AlbumRow[] | null>(null);
  const [tracks, setTracks] = useState<TrackRow[] | null>(null);
  const [albumTitleInput, setAlbumTitleInput] = useState('');
  const [albumDateInput, setAlbumDateInput] = useState('');
  const [albumBusy, setAlbumBusy] = useState<string | null>(null);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const albumArtInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadMedia = useCallback(() => {
    fetch(`/api/albums?profileId=${profileId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.albums) setAlbums(d.albums); })
      .catch(() => {});
    fetch(`/api/artist-media?profileId=${profileId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tracks) setTracks(d.tracks); })
      .catch(() => {});
  }, [profileId]);

  useEffect(() => {
    setSection(resolvedInitialSection);
  }, [resolvedInitialSection]);

  useEffect(() => {
    setData(null);
    fetch(`/api/profile-editor?profileId=${profileId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setData(d.profile);
        const kit = parsePressKit(d.profile?.pressKitContent);
        setKitTagline(kit.tagline);
        setKitQuotesText(kit.quotes.map((q) => (q.source ? `${q.quote} — ${q.source}` : q.quote)).join('\n'));
        setKitAchievementsText(kit.achievements.join('\n'));
        setKitContactEmail(kit.contactEmail);
        // Genre isn't part of EDITOR_FIELDS, so pull the current value from
        // the public profile route (already cached/wired) to prefill the field.
        if (d.profile?.slug) {
          fetch(`/api/profile/${d.profile.slug}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((pd) => {
              const genres = pd?.profile?.genres;
              if (Array.isArray(genres)) setGenresText(genres.join(', '));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [profileId]);

  useEffect(() => {
    fetch(`/api/profile/availability?profileId=${profileId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.dates) setAvailDates(d.dates); })
      .catch(() => {});
  }, [profileId]);

  useEffect(() => {
    setAlbums(null);
    setTracks(null);
    loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    setStatBoard(null);
    fetch(`/api/profile/stats?profileId=${profileId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatBoard(Array.isArray(d?.stats) ? d.stats : 'unavailable'))
      .catch(() => setStatBoard('unavailable'));
  }, [profileId]);

  useEffect(() => {
    fetch('/api/profile/activity')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.hypers) setHypers(d.hypers); })
      .catch(() => {});
  }, [profileId]);

  async function saveGenres() {
    setGenresSaving(true);
    setGenresError(null);
    try {
      const genres = genresText.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 10);
      const res = await fetch('/api/profile/genre', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, genre: genresText.trim().slice(0, 50), genres }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setGenresError(d.error ?? t('pageEditor.saveGenresFailed', 'Failed to save genres.'));
      } else {
        setGenresSavedAt(Date.now());
      }
    } catch {
      setGenresError(t('pageEditor.networkError', 'Network error — try again.'));
    } finally {
      setGenresSaving(false);
    }
  }

  async function addAvailabilityDate() {
    if (!availDateInput || availSaving) return;
    setAvailSaving(true);
    setAvailError(null);
    try {
      const res = await fetch('/api/profile/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          date: new Date(availDateInput).toISOString(),
          note: availNoteInput.trim() || undefined,
          kind: availKindInput,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvailError(d.error ?? t('pageEditor.addDateFailed', 'Could not add that date.'));
      } else {
        setAvailDates((prev) => [...prev, d.date].sort((a, b) => a.date.localeCompare(b.date)));
        setAvailDateInput('');
        setAvailNoteInput('');
      }
    } catch {
      setAvailError(t('pageEditor.networkError', 'Network error — try again.'));
    } finally {
      setAvailSaving(false);
    }
  }

  async function removeAvailabilityDate(id: string) {
    setAvailError(null);
    try {
      const res = await fetch('/api/profile/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setAvailDates((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setAvailError(t('pageEditor.networkError', 'Network error — try again.'));
    }
  }

  function set<K extends keyof EditorProfile>(key: K, value: EditorProfile[K]) {
    setData((d) => (d ? { ...d, [key]: value } : d));
    setSavedAt(null);
  }

  function updatePressKit(next: Partial<{ tagline: string; quotesText: string; achievementsText: string; contactEmail: string }>) {
    const tagline = next.tagline ?? kitTagline;
    const quotesText = next.quotesText ?? kitQuotesText;
    const achievementsText = next.achievementsText ?? kitAchievementsText;
    const contactEmail = next.contactEmail ?? kitContactEmail;
    if (next.tagline !== undefined) setKitTagline(next.tagline);
    if (next.quotesText !== undefined) setKitQuotesText(next.quotesText);
    if (next.achievementsText !== undefined) setKitAchievementsText(next.achievementsText);
    if (next.contactEmail !== undefined) setKitContactEmail(next.contactEmail);

    const quotes = quotesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const sep = line.lastIndexOf(' — ');
        return sep > 0
          ? { quote: line.slice(0, sep).trim(), source: line.slice(sep + 3).trim() }
          : { quote: line, source: '' };
      });
    const achievements = achievementsText.split('\n').map((line) => line.trim()).filter(Boolean);
    set('pressKitContent', serializePressKit({ tagline, quotes, achievements, contactEmail }));
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile-editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, ...data }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t('pageEditor.saveFailed', 'Failed to save.'));
      } else {
        setSavedAt(Date.now());
      }
    } catch {
      setError(t('pageEditor.networkError', 'Network error — try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function albumRequest(path: string, init: RequestInit, busyKey: string) {
    setAlbumBusy(busyKey);
    setAlbumError(null);
    try {
      const res = await fetch(path, init);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setAlbumError(d.error ?? t('pageEditor.albumRequestFailed', 'Could not save that change.'));
        return false;
      }
      loadMedia();
      return true;
    } catch {
      setAlbumError(t('pageEditor.albumRequestFailed', 'Could not save that change.'));
      return false;
    } finally {
      setAlbumBusy(null);
    }
  }

  async function createAlbum() {
    const title = albumTitleInput.trim();
    if (!title) return;
    const ok = await albumRequest('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, title, ...(albumDateInput ? { releasedOn: albumDateInput } : {}) }),
    }, 'create');
    if (ok) { setAlbumTitleInput(''); setAlbumDateInput(''); }
  }

  async function uploadAlbumArt(albumId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    await albumRequest(`/api/albums/${albumId}/artwork`, { method: 'POST', body: formData }, `art:${albumId}`);
  }

  async function uploadImage(field: 'heroImage' | 'avatarImage' | 'logoImage' | 'galleryImage', file: File) {
    setUploadingField(field);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('field', field);
      /* Say WHICH page this image is for. Every other call in this component
         already sends `profileId`; this one did not, and the route answered by
         picking one of the member's profiles arbitrarily — so a member who
         owns both an artist and a venue page could set their band photo and
         watch it appear on the venue instead. */
      formData.append('profileId', profileId);
      const res = await fetch('/api/profile/upload-graphic', { method: 'POST', body: formData });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t('pageEditor.uploadFailed', 'Upload failed.'));
        return;
      }
      const d = await res.json();
      set(field, d.url);
      setSavedAt(Date.now());
    } catch {
      setError(t('pageEditor.uploadFailedRetry', 'Upload failed — try again.'));
    } finally {
      setUploadingField(null);
    }
  }

  /* THERE IS NO AI IN THIS EDITOR ANY MORE, and it is not coming back by
     halves. Whole-page generation went first (2026-08-08, Design System 8):
     it cost tokens on every page and still produced pages that had to be
     hand-edited into a common shape. The two survivors — "refine" and
     "import from your website" — went 2026-09-01 by owner instruction:
     "ditch AI page editor for artists and venues - we're going to go more
     streamlined to save time and storage space."

     The reasoning that kept them ("they only edit content the member already
     supplied") was about safety, never about whether they earned their place.
     They were an eighth section on an editor the owner has called too busy,
     a per-keystroke inference cost, and a second way to write the same fields
     the form already writes. `/api/page-builder/refine` and
     `/api/page-builder/import-website` are deleted with them; the profile is
     a fixed per-type schema filled in by hand. */

  if (!data) {
    return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-a65)' }}>{t('pageEditor.loadingPage', 'Loading your page…')}</div>;
  }

  const isVenue = data.type === 'VENUE';
  const isFan = data.type === 'LISTENER';
  const isArtistOrDj = data.type === 'ARTIST';

  /* The type decides the set, and a section outside it falls back to the first
     one rather than rendering an empty pane. That matters because the sets no
     longer overlap: a venue has no Media and an artist has no Contact, so
     ?editor=media on a venue used to be reachable and blank. */
  const visibleSections = sectionsForType(data.type);
  const activeSection: SectionId = visibleSections.some((item) => item.id === section)
    ? section
    : visibleSections[0].id;

  const preset = getProfileDesignPreset(data.themePreset);
  const accentTone = getProfileAccentTone(data.themeAccentTone);
  const backdropTone = getProfileBackdropTone(data.themeBackdropTone);

  return (
    <div>
      <div className="page-editor-tabstrip" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {visibleSections.map((s) => (
          <button
            key={s.id}
            className={section === s.id ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setSection(s.id)}
            type="button"
          >
            {t(`pageEditor.sectionLabel.${s.id}`, s.label)}
          </button>
        ))}
      </div>

      {activeSection === 'about' && (
        <div className="sub-panel">
          <Field label={t('pageEditor.nameLabel', 'Name')}><TextField maxLength={120} onChange={(v) => set('name', v)} value={data.name} /></Field>
          <Field hint={t('pageEditor.headlineHint', 'A short one-liner shown near your name')} label={t('pageEditor.headlineLabel', 'Headline')}>
            <TextField maxLength={180} onChange={(v) => set('headline', v ?? '')} placeholder={t('pageEditor.headlinePlaceholder', 'e.g. Indie rock from Portland')} value={data.headline ?? ''} />
          </Field>

          {isArtistOrDj && (
            <>
              <Field hint={t('pageEditor.genresHint', 'Comma-separated — shown on your public page and used for discovery')} label={t('pageEditor.genresLabel', 'Genre')}>
                <input
                  list="ihype-editor-genre-suggestions"
                  onChange={(e) => { setGenresText(e.target.value); setGenresSavedAt(null); }}
                  placeholder={t('pageEditor.genresPlaceholder', 'dream-pop, shoegaze, lo-fi')}
                  style={inputStyle}
                  type="text"
                  value={genresText}
                />
                <datalist id="ihype-editor-genre-suggestions">
                  {MUSIC_GENRES.map((g) => <option key={g} value={g} />)}
                </datalist>
                {/* Genres save through their own endpoint, so they keep their own
                    button — "Save changes" at the bottom does not carry them. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <button className="settings-btn settings-btn-ghost" disabled={genresSaving} onClick={saveGenres} type="button">
                    {genresSaving ? t('pageEditor.saving', 'Saving…') : t('pageEditor.saveGenres', 'Save genres')}
                  </button>
                  {genresError && <span style={{ color: 'var(--accent-text)', fontSize: '0.9375rem' }}>{genresError}</span>}
                  {genresSavedAt && !genresError && <span style={{ color: 'var(--role-venue)', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}>✓ {t('pageEditor.saved', 'Saved')}</span>}
                </div>
              </Field>
              <Field hint={t('pageEditor.originHint', 'Where the act is from — shown on your page and used for local discovery')} label={t('pageEditor.originLabel', 'Origin')}>
                <TextField maxLength={120} onChange={(v) => set('hometown', v)} placeholder={t('pageEditor.originPlaceholder', 'Portland, ME')} value={data.hometown ?? ''} />
              </Field>
            </>
          )}

          <Field label={t('pageEditor.bioLabel', 'Bio')}><TextAreaField maxLength={1000} onChange={(v) => set('bio', v)} rows={3} value={data.bio ?? ''} /></Field>

          {isArtistOrDj && (
            <Field hint={t('pageEditor.membersHint', 'One per line — name, then instrument if you want')} label={t('pageEditor.membersLabel', 'Members')}>
              <TextAreaField maxLength={2000} onChange={(v) => set('members', v)} placeholder={t('pageEditor.membersPlaceholder', 'Sam Reyes — vocals, guitar\nJo Okafor — bass')} rows={4} value={data.members ?? ''} />
            </Field>
          )}

          {isVenue && (
            <Field hint={t('pageEditor.capacityHint', 'Maximum room size — one event can still be capped lower')} label={t('pageEditor.capacityLabel', 'Capacity')}>
              {/* capacity is an Int on Profile and the editor schema rejects a
                  string, so the digits are parsed here rather than shipped raw.
                  An emptied field means "not stated", which is null, not 0 — a
                  venue with capacity 0 is a closed room. */}
              <TextField
                maxLength={6}
                onChange={(v) => {
                  const digits = v.replace(/[^0-9]/g, '');
                  set('capacity', digits === '' ? null : Number(digits));
                }}
                placeholder="250"
                value={data.capacity == null ? '' : String(data.capacity)}
              />
            </Field>
          )}

          <Field label={t('pageEditor.linksLabel', 'Links')} hint={t('pageEditor.linksHint', 'One per line — website, socials, streaming')}>
            <TextAreaField maxLength={5000} onChange={(v) => set('links', v)} rows={3} value={data.links ?? ''} />
          </Field>

          <Field hint={t('pageEditor.aboutHint', 'The main story on your page — as long as you want')} label={t('pageEditor.aboutLabel', 'About')}>
            <TextAreaField maxLength={5000} onChange={(v) => set('aboutContent', v)} rows={8} value={data.aboutContent ?? ''} />
          </Field>

          {isVenue && (
            <>
              <ImageField label={t('pageEditor.logoLabel', 'Logo')} onUpload={(f) => uploadImage('logoImage', f)} uploading={uploadingField === 'logoImage'} value={data.logoImage} />
              <ImageField label={t('pageEditor.heroBannerLabel', 'Hero banner')} onUpload={(f) => uploadImage('heroImage', f)} uploading={uploadingField === 'heroImage'} value={data.heroImage} />
              <ImageField label={t('pageEditor.galleryCoverLabel', 'Room photo')} onUpload={(f) => uploadImage('galleryImage', f)} uploading={uploadingField === 'galleryImage'} value={data.galleryImage} />
            </>
          )}

          {/* ── The tour calendar ──────────────────────────────────────────
              One calendar, two kinds of date. Both are AvailabilityDate rows
              distinguished by `kind`, because "a date with a note on this
              artist's calendar" is one shape whether the artist is playing
              that night or free to be booked that night. A second model would
              have duplicated the table, the ownership check and the route to
              change one string.

              The old free-text `tourContent` textarea is gone: a paragraph of
              dates cannot be sorted, cannot expire, and cannot be read by
              anything but a human. */}
          {isArtistOrDj && (
            <div id="tour-creator" className="page-editor-anchor-target">
              <Field
                hint={t('pageEditor.tourCalendarHint', 'Dates you are playing, and dates you are open to be booked. Shows ticketed on iHYPE appear on your page automatically — add the ones that are not.')}
                label={t('pageEditor.tourCalendarLabel', 'Tour calendar')}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(['TOUR', 'AVAILABLE'] as const).map((kind) => (
                    <button
                      key={kind}
                      aria-pressed={availKindInput === kind}
                      className={availKindInput === kind ? 'sub-tab active' : 'sub-tab'}
                      onClick={() => setAvailKindInput(kind)}
                      type="button"
                    >
                      {kind === 'TOUR'
                        ? t('pageEditor.tourDateKind', 'Playing')
                        : t('pageEditor.availableDateKind', 'Open to book')}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <input
                    onChange={(e) => setAvailDateInput(e.target.value)}
                    style={{ ...inputStyle, flex: '1 1 160px' }}
                    type="date"
                    value={availDateInput}
                  />
                  <input
                    maxLength={200}
                    onChange={(e) => setAvailNoteInput(e.target.value)}
                    placeholder={availKindInput === 'TOUR'
                      ? t('pageEditor.tourNotePlaceholder', 'Venue, city')
                      : t('pageEditor.noteOptionalPlaceholder', 'Note (optional)')}
                    style={{ ...inputStyle, flex: '2 1 200px' }}
                    type="text"
                    value={availNoteInput}
                  />
                  <button
                    className="settings-btn settings-btn-ghost"
                    disabled={availSaving || !availDateInput}
                    onClick={addAvailabilityDate}
                    style={{ flexShrink: 0 }}
                    type="button"
                  >
                    {availSaving ? t('pageEditor.adding', 'Adding…') : t('pageEditor.addDate', 'Add date')}
                  </button>
                </div>
                {availError && <p style={{ color: 'var(--accent-text)', fontSize: '0.9375rem', margin: '0 0 10px' }}>{availError}</p>}
                {availDates.length === 0 ? (
                  <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: 0 }}>{t('pageEditor.noDatesYet', 'No dates added yet.')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {availDates.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          padding: '10px 12px', borderRadius: 10, border: '1px solid var(--hair-100)',
                          background: 'var(--hair-30)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.9375rem', color: 'var(--ink)', fontWeight: 600 }}>
                              {new Date(d.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            {/* A row whose kind is missing is a pre-`kind` row, and
                                the column defaults to AVAILABLE, so that is what it
                                is labelled rather than guessed at. */}
                            <span style={{
                              /* Mono eyebrow at .18em, matching the others in this
                                 file: DS8 exempts the tracked mono scale from the
                                 15px floor only at >= .14em, and lint enforces it. */
                              fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em',
                              textTransform: 'uppercase', color: 'var(--ink-a65)',
                            }}>
                              {d.kind === 'TOUR'
                                ? t('pageEditor.tourDateKind', 'Playing')
                                : t('pageEditor.availableDateKind', 'Open to book')}
                            </span>
                          </div>
                          {d.note && <div style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)' }}>{d.note}</div>}
                        </div>
                        <button
                          className="settings-btn settings-btn-ghost"
                          onClick={() => removeAvailabilityDate(d.id)}
                          style={{ padding: '6px 12px', fontSize: '0.9375rem' }}
                          type="button"
                        >
                          {t('pageEditor.remove', 'Remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          )}

          {isFan && (
            <>
              <Field hint={t('pageEditor.topFiveHint', 'One item per line')} label={t('pageEditor.topFiveLabel', 'Top 5')}>
                <TextAreaField maxLength={2000} onChange={(v) => set('topFiveContent', v)} rows={5} value={data.topFiveContent ?? ''} />
              </Field>
              <Field label={t('pageEditor.nowPlayingLabel', 'Now playing / current mood')}><TextField maxLength={240} onChange={(v) => set('nowPlaying', v)} value={data.nowPlaying ?? ''} /></Field>
            </>
          )}
        </div>
      )}

      {activeSection === 'media' && isArtistOrDj && (
        <div className="sub-panel">
          {/* Songs upload lived on the PUBLIC artist page's Tracks tab and
              nowhere in the editor, so the one section named Media held four
              image slots and no music. TrackUploadPanel is the same component,
              mounted where an owner looks for it. */}
          <TrackUploadPanel onUploaded={loadMedia} profileId={profileId} />

          {/* ── Albums ─────────────────────────────────────────────────
              A folder with a title, a date and one cover; tracks are filed
              into it from the list below. A track with its own cover keeps
              it, a track without one shows the album's — the artist's
              choice, per graphic (owner, 2026-09-02). */}
          <div id="albums" style={{ marginTop: 26 }}>
            <Field
              hint={t('pageEditor.albumsHint', 'Group your tracks. Give the album one cover, or give each track its own — either works.')}
              label={t('pageEditor.albumsLabel', 'Albums')}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input
                  maxLength={120}
                  onChange={(e) => setAlbumTitleInput(e.target.value)}
                  placeholder={t('pageEditor.albumTitlePlaceholder', 'Album title')}
                  style={{ ...inputStyle, flex: '2 1 200px' }}
                  type="text"
                  value={albumTitleInput}
                />
                <input
                  onChange={(e) => setAlbumDateInput(e.target.value)}
                  style={{ ...inputStyle, flex: '1 1 160px' }}
                  title={t('pageEditor.albumReleaseDate', 'Release date (optional)')}
                  type="date"
                  value={albumDateInput}
                />
                <button
                  className="settings-btn settings-btn-ghost"
                  disabled={albumBusy !== null || !albumTitleInput.trim()}
                  onClick={createAlbum}
                  style={{ flexShrink: 0 }}
                  type="button"
                >
                  {albumBusy === 'create' ? t('pageEditor.creating', 'Creating…') : t('pageEditor.createAlbum', 'Create album')}
                </button>
              </div>
              {albumError && <p style={{ color: 'var(--accent-text)', fontSize: '0.9375rem', margin: '0 0 10px' }}>{albumError}</p>}
              {albums === null ? (
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: 0 }}>{t('pageEditor.loading', 'Loading…')}</p>
              ) : albums.length === 0 ? (
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: 0 }}>{t('pageEditor.noAlbumsYet', 'No albums yet. Tracks without one list as singles.')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {albums.map((album) => (
                    <div
                      key={album.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        borderRadius: 10, border: '1px solid var(--hair-100)', background: 'var(--hair-30)',
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                        background: album.artworkUrl ? `url(${album.artworkUrl}) center/cover` : 'var(--hair-50)',
                        border: '1px solid var(--hair-100)',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input
                          aria-label={t('pageEditor.albumTitleLabel', 'Album title')}
                          defaultValue={album.title}
                          maxLength={120}
                          onBlur={(e) => {
                            const title = e.target.value.trim();
                            if (title && title !== album.title) {
                              void albumRequest(`/api/albums/${album.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }, `title:${album.id}`);
                            }
                          }}
                          style={{ ...inputStyle, padding: '8px 10px' }}
                          type="text"
                        />
                        <div style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', marginTop: 4 }}>
                          {[
                            album.releasedOn ?? null,
                            `${album.trackCount} ${album.trackCount === 1 ? t('pageEditor.trackSingular', 'track') : t('pageEditor.trackPlural', 'tracks')}`,
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <input
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        hidden
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAlbumArt(album.id, f); e.target.value = ''; }}
                        ref={(el) => { albumArtInputs.current[album.id] = el; }}
                        type="file"
                      />
                      <button
                        className="settings-btn settings-btn-ghost"
                        disabled={albumBusy !== null}
                        onClick={() => albumArtInputs.current[album.id]?.click()}
                        type="button"
                      >
                        {albumBusy === `art:${album.id}` ? t('pageEditor.uploading', 'Uploading…') : album.artworkUrl ? t('pageEditor.replaceCover', 'Replace cover') : t('pageEditor.addCover', 'Add cover')}
                      </button>
                      <button
                        aria-label={t('pageEditor.deleteAlbum', 'Delete album')}
                        className="settings-btn settings-btn-ghost"
                        disabled={albumBusy !== null}
                        onClick={() => { void albumRequest(`/api/albums/${album.id}`, { method: 'DELETE' }, `delete:${album.id}`); }}
                        title={t('pageEditor.deleteAlbumHint', 'Deletes the folder. Its tracks stay up as singles.')}
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Field>

            {tracks !== null && tracks.length > 0 && (
              <Field
                hint={t('pageEditor.trackAlbumsHint', 'Which album each track sits in. Leave it blank for a single.')}
                label={t('pageEditor.tracksLabel', 'Tracks')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tracks.map((track) => (
                    <div
                      key={track.hexId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 10, border: '1px solid var(--hair-100)', background: 'var(--hair-30)',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
                        background: (track.artworkUrl ?? albums?.find((a) => a.id === track.albumId)?.artworkUrl)
                          ? `url(${track.artworkUrl ?? albums?.find((a) => a.id === track.albumId)?.artworkUrl}) center/cover`
                          : 'var(--hair-50)',
                        border: '1px solid var(--hair-100)',
                      }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</span>
                      <select
                        aria-label={t('pageEditor.trackAlbumLabel', 'Album')}
                        disabled={albumBusy !== null || !albums}
                        onChange={(e) => {
                          const albumId = e.target.value || null;
                          void albumRequest(`/api/artist-media/${track.hexId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ albumId }) }, `track:${track.hexId}`);
                        }}
                        style={{ ...inputStyle, width: 'auto', padding: '8px 10px' }}
                        value={track.albumId ?? ''}
                      >
                        <option value="">{t('pageEditor.singleOption', 'Single')}</option>
                        {(albums ?? []).map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </Field>
            )}
          </div>

          <div style={{ marginTop: 22 }}>
            <ImageField label={t('pageEditor.avatarLabel', 'Avatar')} onUpload={(f) => uploadImage('avatarImage', f)} uploading={uploadingField === 'avatarImage'} value={data.avatarImage} />
            <ImageField label={t('pageEditor.logoLabel', 'Logo')} onUpload={(f) => uploadImage('logoImage', f)} uploading={uploadingField === 'logoImage'} value={data.logoImage} />
            <ImageField label={t('pageEditor.heroBannerLabel', 'Hero banner')} onUpload={(f) => uploadImage('heroImage', f)} uploading={uploadingField === 'heroImage'} value={data.heroImage} />
            <ImageField label={t('pageEditor.galleryCoverLabel', 'Gallery cover')} onUpload={(f) => uploadImage('galleryImage', f)} uploading={uploadingField === 'galleryImage'} value={data.galleryImage} />
          </div>
        </div>
      )}

      {activeSection === 'eventinfo' && isVenue && (
        <div className="sub-panel">
          <Field label={t('pageEditor.addressLabel', 'Address')}><TextField maxLength={240} onChange={(v) => set('addressLine1', v)} value={data.addressLine1 ?? ''} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('pageEditor.cityLabel', 'City')}><TextField maxLength={120} onChange={(v) => set('city', v)} value={data.city ?? ''} /></Field>
            <Field label={t('pageEditor.stateLabel', 'State')}><TextField maxLength={120} onChange={(v) => set('stateRegion', v)} value={data.stateRegion ?? ''} /></Field>
            <Field label={t('pageEditor.postalCodeLabel', 'Postal code')}><TextField maxLength={40} onChange={(v) => set('postalCode', v)} value={data.postalCode ?? ''} /></Field>
            <Field label={t('pageEditor.countryLabel', 'Country')}><TextField maxLength={80} onChange={(v) => set('country', v)} value={data.country ?? ''} /></Field>
          </div>
          <Field label={t('pageEditor.hoursLabel', 'Hours')}><TextAreaField maxLength={500} onChange={(v) => set('hoursText', v)} rows={3} value={data.hoursText ?? ''} /></Field>
          <Field label={t('pageEditor.parkingDetailsLabel', 'Parking details')}><TextAreaField maxLength={1000} onChange={(v) => set('parkingDetails', v)} rows={3} value={data.parkingDetails ?? ''} /></Field>
          <Field label={t('pageEditor.stayRecommendationsLabel', 'Stay recommendations')}><TextAreaField maxLength={1000} onChange={(v) => set('stayRecommendations', v)} rows={3} value={data.stayRecommendations ?? ''} /></Field>
        </div>
      )}

      {activeSection === 'contact' && isVenue && (
        <div className="sub-panel">
          <Field
            hint={t('pageEditor.contactInfoHint', 'How artists and bookers reach you — email, phone, or whoever handles booking')}
            label={t('pageEditor.contactInfoLabel', 'Booking contact')}
          >
            <TextAreaField maxLength={1000} onChange={(v) => set('contactInfo', v)} placeholder={t('pageEditor.contactInfoPlaceholder', 'booking@yourvenue.com')} rows={4} value={data.contactInfo ?? ''} />
          </Field>
        </div>
      )}

      {activeSection === 'presskit' && isArtistOrDj && (
        <div className="sub-panel">
          <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '0 0 16px', lineHeight: 1.55 }}>
            {t('pageEditor.pressKitIntro', 'Your press kit is a shareable one-pager for bookers, venues, and press — it pulls your name, bio, photos, and upcoming shows automatically, plus everything you add here.')}
          </p>
          <Field hint={t('pageEditor.taglineHint', 'One punchy line describing your act, shown at the top of your press kit')} label={t('pageEditor.taglineLabel', 'Tagline')}>
            <TextField maxLength={200} onChange={(v) => updatePressKit({ tagline: v })} placeholder={t('pageEditor.taglinePlaceholder', 'e.g. High-voltage synth-punk from Portland, ME')} value={kitTagline} />
          </Field>
          <Field hint={t('pageEditor.pressQuotesHint', 'One per line, quote first: The best live act in Maine — Portland Phoenix')} label={t('pageEditor.pressQuotesLabel', 'Press quotes')}>
            <TextAreaField maxLength={4000} onChange={(v) => updatePressKit({ quotesText: v })} placeholder={'Their set stole the whole festival — Dispatch Magazine\nA must-see live act — WCYY'} rows={4} value={kitQuotesText} />
          </Field>
          <Field hint={t('pageEditor.achievementsHint', 'One per line — festival slots, chart placements, radio play, notable supports')} label={t('pageEditor.achievementsLabel', 'Achievements & highlights')}>
            <TextAreaField maxLength={4000} onChange={(v) => updatePressKit({ achievementsText: v })} placeholder={'Opened for [headliner], 2026\n#1 on WMPG local charts'} rows={4} value={kitAchievementsText} />
          </Field>
          <Field hint={t('pageEditor.bookingContactHint', 'Where bookers and press should reach you')} label={t('pageEditor.bookingContactLabel', 'Booking / press contact email')}>
            <TextField maxLength={200} onChange={(v) => updatePressKit({ contactEmail: v })} placeholder="booking@yourdomain.com" value={kitContactEmail} />
          </Field>
          <a
            className="settings-btn settings-btn-ghost"
            href={`/artists/${data.slug}/epk`}
            rel="noreferrer"
            style={{ display: 'inline-block' }}
            target="_blank"
          >
            {t('pageEditor.viewPressKit', 'View press kit ↗')}
          </a>
          <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '10px 0 0' }}>
            {t('pageEditor.pressKitSaveNote', 'Save your changes first — the press kit page prints cleanly to PDF for sharing.')}
          </p>
        </div>
      )}

      {activeSection === 'stats' && (
        <div className="sub-panel">
          {/* Two Stats sections in one slot. A FAN keeps the "pin up to 4"
              picker, because /app/fans/[slug] renders the pinned tiles and
              that is where the choice shows. An ARTIST or VENUE gets the fixed
              board the owner specified (2026-09-01): the artist page never
              rendered pinned tiles, so the picker there chose for nobody. */}
          {isFan ? (
            <>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '0 0 16px', lineHeight: 1.55 }}>
                {t('pageEditor.statsIntro', 'Pick up to 4 real stats to show on your public page. These are the same numbers already shown in your Insights tab — nothing here is estimated or made up.')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statOptionsForRole(data.type).map((opt) => {
                  const checked = data.pinnedStats.includes(opt.key);
                  const atLimit = data.pinnedStats.length >= 4;
                  return (
                    <label
                      key={opt.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        borderRadius: 10, border: '1px solid var(--hair-100)',
                        background: checked ? 'var(--hair-50)' : 'transparent',
                        cursor: !checked && atLimit ? 'not-allowed' : 'pointer',
                        opacity: !checked && atLimit ? 0.5 : 1,
                      }}
                    >
                      <input
                        checked={checked}
                        disabled={!checked && atLimit}
                        onChange={(e) => {
                          const key = opt.key as StatKey;
                          if (e.target.checked) {
                            if (!atLimit) set('pinnedStats', [...data.pinnedStats, key]);
                          } else {
                            set('pinnedStats', data.pinnedStats.filter((k) => k !== key));
                          }
                        }}
                        type="checkbox"
                      />
                      <span style={{ fontSize: '0.9375rem', color: 'var(--ink)' }}>{t(`pageEditor.statOption.${opt.key}`, opt.label)}</span>
                    </label>
                  );
                })}
              </div>
              {data.pinnedStats.length >= 4 && (
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '10px 0 0' }}>
                  {t('pageEditor.statsLimitReached', '4 selected — uncheck one to swap it for another.')}
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: '0 0 16px', lineHeight: 1.55 }}>
                {t('pageEditor.statBoardIntro', 'Real counts from your profile. Nothing here is estimated — a dash means a number could not be read just now.')}
              </p>
              {statBoard === null ? (
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: 0 }}>{t('pageEditor.loading', 'Loading…')}</p>
              ) : statBoard === 'unavailable' ? (
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: 0 }}>{t('pageEditor.statBoardUnavailable', 'Stats could not be loaded. Reload to try again.')}</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                  {statBoard.map((stat) => (
                    <div
                      key={stat.key}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px',
                        borderRadius: 10, border: '1px solid var(--hair-100)', background: 'var(--hair-30)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3125rem', color: 'var(--ink)' }}>
                        {stat.value === null ? '—' : stat.value.toLocaleString()}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em',
                        textTransform: 'uppercase', color: 'var(--ink-a65)',
                      }}>
                        {t(`pageEditor.statBoard.${stat.key}`, stat.label)}
                      </span>
                      <span style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)' }}>
                        {t(`pageEditor.statBoardHint.${stat.key}`, stat.hint)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--hair-100)' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em', textTransform: 'uppercase',
              color: 'var(--ink-a65)', marginBottom: 12,
            }}>
              {t('pageEditor.recentActivityLabel', 'RECENT ACTIVITY')}
            </div>
            {hypers === null ? (
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: 0 }}>{t('pageEditor.loading', 'Loading…')}</p>
            ) : hypers.length === 0 ? (
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', margin: 0 }}>{t('pageEditor.noHypesYet', "No hypes yet — once fans hype your page, they'll show up here.")}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hypers.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                      background: h.image ? `url(${h.image}) center/cover` : 'var(--hair-50)',
                      border: '1px solid var(--hair-100)',
                    }} />
                    <span style={{ fontSize: '0.9375rem', color: 'var(--ink)' }}>{h.name}</span>
                    <span style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', marginLeft: 'auto' }}>
                      {new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p style={{ color: 'var(--accent-text)', fontSize: '0.9375rem', marginTop: 16 }}>{error}</p>}
      {savedAt && !error && <p style={{ color: 'var(--role-venue)', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)', marginTop: 16 }}>✓ {t('pageEditor.saved', 'Saved')}</p>}

      <button
        className="settings-btn settings-btn-accent"
        disabled={saving}
        onClick={save}
        style={{ width: '100%', marginTop: 8, padding: '14px', fontSize: '0.9375rem' }}
        type="button"
      >
        {saving ? t('pageEditor.saving', 'Saving…') : t('pageEditor.saveChanges', 'Save changes')}
      </button>
    </div>
  );
}
