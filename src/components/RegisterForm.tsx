'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArtistUploadPolicy } from '@/components/ArtistUploadPolicy';
import { AuthConnectionMap } from '@/components/PageConnectionMap';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';

export type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

type RegisterFormProps = {
  defaultRole?: RegisterRole;
  title?: string;
  intro?: string;
};

type RoleConfig = {
  title: string;
  intro: string;
  primaryFields: Array<{
    name: string;
    label: string;
    type?: 'text' | 'email' | 'password';
    placeholder?: string;
    required?: boolean;
  }>;
  secondaryModules: string[];
};

const roleConfigs: Record<RegisterRole, RoleConfig> = {
  FAN: {
    title: 'Fan sign up',
    intro: 'Build a fan identity first, then shape your family-friendly sprite companion, page look, and top 5 from your dashboard.',
    primaryFields: [
      { name: 'name', label: 'Avatar name', placeholder: 'Night Owl' },
      { name: 'postalCode', label: 'Home ZIP code', placeholder: '60601' },
      { name: 'username', label: 'Username', placeholder: 'nightowl' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'fan@ihype.org' },
      { name: 'password', label: 'Password', type: 'password' }
    ],
    secondaryModules: ['Avatar Builder', 'Page Builder', 'Top 5']
  },
  ARTIST: {
    title: 'Artist sign up',
    intro:
      'Artist accounts can upload media, run events, and share a custom look with fans. Review the upload license before creating the page.',
    primaryFields: [
      { name: 'name', label: 'Artist name', placeholder: 'Nova Pulse' },
      { name: 'contactInfo', label: 'Contact info', placeholder: 'manager@artist.com | +1 555 101 2020' },
      { name: 'hometown', label: 'Hometown', placeholder: 'Chicago, IL' },
      { name: 'username', label: 'Username', placeholder: 'novapulse' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'artist@ihype.org' },
      { name: 'password', label: 'Password', type: 'password' }
    ],
    secondaryModules: ['Page Builder', 'Media Upload', 'Event Calendar']
  },
  DJ: {
    title: 'Promoter sign up',
    intro:
      'Promoter accounts can build a page, design an avatar, and create shows from artist uploads after accepting the limited-use policy.',
    primaryFields: [
      { name: 'name', label: 'Promoter name', placeholder: 'DJ Echo' },
      { name: 'username', label: 'Username', placeholder: 'djecho' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'promoter@ihype.org' },
      { name: 'password', label: 'Password', type: 'password' }
    ],
    secondaryModules: ['Page Builder', 'Avatar Builder', 'Show Creator']
  },
  VENUE: {
    title: 'Venue sign up',
    intro:
      'Venue accounts include ownership verification, a room page builder, calendar tools, and ticketing setup.',
    primaryFields: [
      { name: 'name', label: 'Venue name', placeholder: 'Neon Harbor' },
      { name: 'addressLine1', label: 'Venue address', placeholder: '41 Bogart Street' },
      { name: 'contactInfo', label: 'Venue contact info', placeholder: 'bookings@venue.com | +1 555 303 4040' },
      { name: 'username', label: 'Username', placeholder: 'neonharbor' },
      { name: 'email', label: 'Recovery email', type: 'email', placeholder: 'venue@ihype.org' },
      { name: 'password', label: 'Password', type: 'password' }
    ],
    secondaryModules: ['Verification', 'Page Builder', 'Event Calendar', 'Ticketing']
  }
};

function requiresArtistUploadPolicy(role: RegisterRole) {
  return role === 'ARTIST' || role === 'DJ';
}

function getAudienceLabel(role: RegisterRole) {
  return role === 'ARTIST' ? 'artist' : 'promoter';
}

function getRegisterHref(role: RegisterRole) {
  if (role === 'ARTIST') return '/register/artist';
  if (role === 'DJ') return '/register/promoter';
  if (role === 'VENUE') return '/register/venue';
  return '/register';
}

export function RegisterForm({
  defaultRole = 'FAN',
  title,
  intro
}: RegisterFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [isThirteenOrOlder, setIsThirteenOrOlder] = useState(false);
  const selectedRole = defaultRole;
  const roleConfig = roleConfigs[selectedRole];
  const registerHref = getRegisterHref(selectedRole);
  const showPolicy = requiresArtistUploadPolicy(selectedRole);
  const showAgeGate = selectedRole === 'FAN';

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    const payload = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue | boolean>;
    const email = String(payload.email ?? '');
    const password = String(payload.password ?? '');

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
            <h1>{title ?? roleConfig.title}</h1>
            <p className="kicker">{intro ?? roleConfig.intro}</p>
            <div className="register-secondary-strip" aria-label="Secondary setup modules">
              {roleConfig.secondaryModules.map((module) => (
                <span className="register-secondary-pill" key={module}>
                  {module}
                </span>
              ))}
            </div>
            <div className="register-role-links">
              <Link className="button small secondary" href="/login">
                Already have an account?
              </Link>
            </div>
          </div>

          <form className="form register-form-stack" action={handleSubmit}>
            {roleConfig.primaryFields.map((field) => (
              <label className="field" key={field.name}>
                <span>{field.label}</span>
                <input
                  minLength={field.name === 'password' ? 8 : undefined}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required ?? true}
                  type={field.type ?? 'text'}
                />
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
                  I am 13 or older and understand that the character lab only creates family-friendly companions.
                </span>
              </label>
            ) : null}

            <button className="button" type="submit">
              Create account
            </button>
            {message ? <p className="meta">{message}</p> : null}
          </form>

          <AuthConnectionMap active="register" registerHref={registerHref} />
        </div>

        {showPolicy ? <ArtistUploadPolicy audienceLabel={getAudienceLabel(selectedRole)} /> : null}
      </div>
    </main>
  );
}
