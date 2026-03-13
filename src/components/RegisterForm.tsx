'use client';

import { useState } from 'react';
import { ArtistUploadPolicy } from '@/components/ArtistUploadPolicy';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';

export type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

type RegisterFormProps = {
  defaultRole?: RegisterRole;
  title?: string;
  intro?: string;
};

function requiresArtistUploadPolicy(role: RegisterRole) {
  return role === 'ARTIST' || role === 'DJ';
}

function getAudienceLabel(role: RegisterRole) {
  return role === 'ARTIST' ? 'artist' : 'promoter';
}

export function RegisterForm({
  defaultRole = 'FAN',
  title = 'Create account',
  intro = 'Create your account, then sign in with your email and password to start building your page.'
}: RegisterFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const selectedRole = defaultRole;

  const showPolicy = requiresArtistUploadPolicy(selectedRole);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    const payload = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue | boolean>;

    payload.role = selectedRole;
    payload.acceptedArtistUploadPolicy = showPolicy ? acceptedPolicy : true;

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    setMessage(
      response.ok
        ? data.profilePath
          ? `Account created. Your page is ready at ${data.profilePath} after login, and your share ID is ${data.profileHexId}.`
          : 'Account created.'
        : data.error ?? 'Registration failed'
    );
  }

  return (
    <main className="container section register-shell">
      <div className="register-grid">
        <div className="panel register-panel">
          <div className="register-header">
            <RegisterAccountChoices activeRole={selectedRole} />
            <h1>{title}</h1>
            <p className="kicker">{intro}</p>
          </div>

          <form className="form" action={handleSubmit}>
            <label className="field">
              <span>Name</span>
              <input name="name" required />
            </label>

            <label className="field">
              <span>Email</span>
              <input name="email" required type="email" />
            </label>

            <label className="field">
              <span>Password</span>
              <input minLength={8} name="password" required type="password" />
            </label>

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

            <button className="button" type="submit">
              Create account
            </button>
            {message ? <p className="meta">{message}</p> : null}
          </form>
        </div>

        {showPolicy ? <ArtistUploadPolicy audienceLabel={getAudienceLabel(selectedRole)} /> : null}
      </div>
    </main>
  );
}
