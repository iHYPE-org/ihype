'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VisualDropStudio, type VisualDropStudioSlot } from '@/components/VisualDropStudio';
import { getSafeBackgroundImageStyle } from '@/lib/asset-safety';
import { getPreviewSnippet } from '@/lib/text';
import {
  getProfileAccentTone,
  getProfileBackdropTone,
  getProfileDesignPreset,
  getProfileSetupPresets,
  getProfileFontPreset,
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
  type ProfileFontPreset,
  type ProfileSetupRole
} from '@/lib/profile-design';

export type EditableFieldKey =
  | 'headline'
  | 'bio'
  | 'heroImage'
  | 'avatarImage'
  | 'logoImage'
  | 'galleryImage'
  | 'aboutContent'
  | 'journalContent'
  | 'mediaContent'
  | 'tourContent'
  | 'merchContent'
  | 'requestContent'
  | 'recommendContent'
  | 'topFiveContent'
  | 'addressLine1'
  | 'contactInfo'
  | 'hoursText'
  | 'hometown'
  | 'city'
  | 'stateRegion'
  | 'postalCode'
  | 'country'
  | 'parkingDetails'
  | 'stayRecommendations'
  | 'upcomingContent'
  | 'previousShowHighlights';

export type ProfilePageEditorField = {
  key: EditableFieldKey;
  label: string;
  kind?: 'input' | 'textarea' | 'url';
  rows?: number;
  placeholder?: string;
};

type ProfilePageInitialValues = Partial<Record<EditableFieldKey, string>> & {
  themePreset?: string;
  themeFontPreset?: string;
  themeAccentTone?: string;
  themeBackdropTone?: string;
  fanShareEnabled?: boolean;
};

type ProfilePageFormValues = Record<EditableFieldKey, string> & {
  themePreset: ProfileDesignPreset;
  themeFontPreset: ProfileFontPreset;
  themeAccentTone: ProfileAccentTone;
  themeBackdropTone: ProfileBackdropTone;
  fanShareEnabled: boolean;
};

type ProfilePageEditorProps = {
  profileId: string;
  profileName: string;
  title: string;
  description: string;
  fields: ProfilePageEditorField[];
  initialValues: ProfilePageInitialValues;
  enableDesignCustomizer?: boolean;
  allowFanShareToggle?: boolean;
  previewTabs?: string[];
  previewGenres?: string[];
  previewRoleLabel?: string;
  startOpen?: boolean;
  hideToggle?: boolean;
  quickPresetRole?: ProfileSetupRole;
};

const defaultFormValues: Record<EditableFieldKey, string> = {
  headline: '',
  bio: '',
  heroImage: '',
  avatarImage: '',
  logoImage: '',
  galleryImage: '',
  aboutContent: '',
  journalContent: '',
  mediaContent: '',
  tourContent: '',
  merchContent: '',
  requestContent: '',
  recommendContent: '',
  topFiveContent: '',
  addressLine1: '',
  contactInfo: '',
  hoursText: '',
  hometown: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  country: '',
  parkingDetails: '',
  stayRecommendations: '',
  upcomingContent: '',
  previousShowHighlights: ''
};


