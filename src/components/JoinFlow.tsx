'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

const ROLES = [
  { id: 'FAN',    label: 'Fan',    icon: '◎', desc: 'Discover music, buy tickets at face value, earn from referrals.' },
  { id: 'ARTIST', label: 'Artist', icon: '♪', desc: 'Sell tickets directly. Keep 45%. Build your fanbase.' },
  { id: 'VENUE',  label: 'Venue',  icon: '⬡', desc: 'Host events. Keep 45% of every ticket sold.' },
  { id: 'DJ',     label: 'DJ',     icon: '◈', desc: 'Run radio shows, promote events, earn from every ticket you move.' },
] as const;

type RoleId = typeof ROLES[number]['id'];

const CITIES = [
  'Portland, ME', 'Boston, MA', 'New York, NY', 'Austin, TX', 'Chicago, IL',
  'Los Angeles, CA', 'Seattle, WA', 'Nashville, TN', 'Denver, CO', 'Miami, FL',
];

const GENRES = [
  'Electronic', 'Hip-Hop', 'Indie Rock', 'R&B', 'Jazz', 'Metal',
  'Pop', 'Folk', 'Classical', 'Techno', 'House', 'Ambient', 'Punk', 'Soul', 'Reggae', 'Country',
];

const STEPS = ['Role', 'City', 'Music', 'Done'];

function StepDots({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: i === step ? 28 : 8, height: 8,
            borderRadius: 'var(--radius-pill, 9999px)',
            background: i <= step ? 'var(--accent, #ff5029)' : 'rgba(240,235,229,.15)',
            transition: 'all 0.3s ease',
          }} />
          {i === step && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.6rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5048)' }}>
              {s}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: 10, fontFamily: "var(--font-display, 'Syne', sans-serif)",
  fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all .15s',
};

const backBtn: React.CSSProperties = {
  padding: '14px 20px', background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
  color: 'var(--ink-2, #9e9080)', fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
  fontSize: '.9rem', cursor: 'pointer',
};

