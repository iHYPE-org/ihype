'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArtistUploadPolicy } from '@/components/ArtistUploadPolicy';

export type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

type RegisterFormProps = {
  defaultRole?: RegisterRole;
  lockedRole?: boolean;
  title?: string;
  intro?: string;
};

const roleLabels: Record<RegisterRole, string> = {
  FAN: 'Listener',
  ARTIST: 'Artist',
  DJ: 'Promoter',
  VENUE: 'Venue'
};

function requiresArtistUploadPolicy(role: RegisterRole) {
  return role === 'ARTIST' || role === 'DJ';
}

function getAudienceLabel(role: RegisterRole) {
  return role === 'ARTIST' ? 'artist' : 'promoter';
}

export function RegisterForm({
  defaultRole = 'FAN',
  lockedRole = false,
  title = 'Create account',
  intro = 'Create your account, then sign in with your email and password to start building your page.'
}: RegisterFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<RegisterRole>(defaultRole);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  const showPolicy = useMemo(() => requiresArtistUploadPolicy(selectedRole), [selectedRole]);

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
            <h1>{title}</h1>
            <p className="kicker">{intro}</p>
            {!lockedRole ? (
              <div className="register-role-links">
                <Link className="button small secondary" href="/register/artist">
                  Artist sign up
                </Link>
                <Link className="button small secondary" href="/register/promoter">
                  Promoter sign up
                </Link>
              </div>
            ) : (
              <div className="badge">Role locked: {roleLabels[selectedRole]}</div>
            )}
          </div>

          <form className="form" action={handleSubmit}>
            <div className="grid grid-2">
              <label className="field">
                <span>Name</span>
                <input name="name" required />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" required type="email" />
              </label>
            </div>

            <div className="grid grid-2">
              <label className="field">
                <span>Password</span>
                <input minLength={8} name="password" required type="password" />
              </label>
              {lockedRole ? (
                <label className="field">
                  <span>Role</span>
                  <input disabled value={roleLabels[selectedRole]} />
                </label>
              ) : (
                <label className="field">
                  <span>Role</span>
                  <select
                    defaultValue={defaultRole}
                    name="role"
                    onChange={(event) => {
                      const nextRole = event.target.value as RegisterRole;
                      setSelectedRole(nextRole);
                      if (!requiresArtistUploadPolicy(nextRole)) {
                        setAcceptedPolicy(false);
                      }
                    }}
                  >
                    <option value="FAN">Listener</option>
                    <option value="ARTIST">Artist</option>
                    <option value="DJ">Promoter</option>
                    <option value="VENUE">Venue</option>
                  </select>
                </label>
              )}
            </div>

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
