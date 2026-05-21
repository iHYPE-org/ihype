'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArtistMediaUploadManager } from '@/components/ArtistMediaUploadManager';
import { VisualDropStudio, type VisualDropStudioSlot } from '@/components/VisualDropStudio';
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { getPreviewSnippet } from '@/lib/text';
import {
  getProfileDesignStyleVars,
  normalizeProfileAccentTone,
  normalizeProfileBackdropTone,
  normalizeProfileDesignPreset,
  normalizeProfileFontPreset,
  profileAccentTones,
  profileBackdropTones,
  profileDesignPresets,
  profileFontPresets,
  type ProfileAccentTone,
  type ProfileBackdropTone,
  type ProfileDesignPreset,
  type ProfileFontPreset
} from '@/lib/profile-design';

type ArtistPageBuilderProps = {
  profileId: string;
  profileName: string;
  previewGenres: string[];
  startOpen?: boolean;
  hideToggle?: boolean;
  quickStart?: boolean;
  uploadedMediaCount?: number;
  initialValues: {
    headline: string;
    bio: string;
    heroImage: string;
    logoImage: string;
    galleryImage: string;
    contactInfo: string;
    hometown: string;
    city: string;
    stateRegion: string;
    country: string;
    aboutContent: string;
    mediaContent: string;
    tourContent: string;
    merchContent: string;
    themePreset?: string | null;
    themeFontPreset?: string | null;
    themeAccentTone?: string | null;
    themeBackdropTone?: string | null;
    fanShareEnabled?: boolean;
  };
};

type ArtistBuilderValues = {
  headline: string;
  bio: string;
  heroImage: string;
  logoImage: string;
  galleryImage: string;
  contactInfo: string;
  hometown: string;
  city: string;
  stateRegion: string;
  country: string;
  aboutContent: string;
  mediaContent: string;
  tourContent: string;
  merchContent: string;
  themePreset: ProfileDesignPreset;
  themeFontPreset: ProfileFontPreset;
  themeAccentTone: ProfileAccentTone;
  themeBackdropTone: ProfileBackdropTone;
  fanShareEnabled: boolean;
};

type ArtistVisualSlot = 'heroImage' | 'logoImage' | 'galleryImage' | 'mediaContent';


const artistQuickStartPresets = [
  {
    id: 'clean-press-kit',
    label: 'Clean Press Kit',
    description: 'Sharp, clear, professional.',
    themePreset: 'silver-signal' as const,
    themeFontPreset: 'night-broadcast' as const,
    themeAccentTone: 'electric-cyan' as const,
    themeBackdropTone: 'glass-night' as const
  },
  {
    id: 'indie-scrapbook',
    label: 'Indie Scrapbook',
    description: 'Personal, textured, handmade.',
    themePreset: 'scrapbook-zine' as const,
    themeFontPreset: 'poster-serif' as const,
    themeAccentTone: 'sunset-gold' as const,
    themeBackdropTone: 'sunset-haze' as const
  },
  {
    id: 'club-live',
    label: 'Club / Live',
    description: 'Dark, bold, venue-ready.',
    themePreset: 'arcade-afterglow' as const,
    themeFontPreset: 'club-mono' as const,
    themeAccentTone: 'electric-cyan' as const,
    themeBackdropTone: 'warehouse-smoke' as const
  }
];

function generateArtistBioFromPrompt(profileName: string, prompt: string, hometown: string) {
  const cleaned = prompt.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return null;
  }

  const sentence = cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
  const hometownLine = hometown.trim() ? `${profileName} is based in ${hometown.trim()}. ` : '';

  return {
    bio: `${hometownLine}${sentence}`,
    aboutContent: `${hometownLine}${sentence} This page is the starting point for new listeners, bookers, and collaborators.`,
    headline: `${profileName} is building momentum right now.`
  };
}

