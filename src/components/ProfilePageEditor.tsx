'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfileAccentTone,
  getProfileBackdropTone,
  getProfileDesignPreset,
  getProfileDesignStyleVars,
  normalizeProfileAccentTone,
  normalizeProfileBackdropTone,
  normalizeProfileDesignPreset,
  profileAccentTones,
  profileBackdropTones,
  profileDesignPresets,
  type ProfileAccentTone,
  type ProfileBackdropTone,
  type ProfileDesignPreset
} from '@/lib/profile-design';

export type EditableFieldKey =
  | 'headline'
  | 'bio'
  | 'heroImage'
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
  themeAccentTone?: string;
  themeBackdropTone?: string;
  fanShareEnabled?: boolean;
};

type ProfilePageFormValues = Record<EditableFieldKey, string> & {
  themePreset: ProfileDesignPreset;
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
};

const defaultFormValues: Record<EditableFieldKey, string> = {
  headline: '',
  bio: '',
  heroImage: '',
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

function getPreviewSnippet(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 180 ? `${trimmed.slice(0, 177).trimEnd()}...` : trimmed;
}

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
  previewRoleLabel = 'PROFILE'
}: ProfilePageEditorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [formValues, setFormValues] = useState<ProfilePageFormValues>({
    ...defaultFormValues,
    ...initialValues,
    themePreset: normalizeProfileDesignPreset(initialValues.themePreset),
    themeAccentTone: normalizeProfileAccentTone(initialValues.themeAccentTone),
    themeBackdropTone: normalizeProfileBackdropTone(initialValues.themeBackdropTone),
    fanShareEnabled: Boolean(initialValues.fanShareEnabled)
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedPreset = getProfileDesignPreset(formValues.themePreset);
  const selectedAccentTone = getProfileAccentTone(formValues.themeAccentTone);
  const selectedBackdropTone = getProfileBackdropTone(formValues.themeBackdropTone);
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
      formValues.recommendContent,
    'Use the preset picker to try a few different moods before you save.'
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      headline: formValues.headline,
      bio: formValues.bio,
      heroImage: formValues.heroImage,
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
        <button
          className="button small secondary"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? 'Hide editor' : 'Edit page'}
        </button>
      </div>

      {isOpen ? (
        <form className="form" onSubmit={handleSubmit}>
          {fields.map((field) => (
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

          {enableDesignCustomizer ? (
            <section className="profile-design-customizer">
              <div className="profile-design-customizer-header">
                <div>
                  <h3>Visual preset</h3>
                  <p className="meta">Try a few looks and preview the page before you save it.</p>
                </div>
                <div className="profile-design-customizer-badges">
                  <span className="badge">{selectedPreset.label}</span>
                  <span className="profile-design-tone-pill">{selectedAccentTone.label}</span>
                  <span className="profile-design-tone-pill">{selectedBackdropTone.label}</span>
                </div>
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

              <div className="profile-design-tone-grid">
                <div className="profile-design-tone-group">
                  <div className="profile-design-tone-header">
                    <strong>Accent color</strong>
                    <span className="meta">Controls the glow color for highlights, chips, and tabs.</span>
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
                    <span className="meta">Changes the page atmosphere behind the content panels.</span>
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

              <div
                className="profile-design-preview-shell profile-design-shell"
                style={getProfileDesignStyleVars(formValues.themePreset, {
                  accentTone: formValues.themeAccentTone,
                  backdropTone: formValues.themeBackdropTone
                })}
              >
                <div className="profile-design-preview-card">
                  <div className="profile-design-preview-hero">
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
            </section>
          ) : null}

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