export function JoinFlow({ inviteOnly = false }: { inviteOnly?: boolean }) {
  const [step, setStep]     = useState(0);
  const [role, setRole]     = useState<RoleId | null>(null);
  const [city, setCity]     = useState('');
  const [cityQ, setCityQ]   = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredCities = CITIES.filter(c => c.toLowerCase().includes(cityQ.toLowerCase()));
  const toggleGenre = (g: string) =>
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : prev.length < 5 ? [...prev, g] : prev);

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  async function handleSubmit() {
    setError('');
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: role ?? 'FAN',
          city: city || undefined,
          isThirteenOrOlder: true,
          acceptedArtistUploadPolicy: role === 'ARTIST' || role === 'DJ',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Registration failed. Try again.');
      }
      // Sign in then redirect to welcome
      await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });
      window.location.href = `/welcome?role=${role ?? 'FAN'}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  /* Step 0 — Role */
  if (step === 0) return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
      <StepDots step={0} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5048)', marginBottom: 10 }}>Step 1 of 4</div>
      <h1 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontWeight: 800, fontSize: '2rem', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 8 }}>Who are you?</h1>
      <p style={{ fontSize: '.9rem', color: 'var(--ink-2, #9e9080)', marginBottom: 32, lineHeight: 1.6 }}>Pick your primary role. You can add others later.</p>
      <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
        {ROLES.map(r => (
          <button key={r.id} onClick={() => setRole(r.id)} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '18px 20px',
            background: role === r.id ? 'rgba(255,80,41,.08)' : 'rgba(255,255,255,.03)',
            border: role === r.id ? '1.5px solid var(--accent, #ff5029)' : '1px solid rgba(255,255,255,.07)',
            borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
          }}>
            <span style={{ fontSize: '1.4rem', width: 36, textAlign: 'center', flexShrink: 0 }}>{r.icon}</span>
            <div>
              <div style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontWeight: 700, fontSize: '1rem', color: 'var(--ink, #f0ebe5)', marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--ink-2, #9e9080)', lineHeight: 1.5 }}>{r.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={next} disabled={!role} style={{ ...btnBase, width: '100%', padding: '14px', background: role ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.06)', color: role ? '#fff' : 'var(--ink-3, #5a5048)', cursor: role ? 'pointer' : 'not-allowed' }}>
        Continue →
      </button>
      <p style={{ marginTop: 20, textAlign: 'center', fontSize: '.82rem', color: 'var(--ink-3, #5a5048)' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--ink-2, #9e9080)' }}>Log in →</Link>
      </p>
    </div>
  );

  /* Step 1 — City */
  if (step === 1) return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
      <StepDots step={1} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5048)', marginBottom: 10 }}>Step 2 of 4</div>
      <h1 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontWeight: 800, fontSize: '2rem', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 8 }}>Your city</h1>
      <p style={{ fontSize: '.9rem', color: 'var(--ink-2, #9e9080)', marginBottom: 28, lineHeight: 1.6 }}>We&apos;ll show you local events and artists first.</p>
      <input
        type="text" placeholder="Search cities…" value={cityQ}
        onChange={e => setCityQ(e.target.value)}
        style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'var(--ink, #f0ebe5)', fontFamily: "var(--font-body, 'DM Sans', sans-serif)", fontSize: '.9rem', marginBottom: 16, outline: 'none' }}
      />
      <div style={{ display: 'grid', gap: 8, marginBottom: 32, maxHeight: 260, overflowY: 'auto' }}>
        {filteredCities.map(c => (
          <button key={c} onClick={() => setCity(c)} style={{
            padding: '13px 16px', textAlign: 'left',
            background: city === c ? 'rgba(255,80,41,.08)' : 'rgba(255,255,255,.03)',
            border: city === c ? '1.5px solid var(--accent, #ff5029)' : '1px solid rgba(255,255,255,.07)',
            borderRadius: 10, color: 'var(--ink, #f0ebe5)', fontFamily: "var(--font-body, 'DM Sans', sans-serif)", fontSize: '.9rem', cursor: 'pointer', transition: 'all .15s',
          }}>{c}</button>
        ))}
        {cityQ && !filteredCities.length && (
          <button onClick={() => setCity(cityQ)} style={{ padding: '13px 16px', textAlign: 'left', background: 'rgba(255,80,41,.08)', border: '1.5px solid var(--accent, #ff5029)', borderRadius: 10, color: 'var(--ink, #f0ebe5)', fontFamily: "var(--font-body, 'DM Sans', sans-serif)", fontSize: '.9rem', cursor: 'pointer' }}>
            Use &ldquo;{cityQ}&rdquo;
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={back} style={backBtn}>← Back</button>
        <button onClick={next} disabled={!city} style={{ ...btnBase, flex: 1, padding: '14px', background: city ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.06)', color: city ? '#fff' : 'var(--ink-3, #5a5048)', cursor: city ? 'pointer' : 'not-allowed' }}>
          Continue →
        </button>
      </div>
    </div>
  );

  /* Step 2 — Genres */
  if (step === 2) return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
      <StepDots step={2} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5048)', marginBottom: 10 }}>Step 3 of 4</div>
      <h1 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontWeight: 800, fontSize: '2rem', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 8 }}>Your sound</h1>
      <p style={{ fontSize: '.9rem', color: 'var(--ink-2, #9e9080)', marginBottom: 28, lineHeight: 1.6 }}>Pick up to 5 genres. Seeds and events will match your taste.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
        {GENRES.map(g => {
          const sel = genres.includes(g);
          return (
            <button key={g} onClick={() => toggleGenre(g)} style={{
              padding: '9px 16px',
              background: sel ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.04)',
              border: sel ? '1.5px solid var(--accent, #ff5029)' : '1px solid rgba(255,255,255,.1)',
              borderRadius: 'var(--radius-pill, 9999px)',
              color: sel ? '#fff' : 'var(--ink-2, #9e9080)',
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)", fontSize: '.85rem',
              cursor: 'pointer', transition: 'all .15s',
              opacity: !sel && genres.length >= 5 ? 0.4 : 1,
            }}>{g}</button>
          );
        })}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5048)', textAlign: 'right', marginBottom: 20 }}>
        {genres.length} / 5 selected
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={back} style={backBtn}>← Back</button>
        <button onClick={next} disabled={genres.length === 0} style={{ ...btnBase, flex: 1, padding: '14px', background: genres.length ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.06)', color: genres.length ? '#fff' : 'var(--ink-3, #5a5048)', cursor: genres.length ? 'pointer' : 'not-allowed' }}>
          Continue →
        </button>
      </div>
    </div>
  );

  /* Step 3 — Confirm + create account */
  const selectedRole = ROLES.find(r => r.id === role);
  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
      <StepDots step={3} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5048)', marginBottom: 10 }}>Step 4 of 4</div>
      <h1 style={{ fontFamily: "var(--font-display, 'Syne', sans-serif)", fontWeight: 800, fontSize: '2rem', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 8 }}>Almost in.</h1>
      <p style={{ fontSize: '.9rem', color: 'var(--ink-2, #9e9080)', marginBottom: 28, lineHeight: 1.6 }}>Create your account to save your preferences.</p>

      <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Name', key: 'name', type: 'text', value: name, setter: setName, placeholder: 'Your name' },
            { label: 'Email', key: 'email', type: 'email', value: email, setter: setEmail, placeholder: 'you@example.com' },
            { label: 'Password', key: 'password', type: 'password', value: password, setter: setPassword, placeholder: '8+ chars, letters + numbers' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '.6rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3, #5a5048)', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input
                type={f.type} value={f.value} placeholder={f.placeholder}
                onChange={e => f.setter(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: 'var(--ink, #f0ebe5)', fontFamily: "var(--font-body, 'DM Sans', sans-serif)", fontSize: '.9rem', outline: 'none' }}
              />
            </div>
          ))}
        </div>

        {role && (
          <div style={{ padding: '14px', background: 'rgba(255,80,41,.06)', border: '1px solid rgba(255,80,41,.12)', borderRadius: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.62rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent, #ff5029)', marginBottom: 8 }}>Your setup</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', background: 'rgba(255,80,41,.12)', borderRadius: 9999, fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--accent, #ff5029)' }}>
                {selectedRole?.icon} {role}
              </span>
              {city && <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,.06)', borderRadius: 9999, fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-2, #9e9080)' }}>{city}</span>}
              {genres.slice(0, 3).map(g => (
                <span key={g} style={{ padding: '4px 10px', background: 'rgba(255,255,255,.06)', borderRadius: 9999, fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-2, #9e9080)' }}>{g}</span>
              ))}
              {genres.length > 3 && <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,.06)', borderRadius: 9999, fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3, #5a5048)' }}>+{genres.length - 3}</span>}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,80,41,.1)', border: '1px solid rgba(255,80,41,.25)', borderRadius: 8, marginBottom: 12, fontSize: '.85rem', color: 'var(--accent, #ff5029)' }}>
          {error}
        </div>
      )}

      <p style={{ fontSize: '.75rem', color: 'var(--ink-3, #5a5048)', textAlign: 'center', margin: '16px 0', lineHeight: 1.6 }}>
        By joining you agree to our{' '}
        <Link href="/terms" style={{ color: 'var(--ink-2, #9e9080)' }}>Terms of Service</Link>
        {' '}and{' '}
        <Link href="/privacy" style={{ color: 'var(--ink-2, #9e9080)' }}>Privacy Policy</Link>.
        <br />
        iHYPE takes 0% of ticket sales.{' '}
        <Link href="/charter" style={{ color: 'var(--accent, #ff5029)' }}>Read the charter →</Link>
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={back} style={backBtn} disabled={submitting}>← Back</button>
        <button
          onClick={handleSubmit}
          disabled={!email || !name || !password || submitting}
          style={{
            ...btnBase, flex: 1, padding: '14px',
            background: email && name && password && !submitting ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.06)',
            color: email && name && password && !submitting ? '#fff' : 'var(--ink-3, #5a5048)',
            cursor: email && name && password && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Creating account…' : 'Join iHYPE →'}
        </button>
      </div>
    </div>
  );
}
