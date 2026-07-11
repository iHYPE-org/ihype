'use client';

import { useState } from 'react';

export default function DmcaPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch('/api/dmca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, url, description })
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error ?? 'Submission failed.');
        setStatus('error');
      } else {
        setStatus('done');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <div className="badge">DMCA</div>
      <h1 className="title">Copyright Takedown</h1>
      <p className="subtitle">
        To report infringing content, complete the form below. We will review and respond within 5 business days. False claims may result in account suspension.
      </p>
      <p style={{ marginTop: 12, padding: '10px 14px', background: 'var(--hair-40)', borderRadius: 8, fontSize: 14 }}>
        For DMCA takedown requests, email{' '}
        <a href="mailto:dmca@ihype.org?subject=DMCA%20Takedown%20Request">dmca@ihype.org</a>{' '}
        with subject &ldquo;DMCA Takedown Request&rdquo;. We respond within 5 business days.
      </p>

      <section className="panel" style={{ marginTop: 24, padding: '1.5rem' }}>
        <h2 style={{ marginBottom: 8 }}>How the process works</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Submit the form below with your contact details, the infringing URL, and a description of your original work.</li>
          <li>We will acknowledge your request by email within 48 hours.</li>
          <li>If the claim is valid, the content will be removed within 5 business days.</li>
          <li>The content owner will be notified and may file a counter-notice.</li>
        </ol>
      </section>

      {status === 'done' ? (
        <div className="panel" style={{ marginTop: 24, padding: '1.5rem' }}>
          <p>Your DMCA request has been submitted. We will contact you at the email address provided.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="form-label">
            Your name
            <input
              className="input"
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full legal name"
            />
          </label>
          <label className="form-label">
            Your email
            <input
              className="input"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="form-label">
            Infringing URL
            <input
              className="input"
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ihype.org/..."
            />
          </label>
          <label className="form-label">
            Description of infringement
            <textarea
              className="input"
              required
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the original work you own and how it is being infringed."
              style={{ resize: 'vertical' }}
            />
          </label>
          {status === 'error' && <p style={{ color: 'var(--accent)' }}>{errorMsg}</p>}
          <button className="ihype-btn-primary" type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Submitting…' : 'Submit DMCA request'}
          </button>
        </form>
      )}
    </div>
  );
}
