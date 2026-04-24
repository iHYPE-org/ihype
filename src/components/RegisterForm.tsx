'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArtistUploadPolicy } from '@/components/ArtistUploadPolicy';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';

export type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

type RegisterFormProps = {
  defaultRole: RegisterRole;
};

type RegisterFormValues = {
  name: string;
  contactInfo: string;
  hometown: string;
  postalCode: string;
  username: string;
  email: string;
  password: string;
  addressLine1: string;
};

type RoleConfig = {
  badge: string;
  title: string;
  subtitle: string;
  nextStep: string;
  setupHighlights: string[];
  primaryFields: Array<{
    name: string;
    label: string;
    type?: 'text' | 'email' | 'password';
    placeholder?: string;
    required?: boolean;
    autoComplete?: string;
    inputMode?: 'text' | 'email' | 'numeric';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  }>;
};

const roleConfigs: Record<RegisterRole, RoleConfig> = {
  FAN: {
    badge: 'Fan sign up',
    title: 'Build your fan identity fast.',
    subtitle: 'Start with the essentials, then shape your page and presets after account creation.',
    nextStep: 'After signup you land in the fan discover lane, and your page editor stays in the dashboard.',
    setupHighlights: ['Local discovery', 'Playlists', 'Preset-based profile'],
    primaryFields: [
      { name: 'postalCode', label: 'Home ZIP code', placeholder: '60601', inputMode: 'numeric', autoComplete: 'postal-code', autoCapitalize: 'none' },
      { name: 'username', label: 'Username', placeholder: 'nightowl', autoComplete: 'username', autoCapitalize: 'none' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'fan@ihype.org', autoComplete: 'email', autoCapitalize: 'none' },
      { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' }
    ]
  },
  ARTIST: {
    badge: 'Artist sign up',
    title: 'Create the artist account first.',
    subtitle: 'Start with your name, contact, and hometown, then move into the faster page-launch flow.',
    nextStep: 'Once your account is created, you can upload media and finish the page in the dashboard.',
    setupHighlights: ['Music uploads', 'Booking-ready page', 'Visual presets'],
    primaryFields: [
      { name: 'name', label: 'Artist name', placeholder: 'Nova Pulse', autoComplete: 'organization' },
      { name: 'contactInfo', label: 'Contact info', placeholder: 'manager@artist.com | +1 555 101 2020', autoComplete: 'email' },
      { name: 'hometown', label: 'Hometown', placeholder: 'Chicago, IL', autoComplete: 'address-level2' },
      { name: 'username', label: 'Username', placeholder: 'novapulse', autoComplete: 'username', autoCapitalize: 'none' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'artist@ihype.org', autoComplete: 'email', autoCapitalize: 'none' },
      { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' }
    ]
  },
  DJ: {
    badge: 'Promoter sign up',
    title: 'Create your promoter account cleanly.',
    subtitle: 'Get into discover quickly, then move into shows, events, and page setup afterward.',
    nextStep: 'After signup you can move straight into the promoter workspace and show tools.',
    setupHighlights: ['Show creator', 'Discover page', 'Promoter profile'],
    primaryFields: [
      { name: 'name', label: 'Promoter name', placeholder: 'DJ Echo', autoComplete: 'organization' },
      { name: 'username', label: 'Username', placeholder: 'djecho', autoComplete: 'username', autoCapitalize: 'none' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'promoter@ihype.org', autoComplete: 'email', autoCapitalize: 'none' },
      { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' }
    ]
  },
  VENUE: {
    badge: 'Venue sign up',
    title: 'Create the venue account, then shape the room.',
    subtitle: 'Set the essentials now and continue through the guided venue setup after account creation.',
    nextStep: 'You can keep refining the venue page, event details, and ticketing flow after the account is created.',
    setupHighlights: ['Guided venue wizard', 'Events + ticketing', 'Room customization'],
    primaryFields: [
      { name: 'name', label: 'Venue name', placeholder: 'Neon Harbor', autoComplete: 'organization' },
      { name: 'addressLine1', label: 'Venue address', placeholder: '41 Bogart Street', autoComplete: 'street-address' },
      { name: 'contactInfo', label: 'Venue contact info', placeholder: 'bookings@venue.com | +1 555 303 4040', autoComplete: 'email' },
      { name: 'username', label: 'Username', placeholder: 'neonharbor', autoComplete: 'username', autoCapitalize: 'none' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'venue@ihype.org', autoComplete: 'email', autoCapitalize: 'none' },
      { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' }
    ]
  }
};

function requiresArtistUploadPolicy(role: RegisterRole) {
  return role === 'ARTIST' || role === 'DJ';
}

function getAudienceLabel(role: RegisterRole) {
  return role === 'ARTIST' ? 'artist' : 'promoter';
}

export function RegisterForm({
  defaultRole
}: RegisterFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [isThirteenOrOlder, setIsThirteenOrOlder] = useState(false);
  const [formValues, setFormValues] = useState<RegisterFormValues>({
    name: '',
    contactInfo: '',
    hometown: '',
    postalCode: '',
    username: '',
    email: '',
    password: '',
    addressLine1: ''
  });
  const selectedRole = defaultRole;
  const roleConfig = roleConfigs[selectedRole];
  const showPolicy = requiresArtistUploadPolicy(selectedRole);
  const showAgeGate = selectedRole === 'FAN';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);
    const payload: Record<string, string | boolean> = {
      ...formValues
    };
    const email = formValues.email;
    const password = formValues.password;

    payload.role = selectedRole;
    payload.acceptedArtistUploadPolicy = showPolicy ? acceptedPolicy : true;
    payload.isThirteenOrOlder = showAgeGate ? isThirteenOrOlder : true;

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Registration failed');
      setPending(false);
      return;
    }

    const destination = data.profilePath ?? '/auth/landing';
    const signInResult = await signIn('credentials', {
      identifier: String(data.username ?? email),
      password,
      redirect: false,
      callbackUrl: destination
    });

    if (signInResult?.error) {
      setMessage(
        data.profilePath
          ? `Account created. Sign in did not complete automatically, but your page is ready at ${data.profilePath}.`
          : 'Account created. Sign in did not complete automatically.'
      );
      setPending(false);
      return;
    }

    window.location.assign(signInResult?.url ?? destination);
  }

  return (
    <main className="container section register-shell">
      <div className="register-grid">
        <div className="panel register-panel">
          <div className="register-header">
            <RegisterAccountChoices activeRole={selectedRole} />
            <div className="register-flow-copy">
              <div>
                <div className="badge">{roleConfig.badge}</div>
                <h1>{roleConfig.title}</h1>
                <p className="subtitle">{roleConfig.subtitle}</p>
              </div>
              <div className="register-flow-highlights" aria-label={`${roleConfig.badge} highlights`}>
                {roleConfig.setupHighlights.map((highlight) => (
                  <span className="register-flow-highlight" key={highlight}>
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <form className="form register-form-stack" onSubmit={handleSubmit}>
            {roleConfig.primaryFields.map((field) => (
              <label className="field" key={field.name}>
                <span>{field.label}</span>
                <input
                  minLength={field.name === 'password' ? 8 : undefined}
                  name={field.name}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      [field.name]:
                        field.name === 'username' || field.name === 'email'
                          ? event.target.value.toLowerCase()
                          : event.target.value
                    }))
                  }
                  placeholder={field.placeholder}
                  required={field.required ?? true}
                  type={field.type ?? 'text'}
                  autoCapitalize={field.autoCapitalize}
                  autoComplete={field.autoComplete}
                  inputMode={field.inputMode}
                  value={formValues[field.name as keyof RegisterFormValues] ?? ''}
                />
                {field.name === 'password' ? (
                  <span className="field-hint">Use at least 8 characters with a letter and a number.</span>
                ) : null}
              </label>
            ))}

            {showPolicy ? (
              <label className="checkbox-row register-checkbox">
                <input
                  checked={acceptedPolicy}
                  onChange={(event) => setAcceptedPolicy(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  I agree to the iHYPE.org Artist Upload &amp; Limited Use License Policy for {getAudienceLabel(selectedRole)} accounts.
                </span>
              </label>
            ) : null}

            {showAgeGate ? (
              <label className="checkbox-row register-checkbox">
                <input
                  checked={isThirteenOrOlder}
                  onChange={(event) => setIsThirteenOrOlder(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  I attest that I am 13 years of age or older and I recognize that iHYPE is not responsible for any content within.
                </span>
              </label>
            ) : null}

            <div className="register-submit-note">
              <span className="badge">After account creation</span>
              <p>{roleConfig.nextStep}</p>
            </div>

            <button className="button" disabled={pending} type="submit">
              {pending ? 'Creating account...' : 'Create account'}
            </button>
            {message ? <p className="meta">{message}</p> : null}
          </form>
        </div>

        {showPolicy ? <ArtistUploadPolicy audienceLabel={getAudienceLabel(selectedRole)} /> : null}
      </div>
    </main>
  );
}
