'use client';

import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';
import { slugify } from '@/lib/utils';

type ArtistQuickStartValues = {
  name: string;
  hometown: string;
  username: string;
  email: string;
  password: string;
};

function buildUsernameSuggestion(name: string) {
  const suggested = slugify(name).replace(/-/g, '');
  return suggested.slice(0, 20);
}

export function ArtistQuickStartRegister() {
  const [values, setValues] = useState<ArtistQuickStartValues>({
    name: '',
    hometown: '',
    username: '',
    email: '',
    password: ''
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [usernameEdited, setUsernameEdited] = useState(false);

  const usernameSuggestion = useMemo(() => buildUsernameSuggestion(values.name), [values.name]);

  function updateField<K extends keyof ArtistQuickStartValues>(key: K, value: ArtistQuickStartValues[K]) {
    setValues((current) => {
      if (key === 'name' && !usernameEdited) {
        return {
          ...current,
          name: String(value),
          username: buildUsernameSuggestion(String(value))
        };
      }

      return {
        ...current,
        [key]: value
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ARTIST',
        name: values.name,
        hometown: values.hometown,
        username: values.username,
        email: values.email,
        password: values.password,
        acceptedArtistUploadPolicy: acceptedPolicy
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not create your artist account.');
      setPending(false);
      return;
    }

    const destination = data.profileId
      ? `/dashboard?profile=${data.profileId}&setup=artist-quickstart`
      : '/artists';

    const signInResult = await signIn('credentials', {
      identifier: String(data.username ?? values.email),
      password: values.password,
      redirect: false,
      callbackUrl: destination
    });

    if (signInResult?.error) {
      setMessage('Account created. Sign-in did not finish automatically, but your artist quick start is ready in the dashboard.');
      setPending(false);
      return;
    }

    window.location.assign(signInResult?.url ?? destination);
  }

  return (
    <main className="container section register-shell">
      <div className="register-grid">
        <section className="panel register-panel artist-quickstart-register">
          <div className="register-header">
            <RegisterAccountChoices activeRole="ARTIST" />
            <div className="artist-quickstart-register-copy">
              <div className="badge">Artist quick start</div>
              <h1>Get your artist page live without the heavy setup.</h1>
              <p className="subtitle">
                Start with the essentials now. After account creation, we take you straight into a guided 3-step
                builder: upload one song, add your visuals, then launch your page.
              </p>
            </div>
          </div>

          <div className="artist-quickstart-step-strip" aria-label="Artist quick start steps">
            <div className="artist-quickstart-step-card">
              <strong>1. Upload a song</strong>
              <span>Give people something to hear right away.</span>
            </div>
            <div className="artist-quickstart-step-card">
              <strong>2. Add a look</strong>
              <span>Choose a banner, logo, and starter page mood.</span>
            </div>
            <div className="artist-quickstart-step-card">
              <strong>3. Launch</strong>
              <span>Publish the page once it feels like you.</span>
            </div>
          </div>

          <form className="form register-form-stack artist-quickstart-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Artist name</span>
              <input
                onChange={(event) => updateField('name', event.target.value)}
                autoComplete="organization"
                placeholder="Nova Pulse"
                required
                value={values.name}
              />
            </label>

            <label className="field">
              <span>Public handle</span>
              <input
                onChange={(event) => {
                  setUsernameEdited(true);
                  updateField('username', event.target.value.toLowerCase());
                }}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="novapulse"
                required
                value={values.username}
              />
              {usernameSuggestion && !usernameEdited ? (
                <span className="field-hint">Suggested from your artist name: {usernameSuggestion}</span>
              ) : null}
            </label>

            <label className="field">
              <span>Recovery email</span>
              <input
                onChange={(event) => updateField('email', event.target.value)}
                autoCapitalize="none"
                autoComplete="email"
                placeholder="artist@example.com"
                required
                type="email"
                value={values.email}
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                minLength={8}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete="new-password"
                required
                type="password"
                value={values.password}
              />
              <span className="field-hint">Use at least 8 characters with a letter and a number.</span>
            </label>

            <label className="field">
              <span>Hometown (optional)</span>
              <input
                onChange={(event) => updateField('hometown', event.target.value)}
                autoComplete="address-level2"
                placeholder="Chicago, IL"
                value={values.hometown}
              />
            </label>

            <label className="checkbox-row register-checkbox">
              <input
                checked={acceptedPolicy}
                onChange={(event) => setAcceptedPolicy(event.target.checked)}
                required
                type="checkbox"
              />
              <span>
                I agree to the iHYPE.org Artist Upload &amp; Limited Use License Policy so uploaded music and media
                can be hosted and streamed through the platform.
              </span>
            </label>

            <div className="artist-quickstart-register-note">
              <span className="badge">After signup</span>
              <p>You can add contact links, more page sections, tour notes, merch, and richer styling after your starter page is live.</p>
            </div>

            <button className="button" disabled={pending} type="submit">
              {pending ? 'Creating artist quick start...' : 'Create artist account'}
            </button>
            {message ? <p className="meta">{message}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}