export function ArtistPageBuilder({
  profileId,
  profileName,
  previewGenres,
  startOpen = false,
  hideToggle = false,
  quickStart = false,
  uploadedMediaCount = 0,
  initialValues
}: ArtistPageBuilderProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(startOpen);
  const [showPreview, setShowPreview] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitIntent, setSubmitIntent] = useState<'save' | 'launch'>('save');
  const [quickStartPrompt, setQuickStartPrompt] = useState('');
  const [formValues, setFormValues] = useState<ArtistBuilderValues>({
    ...initialValues,
    themePreset: normalizeProfileDesignPreset(initialValues.themePreset),
    themeFontPreset: normalizeProfileFontPreset(initialValues.themeFontPreset),
    themeAccentTone: normalizeProfileAccentTone(initialValues.themeAccentTone),
    themeBackdropTone: normalizeProfileBackdropTone(initialValues.themeBackdropTone),
    fanShareEnabled: Boolean(initialValues.fanShareEnabled)
  });

  const previewStyle = useMemo(
    () =>
      getProfileDesignStyleVars(formValues.themePreset, {
        accentTone: formValues.themeAccentTone,
        backdropTone: formValues.themeBackdropTone,
        fontPreset: formValues.themeFontPreset
      }),
    [formValues.themeAccentTone, formValues.themeBackdropTone, formValues.themeFontPreset, formValues.themePreset]
  );

  const previewBannerStyle = getSafeBackgroundImageStyle(formValues.heroImage);
  const previewLogo = getSafeImageUrl(formValues.logoImage);
  const previewGalleryImage = getSafeImageUrl(formValues.galleryImage);
  const hasVisualAsset = Boolean(formValues.heroImage || formValues.logoImage || formValues.galleryImage);
  const quickStartSteps = [
    {
      label: 'Upload one song',
      description: 'Start with a track or video fans can press play on immediately.',
      done: uploadedMediaCount > 0
    },
    {
      label: 'Add your visuals',
      description: 'Give the page a banner, logo, or image so it already feels like you.',
      done: hasVisualAsset
    },
    {
      label: 'Launch your page',
      description: 'Publish once the page has media and a visual identity.',
      done: formValues.fanShareEnabled
    }
  ];
  const aboutPreview = getPreviewSnippet(
    formValues.aboutContent || formValues.bio,
    'Shape the introduction, visual assets, and overall mood before fans see the live page.'
  );
  const mediaPreview = getPreviewSnippet(
    formValues.mediaContent,
    'Use this area for visual notes, embedded context, and the story around your uploaded tracks.'
  );
  const visualDropSlots = useMemo<VisualDropStudioSlot<ArtistVisualSlot>[]>(
    () => [
      {
        id: 'heroImage',
        label: 'Background',
        description: 'Hero artwork behind the first artist impression.',
        kind: 'image',
        value: formValues.heroImage,
        placeholder: 'Drop background'
      },
      {
        id: 'logoImage',
        label: 'Logo',
        description: 'Artist mark placed beside the name.',
        kind: 'image',
        value: formValues.logoImage,
        placeholder: 'Drop logo'
      },
      {
        id: 'galleryImage',
        label: 'Picture',
        description: 'Feature image for media, tour, or press-kit sections.',
        kind: 'image',
        value: formValues.galleryImage,
        placeholder: 'Drop picture'
      },
      {
        id: 'mediaContent',
        label: 'Links',
        description: 'Drop a song, playlist, press, or merch link.',
        kind: 'link',
        value: formValues.mediaContent,
        placeholder: 'Drop link'
      }
    ],
    [
      formValues.galleryImage,
      formValues.heroImage,
      formValues.logoImage,
      formValues.mediaContent
    ]
  );

  function applyQuickStartPreset(presetId: string) {
    const preset = artistQuickStartPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setFormValues((current) => ({
      ...current,
      themePreset: preset.themePreset,
      themeFontPreset: preset.themeFontPreset,
      themeAccentTone: preset.themeAccentTone,
      themeBackdropTone: preset.themeBackdropTone
    }));
    setMessage(`${preset.label} applied to the page preview.`);
  }

  function applyGeneratedBio() {
    const generated = generateArtistBioFromPrompt(profileName, quickStartPrompt, formValues.hometown || formValues.city);
    if (!generated) {
      setMessage('Write one sentence about the artist first.');
      return;
    }

    setFormValues((current) => ({
      ...current,
      headline: current.headline || generated.headline,
      bio: generated.bio,
      aboutContent: current.aboutContent || generated.aboutContent
    }));
    setMessage('Starter bio generated from your one-line description.');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const shouldLaunch = submitIntent === 'launch';

    const response = await fetch(`/api/profile-pages/${profileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: formValues.headline,
        bio: formValues.bio,
        heroImage: formValues.heroImage,
        logoImage: formValues.logoImage,
        galleryImage: formValues.galleryImage,
        contactInfo: formValues.contactInfo,
        hometown: formValues.hometown,
        city: formValues.city,
        stateRegion: formValues.stateRegion,
        country: formValues.country,
        aboutContent: formValues.aboutContent,
        mediaContent: formValues.mediaContent,
        tourContent: formValues.tourContent,
        merchContent: formValues.merchContent,
        themePreset: formValues.themePreset,
        themeFontPreset: formValues.themeFontPreset,
        themeAccentTone: formValues.themeAccentTone,
        themeBackdropTone: formValues.themeBackdropTone,
        fanShareEnabled: shouldLaunch ? true : formValues.fanShareEnabled
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not update this artist page.');
      setPending(false);
      return;
    }

    setFormValues((current) => ({
      ...current,
      fanShareEnabled: shouldLaunch ? true : current.fanShareEnabled
    }));
    setMessage(shouldLaunch ? 'Artist page launched for fans.' : 'Draft saved.');
    setPending(false);
    router.refresh();
  }

  return (
    <section className="panel artist-page-builder">
      <div className="artist-page-builder-header">
        <div>
          <div className="badge">{quickStart ? 'Artist quick start' : 'Page Builder'}</div>
          <h2>{quickStart ? 'Launch your artist page faster' : 'Build your artist page'}</h2>
          <p className="kicker">
            {quickStart
              ? 'Start with one upload, one visual move, and one launch button. Everything else can come after your page is live.'
              : 'Change the background, font, colors, uploads, and contact info, then preview the page before you launch it.'}
          </p>
        </div>
        <div className="artist-page-builder-actions">
          <span className={formValues.fanShareEnabled ? 'status-chip artist-builder-status live' : 'status-chip artist-builder-status'}>
            {formValues.fanShareEnabled ? 'Live for fans' : 'Draft only'}
          </span>
          {!hideToggle ? (
            <button
              className="button small secondary"
              onClick={() => setIsOpen((current) => !current)}
              type="button"
            >
              {isOpen ? 'Hide builder' : 'Open builder'}
            </button>
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <form className="artist-page-builder-layout" onSubmit={handleSubmit}>
          <div className="artist-page-builder-fields">
            {quickStart ? (
              <div className="artist-builder-quickstart-panel">
                {quickStartSteps.map((step, index) => (
                  <article
                    className={step.done ? 'artist-builder-quickstart-step done' : 'artist-builder-quickstart-step'}
                    key={step.label}
                  >
                    <span className="artist-builder-quickstart-index">0{index + 1}</span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>{step.description}</p>
                    </div>
                    <span className="artist-builder-quickstart-state">{step.done ? 'Ready' : 'Next'}</span>
                  </article>
                ))}
              </div>
            ) : null}

            {quickStart ? (
              <div className="artist-page-builder-section">
                <div className="artist-page-builder-section-head">
                  <h3>Choose a starter look</h3>
                </div>
                <div className="artist-builder-preset-grid">
                  {artistQuickStartPresets.map((preset) => (
                    <button
                      className="artist-builder-preset-card"
                      key={preset.id}
                      onClick={() => applyQuickStartPreset(preset.id)}
                      type="button"
                    >
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="artist-page-builder-section">
              <div className="artist-page-builder-section-head">
                <h3>Visuals</h3>
                <button
                  className="button small secondary"
                  onClick={() => setShowPreview((current) => !current)}
                  type="button"
                >
                  {showPreview ? 'Hide preview' : 'Preview page'}
                </button>
              </div>

              <label className="field">
                <span>Headline banner</span>
                <input
                  maxLength={140}
                  onChange={(event) => setFormValues((current) => ({ ...current, headline: event.target.value }))}
                  placeholder="The line fans see first"
                  value={formValues.headline}
                />
              </label>

              <label className="field">
                <span>Short intro</span>
                <textarea
                  onChange={(event) => setFormValues((current) => ({ ...current, bio: event.target.value }))}
                  rows={3}
                  value={formValues.bio}
                />
              </label>

              <div className="artist-builder-control-grid">
                <label className="field">
                  <span>Color preset</span>
                  <select
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        themePreset: normalizeProfileDesignPreset(event.target.value)
                      }))
                    }
                    value={formValues.themePreset}
                  >
                    {profileDesignPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Font preset</span>
                  <select
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        themeFontPreset: normalizeProfileFontPreset(event.target.value)
                      }))
                    }
                    value={formValues.themeFontPreset}
                  >
                    {profileFontPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Accent color</span>
                  <select
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        themeAccentTone: normalizeProfileAccentTone(event.target.value)
                      }))
                    }
                    value={formValues.themeAccentTone}
                  >
                    {profileAccentTones.map((tone) => (
                      <option key={tone.id} value={tone.id}>
                        {tone.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Backdrop tone</span>
                  <select
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        themeBackdropTone: normalizeProfileBackdropTone(event.target.value)
                      }))
                    }
                    value={formValues.themeBackdropTone}
                  >
                    {profileBackdropTones.map((tone) => (
                      <option key={tone.id} value={tone.id}>
                        {tone.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <VisualDropStudio
                description="Drag media from your desktop, tap to upload from a phone, or drag a loaded asset to a different page slot."
                onChange={(slotId, value) =>
                  setFormValues((current) => ({
                    ...current,
                    [slotId]: value
                  }))
                }
                onStatus={setMessage}
                slots={visualDropSlots}
                title="Place artist graphics, video, and links"
              />
            </div>

            <div className="artist-page-builder-section">
              <div className="artist-page-builder-section-head">
                <h3>{quickStart ? 'Starter info' : 'Info'}</h3>
              </div>

              <div className="artist-builder-control-grid">
                <label className="field">
                  <span>Contact information</span>
                  <input
                    onChange={(event) => setFormValues((current) => ({ ...current, contactInfo: event.target.value }))}
                    placeholder="manager@artist.com | +1 555 101 3030"
                    value={formValues.contactInfo}
                  />
                </label>

                <label className="field">
                  <span>Hometown</span>
                  <input
                    onChange={(event) => setFormValues((current) => ({ ...current, hometown: event.target.value }))}
                    value={formValues.hometown}
                  />
                </label>

                <label className="field">
                  <span>City</span>
                  <input
                    onChange={(event) => setFormValues((current) => ({ ...current, city: event.target.value }))}
                    value={formValues.city}
                  />
                </label>

                <label className="field">
                  <span>State / province</span>
                  <input
                    onChange={(event) => setFormValues((current) => ({ ...current, stateRegion: event.target.value }))}
                    value={formValues.stateRegion}
                  />
                </label>

                <label className="field">
                  <span>Country</span>
                  <input
                    onChange={(event) => setFormValues((current) => ({ ...current, country: event.target.value }))}
                    value={formValues.country}
                  />
                </label>
              </div>

              <label className="field">
                <span>About</span>
                <textarea
                  onChange={(event) => setFormValues((current) => ({ ...current, aboutContent: event.target.value }))}
                  rows={5}
                  value={formValues.aboutContent}
                />
              </label>

              {quickStart ? (
                <div className="artist-builder-bio-lab">
                  <label className="field">
                    <span>One-line artist story</span>
                    <textarea
                      onChange={(event) => setQuickStartPrompt(event.target.value)}
                      placeholder="Late-night synth pop with a live-drums pulse and big emotional hooks."
                      rows={3}
                      value={quickStartPrompt}
                    />
                  </label>
                  <div className="cta-row">
                    <button className="button small secondary" onClick={applyGeneratedBio} type="button">
                      Generate bio from 1 line
                    </button>
                  </div>
                </div>
              ) : null}

              {quickStart ? (
                <details className="artist-builder-advanced">
                  <summary>Advanced page details</summary>
                  <div className="artist-builder-advanced-fields">
                    <label className="field">
                      <span>Media notes</span>
                      <textarea
                        onChange={(event) => setFormValues((current) => ({ ...current, mediaContent: event.target.value }))}
                        rows={4}
                        value={formValues.mediaContent}
                      />
                    </label>

                    <div className="artist-builder-control-grid">
                      <label className="field">
                        <span>Tour</span>
                        <textarea
                          onChange={(event) => setFormValues((current) => ({ ...current, tourContent: event.target.value }))}
                          rows={4}
                          value={formValues.tourContent}
                        />
                      </label>

                      <label className="field">
                        <span>Merch</span>
                        <textarea
                          onChange={(event) => setFormValues((current) => ({ ...current, merchContent: event.target.value }))}
                          rows={4}
                          value={formValues.merchContent}
                        />
                      </label>
                    </div>
                  </div>
                </details>
              ) : (
                <>
                  <label className="field">
                    <span>Media notes</span>
                    <textarea
                      onChange={(event) => setFormValues((current) => ({ ...current, mediaContent: event.target.value }))}
                      rows={4}
                      value={formValues.mediaContent}
                    />
                  </label>

                  <div className="artist-builder-control-grid">
                    <label className="field">
                      <span>Tour</span>
                      <textarea
                        onChange={(event) => setFormValues((current) => ({ ...current, tourContent: event.target.value }))}
                        rows={4}
                        value={formValues.tourContent}
                      />
                    </label>

                    <label className="field">
                      <span>Merch</span>
                      <textarea
                        onChange={(event) => setFormValues((current) => ({ ...current, merchContent: event.target.value }))}
                        rows={4}
                        value={formValues.merchContent}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

            <ArtistMediaUploadManager profileId={profileId} />

            <div className="cta-row artist-builder-cta-row">
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => setSubmitIntent('save')}
                type="submit"
              >
                {pending && submitIntent === 'save' ? 'Saving draft...' : 'Save draft'}
              </button>
              <button
                className="button"
                disabled={pending}
                onClick={() => setSubmitIntent('launch')}
                type="submit"
              >
                {pending && submitIntent === 'launch'
                  ? 'Launching...'
                  : formValues.fanShareEnabled
                    ? 'Update live page'
                    : quickStart
                      ? 'Launch starter page'
                      : 'Launch page'}
              </button>
              {message ? <span className="meta">{message}</span> : null}
            </div>
          </div>

          {showPreview ? (
            <aside className="artist-page-builder-preview-shell profile-design-shell" style={previewStyle}>
              <div className="artist-page-builder-preview-card">
                <header className="artist-page-builder-preview-hero panel" style={previewBannerStyle}>
                  <div className="artist-page-builder-preview-copy">
                    <div className="artist-page-builder-preview-topline">
                      <span className="badge">ARTIST PREVIEW</span>
                      <span className="status-chip">{formValues.fanShareEnabled ? 'Live' : 'Draft'}</span>
                    </div>
                    {previewLogo ? (
                      <img alt={`${profileName} logo`} className="artist-page-builder-preview-logo" src={previewLogo} />
                    ) : null}
                    <h3>{profileName}</h3>
                    <p className="artist-headline">
                      {formValues.headline || 'Your headline preview lands here.'}
                    </p>
                    <p className="subtitle">
                      {formValues.bio || 'Preview the fan-facing intro, visual assets, and typography here before launch.'}
                    </p>
                    <div className="tag-row">
                      {previewGenres.slice(0, 3).map((genre) => (
                        <span className="tag" key={genre}>
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </header>

                <div className="artist-page-builder-preview-panels">
                  <article className="panel artist-page-builder-preview-panel">
                    <span className="badge">About</span>
                    <p>{aboutPreview}</p>
                    {formValues.contactInfo ? <p className="meta">Contact: {formValues.contactInfo}</p> : null}
                    {[formValues.hometown, formValues.city, formValues.stateRegion, formValues.country].filter(Boolean).length ? (
                      <p className="meta">
                        {[formValues.hometown, formValues.city, formValues.stateRegion, formValues.country]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    ) : null}
                  </article>

                  <article className="panel artist-page-builder-preview-panel">
                    <span className="badge">Media</span>
                    <p>{mediaPreview}</p>
                    {previewGalleryImage ? (
                      <img alt={`${profileName} gallery preview`} className="artist-page-builder-preview-image" src={previewGalleryImage} />
                    ) : null}
                  </article>
                </div>
              </div>
            </aside>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
