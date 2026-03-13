'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl
    });

    if (result?.error) {
      setMessage('Invalid email or password.');
      setPending(false);
      return;
    }

    router.push(result?.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <main className="container section">
      <div className="panel" style={{ padding: '1.5rem', maxWidth: 640 }}>
        <h1>Login</h1>
        <p className="kicker">
          Demo users: fan@ihype.org, dj@ihype.org, artist@ihype.org, venue@ihype.org. Password: demo12345.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button className="button" disabled={pending} type="submit">
            {pending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {message ? (
          <p className="meta" style={{ marginTop: '1rem' }}>
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