export function ProfilePageEditor({
  profileId,
  profileName,
  title,
  description,
  fields,
  initialValues,
  enableDesignCustomizer = false,
  allowFanShareToggle = false,
  previewTabs = [],
  previewGenres = [],
  previewRoleLabel = 'PROFILE',
  startOpen = false,
  hideToggle = false,
  quickPresetRole
}: ProfilePageEditorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(startOpen);
  const [formValues, setFormValues] = useState<ProfilePageFormValues>({
    ...defaultFormValues,
    ...initialValues,
    themePreset: normalizeProfileDesignPreset(initialValues.themePreset),
    themeFontPreset: normalizeProfileFontPreset(initialValues.themeFontPreset),
    themeAccentTone: normalizeProfileAccentTone(initialValues.themeAccentTone),
    themeBackdropTone: normalizeProfileBackdropTone(initialValues.themeBackdropTone),
    fanShareEnabled: Boolean(initialValues.fanShareEnabled)
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const quickSetupPresets = useMemo(
    () => (quickPresetRole ? getProfileSetupPresets(quickPresetRole) : []),
    [quickPresetRole]
  );
  const editableFields = fields.filter(
    (field) =>
      !['heroImage', 'avatarImage', 'logoImage', 'galleryImage'].includes(field.key)
  );
  const selectedPreset = getProfileDesignPreset(formValues.themePreset);
  const selectedFontPreset = getProfileFontPreset(formValues.themeFontPreset);
  const selectedAccentTone = getProfileAccentTone(formValues.themeAccentTone);
  const selectedBackdropTone = getProfileBackdropTone(formValues.themeBackdropTone);
  const previewBannerStyle = getSafeBackgroundImageStyle(formValues.heroImage);
  const aboutPreview = getPreviewSnippet(
    formValues.aboutContent || formValues.bio,
    'Your page preview updates live as you switch presets and edit the copy.'
  );
  const featurePreview = getPreviewSnippet(
    formValues.journalContent ||
      formValues.mediaContent ||
      formValues.topFiveContent ||
      formValues.tourContent ||
      formValues.merchContent ||
      formValues.recommendContent ||
      formValues.requestContent ||
      formValues.upcomingContent ||
      formValues.previousShowHighlights,
    'Use the preset picker to try a few different moods before you save.'
  );
  const visualDropSlots = useMemo<VisualDropStudioSlot<EditableFieldKey>[]>(
    () => [
      {
        id: 'heroImage',
        label: 'Background',
        description: 'Hero/banner artwork behind the top of the page.',
        kind: 'image',
        value: formValues.heroImage,
        placeholder: 'Drop background'
      },
      {
        id: 'logoImage',
        label: 'Logo / badge',
        description: 'A mark that sits near the page title.',
        kind: 'image',
        value: formValues.logoImage || formValues.avatarImage,
        placeholder: 'Drop logo'
      },
      {
        id: 'galleryImage',
        label: 'Feature image',
        description: 'A supporting image for about, media, or event sections.',
        kind: 'image',
        value: formValues.galleryImage,
        placeholder: 'Drop image'
      },
      {
        id: 'mediaContent',
        label: 'Links / media notes',
        description: 'Drop a link or paste text that should live in the media area.',
        kind: 'link',
        value: formValues.mediaContent,
        placeholder: 'Drop link'
      }
    ],
    [
      formValues.avatarImage,
      formValues.galleryImage,
      formValues.heroImage,
      formValues.logoImage,
      formValues.mediaContent
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
    setMessage(`${preset.label} applied to the page preview.`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      headline: formValues.headline,
      bio: formValues.bio,
      heroImage: formValues.heroImage,
      avatarImage: formValues.avatarImage,
      logoImage: formValues.logoImage,
      galleryImage: formValues.galleryImage,
      aboutContent: formValues.aboutContent,
      journalContent: formValues.journalContent,
      mediaContent: formValues.mediaContent,
      tourContent: formValues.tourContent,
      merchContent: formValues.merchContent,
      requestContent: formValues.requestContent,
      recommendContent: formValues.recommendContent,
      topFiveContent: formValues.topFiveContent,
      addressLine1: formValues.addressLine1,
      contactInfo: formValues.contactInfo,
      hoursText: formValues.hoursText,
      hometown: formValues.hometown,
      city: formValues.city,
      stateRegion: formValues.stateRegion,
      postalCode: formValues.postalCode,
      country: formValues.country,
      parkingDetails: formValues.parkingDetails,
      stayRecommendations: formValues.stayRecommendations,
      upcomingContent: formValues.upcomingContent,
      previousShowHighlights: formValues.previousShowHighlights
    };

    if (enableDesignCustomizer) {
      payload.themePreset = formValues.themePreset;
      payload.themeFontPreset = formValues.themeFontPreset;
      payload.themeAccentTone = formValues.themeAccentTone;
      payload.themeBackdropTone = formValues.themeBackdropTone;
      payload.fanShareEnabled = allowFanShareToggle ? formValues.fanShareEnabled : false;
    }

    const response = await fetch(`/api/profile-pages/${profileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      setMessage('Page updated.');
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not update this page');
    }

    setPending(false);
  }

  return (
    <section className="panel artist-editor">
      <div className="artist-editor-header">
        <div>
          <h2>{title}</h2>
          <p className="kicker">{description}</p>
        </div>
        {!hideToggle ? (
          <button
            className="button small secondary"
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            {isOpen ? 'Hide editor' : 'Edit page'}
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <form className="form" onSubmit={handleSubmit}>
          {enableDesignCustomizer ? (
            <section className="profile-design-customizer">
              <div className="profile-design-customizer-header">
                <div>
                  <h3>Page studio</h3>
                  <p className="meta">Mix a preset, font, color mood, and backdrop until the page feels like your own.</p>
                </div>
                <div className="profile-design-customizer-badges">
                  <span className="badge">{selectedPreset.label}</span>
                  <span className="profile-design-tone-pill">{selectedFontPreset.label}</span>
                  <span className="profile-design-tone-pill">{selectedAccentTone.label}</span>
                  <span className="profile-design-tone-pill">{selectedBackdropTone.label}</span>
                </div>
              </div>

              <div className="profile-design-studio-shell">
                <div className="profile-design-studio-column">
                  {quickSetupPresets.length ? (
                    <div className="profile-design-quickstart">
                      <div className="profile-design-tone-header">
                        <strong>Starter looks</strong>
                        <span className="meta">Apply a polished page direction in one click.</span>
                      </div>
                      <div className="profile-design-quickstart-grid">
                        {quickSetupPresets.map((preset) => (
                          <button
                            className="profile-design-quickstart-card"
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
                  ) : null}

                  <div className="profile-design-tone-group">
                    <div className="profile-design-tone-header">
                      <strong>Preset library</strong>
                      <span className="meta">Choose the page direction that feels closest, then refine it.</span>
                    </div>
                    <div className="profile-design-preset-grid">
                      {profileDesignPresets.map((preset) => (
                        <button
                          className={
                            preset.id === formValues.themePreset
                              ? 'profile-design-preset-card active'
                              : 'profile-design-preset-card'
                          }
                          key={preset.id}
                          onClick={() => setFormValues((current) => ({ ...current, themePreset: preset.id }))}
                          type="button"
                        >
                          <span>{preset.label}</span>
                          <small>{preset.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="profile-design-studio-preview-column">
                  <div className="profile-design-preview-frame">
                    <div
                      className="profile-design-preview-shell profile-design-shell"
                      style={getProfileDesignStyleVars(formValues.themePreset, {
                        accentTone: formValues.themeAccentTone,
                        backdropTone: formValues.themeBackdropTone,
                        fontPreset: formValues.themeFontPreset
                      })}
                    >
                      <div className="profile-design-preview-card">
                        <div className="profile-design-preview-hero" style={previewBannerStyle}>
                          <div className="profile-design-preview-topline">
                            <span className="badge">{previewRoleLabel}</span>
                            {allowFanShareToggle && formValues.fanShareEnabled ? (
                              <span className="profile-design-share-pill">Shared with fans</span>
                            ) : null}
                          </div>
                          <strong>{profileName}</strong>
                          <p className="profile-design-preview-headline">
                            {formValues.headline || 'Headline preview goes here.'}
                          </p>
                          <p className="profile-design-preview-copy">
                            {formValues.bio || 'This short intro updates live while you shape the final page mood.'}
                          </p>
                          {previewGenres.length ? (
                            <div className="tag-row">
                              {previewGenres.slice(0, 3).map((genre) => (
                                <span className="tag" key={genre}>
                                  {genre}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {previewTabs.length ? (
                          <div className="profile-design-preview-tabs">
                            {previewTabs.map((tab, index) => (
                              <span
                                className={index === 0 ? 'profile-design-preview-tab active' : 'profile-design-preview-tab'}
                                key={tab}
                              >
                                {tab}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="profile-design-preview-body">
                          <article className="profile-design-preview-panel">
                            <span className="profile-design-preview-label">About</span>
                            <p>{aboutPreview}</p>
                          </article>
                          <article className="profile-design-preview-panel">
                            <span className="profile-design-preview-label">Featured</span>
                            <p>{featurePreview}</p>
                          </article>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="profile-design-studio-column">
                  <div className="profile-design-tone-grid profile-design-tone-grid-compact">
                    <div className="profile-design-tone-group">
                      <div className="profile-design-tone-header">
                        <strong>Font mood</strong>
                        <span className="meta">Set the page voice quickly.</span>
                      </div>
                      <div className="profile-design-tone-chip-row">
                        {profileFontPresets.map((preset) => (
                          <button
                            className={
                              preset.id === formValues.themeFontPreset
                                ? 'profile-design-tone-chip active'
                                : 'profile-design-tone-chip'
                            }
                            key={preset.id}
                            onClick={() =>
                              setFormValues((current) => ({
                                ...current,
                                themeFontPreset: preset.id
                              }))
                            }
                            type="button"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="profile-design-tone-group">
                      <div className="profile-design-tone-header">
                        <strong>Accent color</strong>
                        <span className="meta">Controls highlights and active UI.</span>
                      </div>
                      <div className="profile-design-tone-chip-row">
                        {profileAccentTones.map((tone) => (
                          <button
                            className={
                              tone.id === formValues.themeAccentTone
                                ? 'profile-design-tone-chip active'
                                : 'profile-design-tone-chip'
                            }
                            key={tone.id}
                            onClick={() =>
                              setFormValues((current) => ({
                                ...current,
                                themeAccentTone: tone.id
                              }))
                            }
                            type="button"
                          >
                            {tone.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="profile-design-tone-group">
                      <div className="profile-design-tone-header">
                        <strong>Backdrop mood</strong>
                        <span className="meta">Changes the page atmosphere.</span>
                      </div>
                      <div className="profile-design-tone-chip-row">
                        {profileBackdropTones.map((tone) => (
                          <button
                            className={
                              tone.id === formValues.themeBackdropTone
                                ? 'profile-design-tone-chip active'
                                : 'profile-design-tone-chip'
                            }
                            key={tone.id}
                            onClick={() =>
                              setFormValues((current) => ({
                                ...current,
                                themeBackdropTone: tone.id
                              }))
                            }
                            type="button"
                          >
                            {tone.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <VisualDropStudio
                    description="Drag files from your desktop, tap to upload from your phone, or drop links into the media slot."
                    onChange={(slotId, value) =>
                      setFormValues((current) => {
                        if (slotId === 'logoImage') {
                          return { ...current, logoImage: value, avatarImage: value };
                        }

                        return { ...current, [slotId]: value };
                      })
                    }
                    onStatus={setMessage}
                    slots={visualDropSlots}
                    title="Place graphics, media, and links"
                  />

                  {allowFanShareToggle ? (
                    <label className="profile-design-share-toggle">
                      <input
                        checked={formValues.fanShareEnabled}
                        onChange={(event) =>
                          setFormValues((current) => ({ ...current, fanShareEnabled: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      <div>
                        <strong>Share this customized look with fans</strong>
                        <p className="meta">When this is on, fans see the saved preset on your public artist page.</p>
                      </div>
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="profile-design-field-grid">
                {editableFields.map((field) => (
                  <label className="field" key={field.key}>
                    <span>{field.label}</span>
                    {field.kind === 'textarea' ? (
                      <textarea
                        onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.placeholder}
                        rows={field.rows ?? 6}
                        value={formValues[field.key]}
                      />
                    ) : (
                      <input
                        maxLength={field.key === 'headline' ? 140 : undefined}
                        onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.placeholder}
                        type={field.kind === 'url' ? 'url' : 'text'}
                        value={formValues[field.key]}
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          ) : (
            fields.map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                {field.kind === 'textarea' ? (
                  <textarea
                    onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    rows={field.rows ?? 6}
                    value={formValues[field.key]}
                  />
                ) : (
                  <input
                    maxLength={field.key === 'headline' ? 140 : undefined}
                    onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    type={field.kind === 'url' ? 'url' : 'text'}
                    value={formValues[field.key]}
                  />
                )}
              </label>
            ))
          )}

          <div className="cta-row">
            <button className="button" disabled={pending} type="submit">
              {pending ? 'Saving...' : 'Save page'}
            </button>
            {message ? <span className="meta">{message}</span> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
