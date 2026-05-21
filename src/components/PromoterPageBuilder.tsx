'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VisualDropStudio, type VisualDropStudioSlot } from '@/components/VisualDropStudio';
import { getSafeBackgroundImageStyle, getSafeImageUrl } from '@/lib/asset-safety';
import { getPreviewSnippet } from '@/lib/text';
import {
  getProfileSetupPresets,
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

type PromoterPageBuilderProps = {
  profileId: string;
  profileName: string;
  previewGenres: string[];
  startOpen?: boolean;
  hideToggle?: boolean;
  initialValues: {
    headline: string;
    bio: string;
    heroImage: string;
    logoImage: string;
    galleryImage: string;
    contactInfo: string;
    city: string;
    stateRegion: string;
    country: string;
    aboutContent: string;
    recommendContent: string;
    themePreset?: string | null;
    themeFontPreset?: string | null;
    themeAccentTone?: string | null;
    themeBackdropTone?: string | null;
    fanShareEnabled?: boolean;
  };
};

type PromoterBuilderValues = {
  headline: string;
  bio: string;
  heroImage: string;
  logoImage: string;
  galleryImage: string;
  contactInfo: string;
  city: string;
  stateRegion: string;
  country: string;
  aboutContent: string;
  recommendContent: string;
  themePreset: ProfileDesignPreset;
  themeFontPreset: ProfileFontPreset;
  themeAccentTone: ProfileAccentTone;
  themeBackdropTone: ProfileBackdropTone;
  fanShareEnabled: boolean;
};

type PromoterVisualSlot = 'heroImage' | 'logoImage' | 'galleryImage' | 'recommendContent';


export function PromoterPageBuilder({
  profileId,
  profileName,
  previewGenres,
  startOpen = false,
  hideToggle = false,
  initialValues
}: PromoterPageBuilderProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(startOpen);
  const [showPreview, setShowPreview] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitIntent, setSubmitIntent] = useState<'save' | 'launch'>('save');
  const quickSetupPresets = getProfileSetupPresets('promoter');
  const [formValues, setFormValues] = useState<PromoterBuilderValues>({
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
  const aboutPreview = getPreviewSnippet(
    formValues.aboutContent || formValues.bio,
    'Set the scene for the rooms, artists, and kind of nights you bring together.'
  );
  const eventsPreview = getPreviewSnippet(
    formValues.recommendContent,
    'Shape the Events tab with the collaborations, rooms, and lineups you want fans to connect with this promoter.'
  );
  const visualDropSlots = useMemo<VisualDropStudioSlot<PromoterVisualSlot>[]>(
    () => [
      {
        id: 'heroImage',
        label: 'Background',
        description: 'Hero artwork for the promoter page.',
        kind: 'image',
        value: formValues.heroImage,
        placeholder: 'Drop background'
      },
      {
        id: 'logoImage',
        label: 'Logo',
        description: 'Promoter/DJ mark beside the page name.',
        kind: 'image',
        value: formValues.logoImage,
        placeholder: 'Drop logo'
      },
      {
        id: 'galleryImage',
        label: 'Show image',
        description: 'A visual for shows, events, or featured nights.',
        kind: 'image',
        value: formValues.galleryImage,
        placeholder: 'Drop image'
      },
      {
        id: 'recommendContent',
        label: 'Event links',
        description: 'Drop ticket, playlist, show, or partner links.',
        kind: 'link',
        value: formValues.recommendContent,
        placeholder: 'Drop link'
      }
    ],
    [
      formValues.galleryImage,
      formValues.heroImage,
      formValues.logoImage,
      formValues.recommendContent
    ]
  );

  function applyQuickPreset(presetId: string) {
    const preset = quickSetupPresets.find((entry) => entry.id === presetId);
    if (!preset) return;

    setFormValues((current) => ({
      ...current,
      themePreset: preset.themePreset,
      themeFontPreset: preset.themeFontPreset,
      themeAccentTone: preset.themeAccentTone,
      themeBackdropTone: preset.themeBackdropTone,
      headline: current.headline || preset.starterHeadline || current.headline,
      bio: current.bio || preset.starterBio || current.bio,
      aboutContent: current.aboutContent || preset.starterAbout || current.aboutContent
    }));
    setMessage(`${preset.label} applied to the preview.`);
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
        city: formValues.city,
        stateRegion: formValues.stateRegion,
        country: formValues.country,
        aboutContent: formValues.aboutContent,
        recommendContent: formValues.recommendContent,
        themePreset: formValues.themePreset,
        themeFontPreset: formValues.themeFontPreset,
        themeAccentTone: formValues.themeAccentTone,
        themeBackdropTone: formValues.themeBackdropTone,
        fanShareEnabled: shouldLaunch ? true : formValues.fanShareEnabled
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not update this promoter page.');
      setPending(false);
      return;
    }

    setFormValues((current) => ({
      ...current,
      fanShareEnabled: shouldLaunch ? true : current.fanShareEnabled
    }));
    setMessage(shouldLaunch ? 'Promoter page launched for fans.' : 'Draft saved.');
    setPending(false);
    router.refresh();
  }

  return (
    <section className="panel artist-page-builder">
      <div className="artist-page-builder-header">
        <div>
          <div className="badge">Page Builder</div>
          <h2>Build your promoter page</h2>
          <p className="kicker">
            Tune the visual identity, upload supporting media, shape the page copy, and preview everything before you launch it.
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
            <div className="artist-page-builder-section">
              <div className="artist-page-builder-section-head">
                <h3>Choose a starter look</h3>
              </div>
              <div className="artist-builder-preset-grid">
                {quickSetupPresets.map((preset) => (
                  <button
                    className="artist-builder-preset-card"
                    key={preset.id}
                    onClick={() => applyQuickPreset(preset.id)}
                    type="button"
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

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
                  placeholder="What should artists, venues, and fans feel here first?"
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
                description="Drag flyers, logos, recap clips, and ticket/show links straight into the page slots."
                onChange={(slotId, value) =>
                  setFormValues((current) => ({
                    ...current,
                    [slotId]: value
                  }))
                }
                onStatus={setMessage}
                slots={visualDropSlots}
                title="Place promoter graphics, video, and links"
              />
            </div>

            <div className="artist-page-builder-section">
              <div className="artist-page-builder-section-head">
                <h3>Info</h3>
              </div>

              <div className="artist-builder-control-grid">
                <label className="field">
                  <span>Contact information</span>
                  <input
                    onChange={(event) => setFormValues((current) => ({ ...current, contactInfo: event.target.value }))}
                    placeholder="bookings@promoter.com | +1 555 101 3030"
                    value={formValues.contactInfo}
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

              <label className="field">
                <span>Events</span>
                <textarea
                  onChange={(event) => setFormValues((current) => ({ ...current, recommendContent: event.target.value }))}
                  rows={5}
                  value={formValues.recommendContent}
                />
              </label>
            </div>

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
                      <span className="badge">PROMOTER PREVIEW</span>
                      <span className="status-chip">{formValues.fanShareEnabled ? 'Live' : 'Draft'}</span>
                    </div>
                    {previewLogo ? (
                      <img alt={`${profileName} logo`} className="artist-page-builder-preview-logo" src={previewLogo} />
                    ) : null}
                    <h3>{profileName}</h3>
                    <p className="artist-headline">
                      {formValues.headline || 'Your promoter headline preview lands here.'}
                    </p>
                    <p className="subtitle">
                      {formValues.bio || 'Preview the promoter-facing intro, visuals, and atmosphere here before launch.'}
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
                    {[formValues.city, formValues.stateRegion, formValues.country].filter(Boolean).length ? (
                      <p className="meta">
                        {[formValues.city, formValues.stateRegion, formValues.country].filter(Boolean).join(' | ')}
                      </p>
                    ) : null}
                  </article>

                  <article className="panel artist-page-builder-preview-panel">
                    <span className="badge">Events</span>
                    <p>{eventsPreview}</p>
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
