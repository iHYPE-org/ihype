'use client';

import { useEffect, useRef, useState } from 'react';
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

type AvailabilityEntry = { id: string; date: string; note: string | null };
type RecentHyper = { id: string; name: string; image: string | null; at: string };

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

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'about', label: 'About' },
  { id: 'media', label: 'Media' },
  { id: 'details', label: 'Details' },
  { id: 'presskit', label: 'Press kit' },
  { id: 'stats', label: 'Stats' },
  { id: 'theme', label: 'Theme' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

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
  const resolvedInitialSection = SECTIONS.some((item) => item.id === initialSection)
    ? initialSection as SectionId
    : 'basics';
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
  const [availSaving, setAvailSaving] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  // Recent activity — read-only feed from /api/profile/activity (who hyped
  // this profile recently); there's nothing to edit, just to show.
  const [hypers, setHypers] = useState<RecentHyper[] | null>(null);

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

  const preset = getProfileDesignPreset(data.themePreset);
  const accentTone = getProfileAccentTone(data.themeAccentTone);
  const backdropTone = getProfileBackdropTone(data.themeBackdropTone);

  return (
    <div>
      <div className="page-editor-tabstrip" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {SECTIONS.filter((s) => (s.id !== 'details' || !isFan) && (s.id !== 'presskit' || isArtistOrDj)).map((s) => (
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

      {section === 'basics' && (
        <div className="sub-panel">
          <Field label={t('pageEditor.nameLabel', 'Name')}><TextField maxLength={120} onChange={(v) => set('name', v)} value={data.name} /></Field>
          <Field hint={t('pageEditor.headlineHint', 'A short one-liner shown near your name')} label={t('pageEditor.headlineLabel', 'Headline')}>
            <TextField maxLength={180} onChange={(v) => set('headline', v ?? '')} placeholder={t('pageEditor.headlinePlaceholder', 'e.g. Indie rock from Portland')} value={data.headline ?? ''} />
          </Field>
          <Field label={t('pageEditor.bioLabel', 'Bio')}><TextAreaField maxLength={1000} onChange={(v) => set('bio', v)} rows={3} value={data.bio ?? ''} /></Field>
          <Field label={t('pageEditor.linksLabel', 'Links')} hint={t('pageEditor.linksHint', 'One per line — socials, streaming, anything')}>
            <TextAreaField maxLength={5000} onChange={(v) => set('links', v)} rows={3} value={data.links ?? ''} />
          </Field>
          {isArtistOrDj && (
            <Field hint={t('pageEditor.genresHint', 'Comma-separated — shown on your public page and used for discovery')} label={t('pageEditor.genresLabel', 'Genres')}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <button
                  className="settings-btn settings-btn-ghost"
                  disabled={genresSaving}
                  onClick={saveGenres}
                  type="button"
                >
                  {genresSaving ? t('pageEditor.saving', 'Saving…') : t('pageEditor.saveGenres', 'Save genres')}
                </button>
                {genresError && <span style={{ color: 'var(--accent-text)', fontSize: '0.9375rem' }}>{genresError}</span>}
                {genresSavedAt && !genresError && <span style={{ color: 'var(--role-venue)', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}>✓ {t('pageEditor.saved', 'Saved')}</span>}
              </div>
            </Field>
          )}
          {isVenue && (
            <>
              <Field label={t('pageEditor.addressLabel', 'Address')}><TextField maxLength={240} onChange={(v) => set('addressLine1', v)} value={data.addressLine1 ?? ''} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label={t('pageEditor.cityLabel', 'City')}><TextField maxLength={120} onChange={(v) => set('city', v)} value={data.city ?? ''} /></Field>
                <Field label={t('pageEditor.stateLabel', 'State')}><TextField maxLength={120} onChange={(v) => set('stateRegion', v)} value={data.stateRegion ?? ''} /></Field>
                <Field label={t('pageEditor.postalCodeLabel', 'Postal code')}><TextField maxLength={40} onChange={(v) => set('postalCode', v)} value={data.postalCode ?? ''} /></Field>
                <Field label={t('pageEditor.countryLabel', 'Country')}><TextField maxLength={80} onChange={(v) => set('country', v)} value={data.country ?? ''} /></Field>
              </div>
            </>
          )}
        </div>
      )}

      {section === 'about' && (
        <div className="sub-panel">
          <Field hint={t('pageEditor.aboutHint', 'The main story on your page — as long as you want')} label={t('pageEditor.aboutLabel', 'About')}>
            <TextAreaField maxLength={5000} onChange={(v) => set('aboutContent', v)} rows={8} value={data.aboutContent ?? ''} />
          </Field>
          <Field hint={t('pageEditor.topFiveHint', 'One item per line')} label={t('pageEditor.topFiveLabel', 'Top 5')}>
            <TextAreaField maxLength={2000} onChange={(v) => set('topFiveContent', v)} placeholder={t('pageEditor.topFivePlaceholder', 'e.g.\nFavorite venue in town\nDream collab\n...')} rows={5} value={data.topFiveContent ?? ''} />
          </Field>
          <Field label={t('pageEditor.nowPlayingLabel', 'Now playing / current mood')}><TextField maxLength={240} onChange={(v) => set('nowPlaying', v)} value={data.nowPlaying ?? ''} /></Field>
        </div>
      )}

      {section === 'media' && (
        <div className="sub-panel">
          <ImageField label={t('pageEditor.avatarLabel', 'Avatar')} onUpload={(f) => uploadImage('avatarImage', f)} uploading={uploadingField === 'avatarImage'} value={data.avatarImage} />
          <ImageField label={t('pageEditor.heroBannerLabel', 'Hero banner')} onUpload={(f) => uploadImage('heroImage', f)} uploading={uploadingField === 'heroImage'} value={data.heroImage} />
          <ImageField label={t('pageEditor.logoLabel', 'Logo')} onUpload={(f) => uploadImage('logoImage', f)} uploading={uploadingField === 'logoImage'} value={data.logoImage} />
          <ImageField label={t('pageEditor.galleryCoverLabel', 'Gallery cover')} onUpload={(f) => uploadImage('galleryImage', f)} uploading={uploadingField === 'galleryImage'} value={data.galleryImage} />
        </div>
      )}

      {section === 'details' && isArtistOrDj && (
        <div className="sub-panel">
          <Field label={t('pageEditor.upcomingLabel', 'Upcoming')}><TextAreaField maxLength={5000} onChange={(v) => set('upcomingContent', v)} rows={4} value={data.upcomingContent ?? ''} /></Field>
          <div id="tour-creator" className="page-editor-anchor-target">
            <Field label={t('pageEditor.tourDatesLabel', 'Tour dates')}><TextAreaField maxLength={5000} onChange={(v) => set('tourContent', v)} rows={4} value={data.tourContent ?? ''} /></Field>
          </div>
          <Field hint={t('pageEditor.requestsHint', 'What fans can request from you')} label={t('pageEditor.requestsLabel', 'Requests')}><TextAreaField maxLength={5000} onChange={(v) => set('requestContent', v)} rows={3} value={data.requestContent ?? ''} /></Field>
          <Field label={t('pageEditor.previousShowHighlightsLabel', 'Previous show highlights')}><TextAreaField maxLength={5000} onChange={(v) => set('previousShowHighlights', v)} rows={4} value={data.previousShowHighlights ?? ''} /></Field>
          <Field label={t('pageEditor.merchLinkLabel', 'Merch link')}><TextField onChange={(v) => set('merchUrl', v)} placeholder="https://…" value={data.merchUrl ?? ''} /></Field>
          <Field label={t('pageEditor.merchDetailsLabel', 'Merch details')}><TextAreaField maxLength={5000} onChange={(v) => set('merchContent', v)} rows={3} value={data.merchContent ?? ''} /></Field>

          <Field hint={t('pageEditor.bookingAvailabilityHint', "Dates you're open for booking — venues and promoters can see these on your public page")} label={t('pageEditor.bookingAvailabilityLabel', 'Booking availability')}>
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
                placeholder={t('pageEditor.noteOptionalPlaceholder', 'Note (optional)')}
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
                      <div style={{ fontSize: '0.9375rem', color: 'var(--ink)', fontWeight: 600 }}>
                        {new Date(d.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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

      {section === 'details' && isVenue && (
        <div className="sub-panel">
          <Field label={t('pageEditor.hoursLabel', 'Hours')}><TextAreaField maxLength={500} onChange={(v) => set('hoursText', v)} rows={3} value={data.hoursText ?? ''} /></Field>
          <Field label={t('pageEditor.parkingDetailsLabel', 'Parking details')}><TextAreaField maxLength={1000} onChange={(v) => set('parkingDetails', v)} rows={3} value={data.parkingDetails ?? ''} /></Field>
          <Field label={t('pageEditor.stayRecommendationsLabel', 'Stay recommendations')}><TextAreaField maxLength={1000} onChange={(v) => set('stayRecommendations', v)} rows={3} value={data.stayRecommendations ?? ''} /></Field>
        </div>
      )}

      {section === 'presskit' && isArtistOrDj && (
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

      {section === 'stats' && (
        <div className="sub-panel">
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

      {section === 'theme' && (
        <div className="sub-panel">
          <Field hint={t('pageEditor.designPresetHint', 'Sets the overall look of your public page')} label={t('pageEditor.designPresetLabel', 'Design preset')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {profileDesignPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set('themePreset', p.id)}
                  style={{
                    padding: 12, borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${data.themePreset === p.id ? p.accent : 'var(--hair-80)'}`,
                    background: p.panel,
                  }}
                  type="button"
                >
                  <div style={{ width: '100%', height: 32, borderRadius: 8, background: p.hero, marginBottom: 8 }} />
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: p.text }}>{t(`pageEditor.designPresetOption.${p.id}`, p.label)}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field hint={t('pageEditor.accentToneHint', "Override the preset's accent color, or leave it on Preset")} label={t('pageEditor.accentToneLabel', 'Accent tone')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profileAccentTones.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => set('themeAccentTone', tone.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9999, cursor: 'pointer',
                    border: `1px solid ${data.themeAccentTone === tone.id || (!data.themeAccentTone && tone.id === 'preset') ? (tone.accent ?? preset.accent) : 'var(--hair-80)'}`,
                    background: 'var(--hair-30)', color: 'var(--ink)', fontSize: '0.9375rem',
                  }}
                  type="button"
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: tone.accent ?? preset.accent, display: 'inline-block' }} />
                  {t(`pageEditor.accentToneOption.${tone.id}`, tone.label)}
                </button>
              ))}
            </div>
          </Field>

          <Field hint={t('pageEditor.backdropToneHint', "Override the preset's backdrop, or leave it on Preset")} label={t('pageEditor.backdropToneLabel', 'Backdrop tone')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profileBackdropTones.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => set('themeBackdropTone', tone.id)}
                  style={{
                    padding: '8px 14px', borderRadius: 9999, cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--ink)',
                    border: `1px solid ${data.themeBackdropTone === tone.id || (!data.themeBackdropTone && tone.id === 'preset') ? (tone.border ?? preset.border) : 'var(--hair-80)'}`,
                    background: tone.panel ?? preset.panel,
                  }}
                  type="button"
                >
                  {t(`pageEditor.backdropToneOption.${tone.id}`, tone.label)}
                </button>
              ))}
            </div>
          </Field>

          <Field hint={t('pageEditor.fontPairingHint', "Swaps the headline/body typefaces on your public page — leave unset to keep the site's default fonts")} label={t('pageEditor.fontPairingLabel', 'Font pairing')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() => set('themeFontPreset', '')}
                style={{
                  padding: '8px 14px', borderRadius: 9999, cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--ink)',
                  border: `1px solid ${!data.themeFontPreset ? (accentTone.accent ?? preset.accent) : 'var(--hair-80)'}`,
                  background: 'var(--hair-30)',
                }}
                type="button"
              >
                {t('pageEditor.siteDefaultFont', 'Site default')}
              </button>
              {profileFontPresets.map((f) => (
                <button
                  key={f.id}
                  onClick={() => set('themeFontPreset', f.id)}
                  style={{
                    padding: '8px 14px', borderRadius: 9999, cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--ink)',
                    border: `1px solid ${data.themeFontPreset === f.id ? (accentTone.accent ?? preset.accent) : 'var(--hair-80)'}`,
                    background: 'var(--hair-30)', fontFamily: f.displayFamily,
                  }}
                  title={f.description}
                  type="button"
                >
                  {t(`pageEditor.fontPresetOption.${f.id}`, f.label)}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ marginTop: 8, padding: 20, borderRadius: 16, background: backdropTone.hero ?? preset.hero, border: `1px solid ${backdropTone.border ?? preset.border}` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.14em', textTransform: 'uppercase', color: preset.muted, marginBottom: 6 }}>{t('pageEditor.themePreviewLabel', 'Preview')}</div>
            <div style={{
              fontFamily: data.themeFontPreset
                ? (profileFontPresets.find((f) => f.id === data.themeFontPreset)?.displayFamily ?? 'var(--font-display)')
                : 'var(--font-display)',
              fontWeight: 800, fontSize: '1.125rem', color: accentTone.accent ?? preset.accent,
            }}>{data.name || t('pageEditor.themePreviewFallbackName', 'Your page')}</div>
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
