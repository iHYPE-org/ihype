'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPreviewSnippet } from '@/lib/text';
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

type VenueWizardShow = {
  id: string;
  title: string;
  startsAt: string;
};

type VenueWizardInitialValues = {
  headline?: string;
  bio?: string;
  heroImage?: string;
  aboutContent?: string;
  requestContent?: string;
  addressLine1?: string;
  contactInfo?: string;
  hoursText?: string;
  hometown?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  parkingDetails?: string;
  stayRecommendations?: string;
  upcomingContent?: string;
  previousShowHighlights?: string;
  themePreset?: string;
  themeAccentTone?: string;
  themeBackdropTone?: string;
};

type VenueWizardFormValues = {
  headline: string;
  bio: string;
  heroImage: string;
  aboutContent: string;
  requestContent: string;
  addressLine1: string;
  contactInfo: string;
  hoursText: string;
  hometown: string;
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

type VenuePageWizardProps = {
  profileId: string;
  profileName: string;
  initialValues: VenueWizardInitialValues;
  upcomingShows: VenueWizardShow[];
  previousShows: VenueWizardShow[];
};

const defaultFormValues: VenueWizardFormValues = {
  headline: '',
  bio: '',
  heroImage: '',
  aboutContent: '',
  requestContent: '',
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
  previousShowHighlights: '',
  themePreset: 'midnight-neon',
  themeAccentTone: 'preset',
  themeBackdropTone: 'preset'
};

const steps = [
  {
    id: 'look',
    label: 'Look',
    title: 'Pick the venue mood',
    description: 'Choose the preset, accent color, background atmosphere, and hero copy.'
  },
  {
    id: 'operations',
    label: 'Ops',
    title: 'Set hours and location',
    description: 'Keep the venue banner useful with address, location, and operational details.'
  },
  {
    id: 'local',
    label: 'Local',
    title: 'Add local guidance',
    description: 'Share parking tips, nearby places to stay, and booking notes for visitors.'
  },
  {
    id: 'shows',
    label: 'Shows',
    title: 'Shape the show sections',
    description: 'Add context for the upcoming and previous show panels on the public page.'
  }
] as const;


function formatShowDate(value: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getLocationLine(values: VenueWizardFormValues) {
  const mainLine = [values.addressLine1, values.city, values.stateRegion, values.postalCode]
    .filter(Boolean)
    .join(', ');

  return [mainLine, values.country].filter(Boolean).join(' | ');
}

export function VenuePageWizard({
  profileId,
  profileName,
  initialValues,
  upcomingShows,
  previousShows
}: VenuePageWizardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<VenueWizardFormValues>({
    ...defaultFormValues,
    ...initialValues,
    themePreset: normalizeProfileDesignPreset(initialValues.themePreset),
    themeAccentTone: normalizeProfileAccentTone(initialValues.themeAccentTone),
    themeBackdropTone: normalizeProfileBackdropTone(initialValues.themeBackdropTone)
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
    'Give the room a personality, share what it sounds like, and set expectations for the crowd.'
  );
  const upcomingPreview = getPreviewSnippet(
    formValues.upcomingContent,
    'Use this area to frame the upcoming calendar, featured nights, or what kind of bookings are coming next.'
  );
  const previousPreview = getPreviewSnippet(
    formValues.previousShowHighlights,
    'Capture sold-out nights, standout bills, or the kind of energy past shows have created in the room.'
  );

  function updateField<Key extends keyof VenueWizardFormValues>(key: Key, value: VenueWizardFormValues[Key]) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/profile-pages/${profileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: formValues.headline,
        bio: formValues.bio,
        heroImage: formValues.heroImage,
        aboutContent: formValues.aboutContent,
        requestContent: formValues.requestContent,
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
        previousShowHighlights: formValues.previousShowHighlights,
        themePreset: formValues.themePreset,
        themeAccentTone: formValues.themeAccentTone,
        themeBackdropTone: formValues.themeBackdropTone
      })
    });

    const data = await response.json();

    if (response.ok) {
      setMessage('Venue page updated.');
      router.refresh();
    } else {
      setMessage(data.error ?? 'Could not update this venue page.');
    }

    setPending(false);
  }

  return (
    <section className="panel venue-wizard">
      <div className="artist-editor-header">
        <div>
          <h2>Customize your venue page</h2>
          <p className="kicker">
            Use the wizard to shape the venue look, update room logistics, and add context around upcoming and previous shows.
          </p>
        </div>
        <button
          className="button small secondary"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? 'Hide wizard' : 'Open wizard'}
        </button>
      </div>

      {isOpen ? (
        <form className="form" onSubmit={handleSubmit}>
          <div className="venue-wizard-step-row" aria-label="Venue customization steps">
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

                {activeStep.id === 'look' ? (
                  <div className="venue-wizard-field-grid">
                    <label className="field">
                      <span>Headline banner</span>
                      <input
                        maxLength={140}
                        onChange={(event) => updateField('headline', event.target.value)}
                        placeholder="What makes this room special?"
                        value={formValues.headline}
                      />
                    </label>

                    <label className="field">
                      <span>Banner image URL</span>
                      <input
                        onChange={(event) => updateField('heroImage', event.target.value)}
                        placeholder="https://example.com/venue.jpg"
                        type="url"
                        value={formValues.heroImage}
                      />
                    </label>

                    <label className="field venue-wizard-field-span">
                      <span>Short intro</span>
                      <textarea
                        onChange={(event) => updateField('bio', event.target.value)}
                        rows={3}
                        placeholder="Give the room a quick read for artists, fans, and promoters."
                        value={formValues.bio}
                      />
                    </label>

                    <div className="venue-wizard-choice-group venue-wizard-field-span">
                      <div className="venue-wizard-choice-header">
                        <strong>Preset</strong>
                        <span className="meta">Start with the overall page look.</span>
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
                        <span className="meta">Pick the glow color for tabs, badges, and highlights.</span>
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
                        <span className="meta">Adjust the atmosphere behind the venue content.</span>
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
                        placeholder="Describe the room, crowd, production setup, or the kinds of nights that belong here."
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

                    <label className="field venue-wizard-field-span">
                      <span>Venue contact info</span>
                      <input
                        onChange={(event) => updateField('contactInfo', event.target.value)}
                        placeholder="bookings@venue.com | +1 555 101 3030"
                        value={formValues.contactInfo}
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
                      <input onChange={(event) => updateField('country', event.target.value)} value={formValues.country} />
                    </label>

                    <label className="field venue-wizard-field-span">
                      <span>Hours of operation</span>
                      <input
                        onChange={(event) => updateField('hoursText', event.target.value)}
                        placeholder="Thu-Sat 8PM-2AM"
                        value={formValues.hoursText}
                      />
                    </label>

                    <label className="field venue-wizard-field-span">
                      <span>Local stay area</span>
                      <input
                        onChange={(event) => updateField('hometown', event.target.value)}
                        placeholder="Rainey Street / Downtown"
                        value={formValues.hometown}
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
                        rows={4}
                        placeholder="Street parking windows, paid lot info, rideshare drop-off notes, or neighborhood arrival tips."
                        value={formValues.parkingDetails}
                      />
                    </label>

                    <label className="field venue-wizard-field-span">
                      <span>Local stay recommendations</span>
                      <textarea
                        onChange={(event) => updateField('stayRecommendations', event.target.value)}
                        rows={4}
                        placeholder="Recommend nearby hotels, late-night food, coffee spots, or local places visiting artists should know."
                        value={formValues.stayRecommendations}
                      />
                    </label>

                    <label className="field venue-wizard-field-span">
                      <span>Booking / request guidance</span>
                      <textarea
                        onChange={(event) => updateField('requestContent', event.target.value)}
                        rows={4}
                        placeholder="Tell fans and promoters what kind of artists or concepts you want recommended."
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
                        rows={4}
                        placeholder="Frame the upcoming calendar, highlight featured nights, or explain what’s next for the room."
                        value={formValues.upcomingContent}
                      />
                    </label>

                    <label className="field venue-wizard-field-span">
                      <span>Previous show highlights</span>
                      <textarea
                        onChange={(event) => updateField('previousShowHighlights', event.target.value)}
                        rows={4}
                        placeholder="Recap standout bookings, crowd energy, sold-out runs, or memorable past productions."
                        value={formValues.previousShowHighlights}
                      />
                    </label>

                    <div className="venue-wizard-show-grid venue-wizard-field-span">
                      <article className="venue-wizard-show-card">
                        <strong>Upcoming on page</strong>
                        {upcomingShows.length ? (
                          <ul className="venue-wizard-show-list">
                            {upcomingShows.slice(0, 4).map((show) => (
                              <li key={show.id}>
                                <span>{show.title}</span>
                                <small>{formatShowDate(show.startsAt)}</small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="meta">No upcoming shows yet. Use the scheduler below to add one.</p>
                        )}
                      </article>

                      <article className="venue-wizard-show-card">
                        <strong>Previous on page</strong>
                        {previousShows.length ? (
                          <ul className="venue-wizard-show-list">
                            {previousShows.slice(0, 4).map((show) => (
                              <li key={show.id}>
                                <span>{show.title}</span>
                                <small>{formatShowDate(show.startsAt)}</small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="meta">Previous shows will appear here automatically once events end.</p>
                        )}
                      </article>
                    </div>
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
                      {pending ? 'Saving...' : 'Save venue page'}
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
                    <strong>{profileName}</strong>
                    <p className="profile-design-preview-headline">
                      {formValues.headline || 'Set the room tone, city energy, or what kind of nights belong here.'}
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
      ) : null}
    </section>
  );
}
