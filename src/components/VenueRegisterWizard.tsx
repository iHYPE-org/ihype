'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';
import {
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

type VenueRegisterFormValues = {
  name: string;
  username: string;
  email: string;
  password: string;
  contactInfo: string;
  headline: string;
  bio: string;
  heroImage: string;
  aboutContent: string;
  requestContent: string;
  addressLine1: string;
  hoursText: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  parkingDetails: string;
  stayRecommendations: string;
  upcomingContent: string;
  previousShowHighlights: string;
  themePreset: ProfileDesignPreset;
  themeAccentTone: ProfileAccentTone;
  themeBackdropTone: ProfileBackdropTone;
};

const defaultFormValues: VenueRegisterFormValues = {
  name: '',
  username: '',
  email: '',
  password: '',
  contactInfo: '',
  headline: '',
  bio: '',
  heroImage: '',
  aboutContent: '',
  requestContent: '',
  addressLine1: '',
  hoursText: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  country: '',
  parkingDetails: '',
  stayRecommendations: '',
  upcomingContent: '',
  previousShowHighlights: '',
  themePreset: 'midnight-neon',
  themeAccentTone: 'preset',
  themeBackdropTone: 'preset'
};

const steps = [
  {
    id: 'account',
    label: 'Account',
    title: 'Set up your venue account',
    description: 'Start with the venue name, owner login, and the public intro line.'
  },
  {
    id: 'look',
    label: 'Look',
    title: 'Choose the venue look',
    description: 'Pick the preset, highlight color, and background mood for the page.'
  },
  {
    id: 'operations',
    label: 'Ops',
    title: 'Add hours and location',
    description: 'Make the page useful with address details, hours, and an about section.'
  },
  {
    id: 'local',
    label: 'Local',
    title: 'Add visitor guidance',
    description: 'Share parking notes, nearby stays, and booking guidance for the request tab.'
  },
  {
    id: 'shows',
    label: 'Shows',
    title: 'Frame future show sections',
    description: 'Set the tone for how upcoming and previous shows will read once the venue goes live.'
  }
] as const;

function getPreviewSnippet(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 180 ? `${trimmed.slice(0, 177).trimEnd()}...` : trimmed;
}

function getLocationLine(values: VenueRegisterFormValues) {
  const mainLine = [values.addressLine1, values.city, values.stateRegion, values.postalCode]
    .filter(Boolean)
    .join(', ');

  return [mainLine, values.country].filter(Boolean).join(' | ');
}

export function VenueRegisterWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<VenueRegisterFormValues>({
    ...defaultFormValues
  });

  const activeStep = steps[stepIndex];
  const previewStyle = useMemo(
    () =>
      getProfileDesignStyleVars(formValues.themePreset, {
        accentTone: formValues.themeAccentTone,
        backdropTone: formValues.themeBackdropTone
      }),
    [formValues.themeAccentTone, formValues.themeBackdropTone, formValues.themePreset]
  );
  const locationLine = getLocationLine(formValues);
  const aboutPreview = getPreviewSnippet(
    formValues.aboutContent || formValues.bio,
    'Describe the room, the neighborhood, and what kind of nights belong here.'
  );
  const upcomingPreview = getPreviewSnippet(
    formValues.upcomingContent,
    'Upcoming shows will feel sharper if you set the room tone now, even before the first date is announced.'
  );
  const previousPreview = getPreviewSnippet(
    formValues.previousShowHighlights,
    'Once you start booking, use this section to recap the nights that defined the room.'
  );

  function updateField<Key extends keyof VenueRegisterFormValues>(key: Key, value: VenueRegisterFormValues[Key]) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'VENUE',
        ...formValues,
        themePreset: normalizeProfileDesignPreset(formValues.themePreset),
        themeAccentTone: normalizeProfileAccentTone(formValues.themeAccentTone),
        themeBackdropTone: normalizeProfileBackdropTone(formValues.themeBackdropTone)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Venue registration failed');
      setPending(false);
      return;
    }

    const destination = data.profilePath ?? '/auth/landing';
    const signInResult = await signIn('credentials', {
      identifier: formValues.username || formValues.email,
      password: formValues.password,
      redirect: false,
      callbackUrl: destination
    });

    if (signInResult?.error) {
      setMessage(
        data.profilePath
          ? `Venue account created. Sign in did not complete automatically, but your page is ready at ${data.profilePath}.`
          : 'Venue account created. Sign in did not complete automatically.'
      );
      setPending(false);
      return;
    }

    window.location.assign(signInResult?.url ?? destination);
    setPending(false);
  }

  return (
    <main className="container section register-shell">
      <div className="venue-register-layout">
        <section className="panel register-panel venue-wizard">
          <div className="register-header">
            <RegisterAccountChoices activeRole="VENUE" />
            <h1>Venue sign up</h1>
            <p className="kicker">
              Build the venue identity, location notes, and future show framing before the page goes live.
            </p>
            <div className="register-secondary-strip" aria-label="Secondary venue modules">
              {['Verification', 'Page Builder', 'Event Calendar', 'Ticketing'].map((module) => (
                <span className="register-secondary-pill" key={module}>
                  {module}
                </span>
              ))}
            </div>
            <div className="register-role-links">
              <Link className="button small secondary" href="/register">
                Back to fan sign up
              </Link>
            </div>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <div className="venue-wizard-step-row" aria-label="Venue sign up steps">
              {steps.map((step, index) => (
                <button
                  className={index === stepIndex ? 'venue-wizard-step active' : 'venue-wizard-step'}
                  key={step.id}
                  onClick={() => setStepIndex(index)}
                  type="button"
                >
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            <div className="venue-wizard-layout">
              <div className="venue-wizard-editor">
                <div className="venue-wizard-step-card">
                  <div className="venue-wizard-step-header">
                    <div>
                      <span className="badge">{activeStep.label}</span>
                      <h3>{activeStep.title}</h3>
                    </div>
                    <p className="meta">{activeStep.description}</p>
                  </div>

                  {activeStep.id === 'account' ? (
                    <div className="venue-wizard-field-grid">
                      <label className="field">
                        <span>Venue name</span>
                        <input
                          onChange={(event) => updateField('name', event.target.value)}
                          required
                          value={formValues.name}
                        />
                      </label>

                      <label className="field">
                        <span>Username</span>
                        <input
                          name="username"
                          onChange={(event) => updateField('username', event.target.value)}
                          required
                          value={formValues.username}
                        />
                      </label>

                      <label className="field">
                        <span>Recovery email</span>
                        <input
                          name="email"
                          onChange={(event) => updateField('email', event.target.value)}
                          required
                          type="email"
                          value={formValues.email}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Password</span>
                        <input
                          minLength={8}
                          onChange={(event) => updateField('password', event.target.value)}
                          required
                          type="password"
                          value={formValues.password}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Venue contact info</span>
                        <input
                          onChange={(event) => updateField('contactInfo', event.target.value)}
                          placeholder="bookings@venue.com | +1 555 101 3030"
                          value={formValues.contactInfo}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Headline banner</span>
                        <input
                          maxLength={140}
                          onChange={(event) => updateField('headline', event.target.value)}
                          placeholder="What kind of room are you opening?"
                          value={formValues.headline}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Short intro</span>
                        <textarea
                          onChange={(event) => updateField('bio', event.target.value)}
                          rows={3}
                          placeholder="Describe the room, crowd, and what kind of nights you want to host."
                          value={formValues.bio}
                        />
                      </label>
                    </div>
                  ) : null}

                  {activeStep.id === 'look' ? (
                    <div className="venue-wizard-field-grid">
                      <label className="field venue-wizard-field-span">
                        <span>Banner image URL</span>
                        <input
                          onChange={(event) => updateField('heroImage', event.target.value)}
                          placeholder="https://example.com/venue.jpg"
                          type="url"
                          value={formValues.heroImage}
                        />
                      </label>

                      <div className="venue-wizard-choice-group venue-wizard-field-span">
                        <div className="venue-wizard-choice-header">
                          <strong>Preset</strong>
                          <span className="meta">Start with the overall venue mood.</span>
                        </div>
                        <div className="venue-wizard-choice-grid">
                          {profileDesignPresets.map((preset) => (
                            <button
                              className={
                                preset.id === formValues.themePreset
                                  ? 'venue-wizard-choice-card active'
                                  : 'venue-wizard-choice-card'
                              }
                              key={preset.id}
                              onClick={() => updateField('themePreset', preset.id)}
                              type="button"
                            >
                              <span>{preset.label}</span>
                              <small>{preset.description}</small>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="venue-wizard-choice-group">
                        <div className="venue-wizard-choice-header">
                          <strong>Accent color</strong>
                          <span className="meta">Control the glow on badges, tabs, and highlights.</span>
                        </div>
                        <div className="venue-wizard-chip-grid">
                          {profileAccentTones.map((tone) => (
                            <button
                              className={
                                tone.id === formValues.themeAccentTone
                                  ? 'venue-wizard-chip active'
                                  : 'venue-wizard-chip'
                              }
                              key={tone.id}
                              onClick={() => updateField('themeAccentTone', tone.id)}
                              type="button"
                            >
                              {tone.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="venue-wizard-choice-group">
                        <div className="venue-wizard-choice-header">
                          <strong>Background mood</strong>
                          <span className="meta">Shape the atmosphere behind the venue content.</span>
                        </div>
                        <div className="venue-wizard-chip-grid">
                          {profileBackdropTones.map((tone) => (
                            <button
                              className={
                                tone.id === formValues.themeBackdropTone
                                  ? 'venue-wizard-chip active'
                                  : 'venue-wizard-chip'
                              }
                              key={tone.id}
                              onClick={() => updateField('themeBackdropTone', tone.id)}
                              type="button"
                            >
                              {tone.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeStep.id === 'operations' ? (
                    <div className="venue-wizard-field-grid">
                      <label className="field venue-wizard-field-span">
                        <span>About the room</span>
                        <textarea
                          onChange={(event) => updateField('aboutContent', event.target.value)}
                          rows={5}
                          placeholder="Tell artists and promoters what the venue feels like, what it supports, and who it is for."
                          value={formValues.aboutContent}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Street address</span>
                        <input
                          onChange={(event) => updateField('addressLine1', event.target.value)}
                          placeholder="1234 W Example St"
                          value={formValues.addressLine1}
                        />
                      </label>

                      <label className="field">
                        <span>City</span>
                        <input onChange={(event) => updateField('city', event.target.value)} value={formValues.city} />
                      </label>

                      <label className="field">
                        <span>State / region</span>
                        <input
                          onChange={(event) => updateField('stateRegion', event.target.value)}
                          value={formValues.stateRegion}
                        />
                      </label>

                      <label className="field">
                        <span>Postal code</span>
                        <input
                          onChange={(event) => updateField('postalCode', event.target.value)}
                          value={formValues.postalCode}
                        />
                      </label>

                      <label className="field">
                        <span>Country</span>
                        <input
                          onChange={(event) => updateField('country', event.target.value)}
                          value={formValues.country}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Hours of operation</span>
                        <input
                          onChange={(event) => updateField('hoursText', event.target.value)}
                          placeholder="Thu-Sat 8PM-2AM"
                          value={formValues.hoursText}
                        />
                      </label>
                    </div>
                  ) : null}

                  {activeStep.id === 'local' ? (
                    <div className="venue-wizard-field-grid">
                      <label className="field venue-wizard-field-span">
                        <span>Parking details</span>
                        <textarea
                          onChange={(event) => updateField('parkingDetails', event.target.value)}
                          placeholder="Street parking windows, lot tips, rideshare drop-offs, or anything visitors should know."
                          rows={4}
                          value={formValues.parkingDetails}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Local stay recommendations</span>
                        <textarea
                          onChange={(event) => updateField('stayRecommendations', event.target.value)}
                          placeholder="Point touring artists and out-of-town fans to useful nearby stays, food, or coffee."
                          rows={4}
                          value={formValues.stayRecommendations}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Booking / request guidance</span>
                        <textarea
                          onChange={(event) => updateField('requestContent', event.target.value)}
                          placeholder="Tell fans and promoters what kind of artists or concepts you want recommended."
                          rows={4}
                          value={formValues.requestContent}
                        />
                      </label>
                    </div>
                  ) : null}

                  {activeStep.id === 'shows' ? (
                    <div className="venue-wizard-field-grid">
                      <label className="field venue-wizard-field-span">
                        <span>Upcoming section intro</span>
                        <textarea
                          onChange={(event) => updateField('upcomingContent', event.target.value)}
                          placeholder="Set the tone for your first upcoming shows and featured nights."
                          rows={4}
                          value={formValues.upcomingContent}
                        />
                      </label>

                      <label className="field venue-wizard-field-span">
                        <span>Previous show highlights</span>
                        <textarea
                          onChange={(event) => updateField('previousShowHighlights', event.target.value)}
                          placeholder="Capture the kind of history you want this room to build over time."
                          rows={4}
                          value={formValues.previousShowHighlights}
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="venue-wizard-footer">
                    <div className="venue-wizard-nav">
                      <button
                        className="button small secondary"
                        disabled={stepIndex === 0}
                        onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="button small secondary"
                        disabled={stepIndex === steps.length - 1}
                        onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}
                        type="button"
                      >
                        Next
                      </button>
                    </div>

                    <div className="cta-row">
                      <button className="button" disabled={pending} type="submit">
                        {pending ? 'Creating venue...' : 'Create venue account'}
                      </button>
                      {message ? <span className="meta">{message}</span> : null}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="venue-wizard-preview-column">
                <div className="profile-design-preview-shell profile-design-shell" style={previewStyle}>
                  <div className="profile-design-preview-card venue-wizard-preview-card">
                    <div className="profile-design-preview-hero venue-wizard-preview-hero">
                      <div className="profile-design-preview-topline">
                        <span className="badge">VENUE</span>
                        <span className="venue-wizard-preview-caption">Live preview</span>
                      </div>
                      <strong>{formValues.name || 'Your venue name'}</strong>
                      <p className="profile-design-preview-headline">
                        {formValues.headline || 'Set the room tone, neighborhood energy, and what kind of nights belong here.'}
                      </p>
                      <p className="profile-design-preview-copy">
                        {formValues.bio || 'A quick venue intro gives artists, promoters, and fans a feel for the room immediately.'}
                      </p>
                      <div className="tag-row">
                        <span className="tag">About</span>
                        <span className="tag">Upcoming</span>
                        <span className="tag">Previous</span>
                        <span className="tag">Request</span>
                        <span className="tag">Stats</span>
                      </div>
                    </div>

                    <div className="venue-wizard-preview-meta">
                      {locationLine ? <span>{locationLine}</span> : null}
                      {formValues.hoursText ? <span>{formValues.hoursText}</span> : null}
                    </div>

                    <div className="profile-design-preview-body venue-wizard-preview-grid">
                      <article className="profile-design-preview-panel">
                        <span className="profile-design-preview-label">About</span>
                        <p>{aboutPreview}</p>
                      </article>
                      <article className="profile-design-preview-panel">
                        <span className="profile-design-preview-label">Parking</span>
                        <p>
                          {getPreviewSnippet(
                            formValues.parkingDetails,
                            'Share arrival tips, parking windows, or rideshare notes so visitors know how to approach the room.'
                          )}
                        </p>
                      </article>
                      <article className="profile-design-preview-panel">
                        <span className="profile-design-preview-label">Stay Nearby</span>
                        <p>
                          {getPreviewSnippet(
                            formValues.stayRecommendations,
                            'Recommend nearby stays, food, or useful local stops for touring artists and out-of-town fans.'
                          )}
                        </p>
                      </article>
                      <article className="profile-design-preview-panel">
                        <span className="profile-design-preview-label">Upcoming</span>
                        <p>{upcomingPreview}</p>
                      </article>
                      <article className="profile-design-preview-panel">
                        <span className="profile-design-preview-label">Previous</span>
                        <p>{previousPreview}</p>
                      </article>
                      <article className="profile-design-preview-panel">
                        <span className="profile-design-preview-label">Request</span>
                        <p>
                          {getPreviewSnippet(
                            formValues.requestContent,
                            'Use the request tab to signal what kinds of artists, curators, or show concepts you want recommended.'
                          )}
                        </p>
                      </article>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
