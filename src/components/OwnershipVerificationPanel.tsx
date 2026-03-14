'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type OwnershipVerificationPanelProps = {
  profileId: string;
  roleLabel: 'artist' | 'venue';
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  contactInfo: string | null;
  verificationNotes: string | null;
};

function getStatusCopy(status: OwnershipVerificationPanelProps['verificationStatus']) {
  if (status === 'VERIFIED') {
    return 'Ownership verified';
  }

  if (status === 'PENDING') {
    return 'Verification pending';
  }

  if (status === 'REJECTED') {
    return 'Needs resubmission';
  }

  return 'Verification required';
}

export function OwnershipVerificationPanel({
  profileId,
  roleLabel,
  verificationStatus,
  contactInfo,
  verificationNotes
}: OwnershipVerificationPanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contact, setContact] = useState(contactInfo ?? '');
  const [notes, setNotes] = useState(verificationNotes ?? '');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/profile-pages/${profileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactInfo: contact,
        verificationNotes: notes
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? 'Could not submit verification details.');
      setPending(false);
      return;
    }

    setMessage('Verification details submitted.');
    setPending(false);
    router.refresh();
  }

  return (
    <section className="panel verification-panel">
      <div className="verification-panel-header">
        <div>
          <div className="badge">Verification</div>
          <h2>{getStatusCopy(verificationStatus)}</h2>
          <p className="meta">
            {roleLabel === 'artist'
              ? 'Artist pages should confirm ownership before they are treated as officially verified.'
              : 'Venue pages should confirm venue ownership before they are treated as officially verified.'}
          </p>
        </div>
        <button className="button small secondary" onClick={() => setIsOpen((current) => !current)} type="button">
          {isOpen ? 'Hide verification' : 'Open verification'}
        </button>
      </div>

      {isOpen ? (
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Contact info</span>
            <input
              onChange={(event) => setContact(event.target.value)}
              placeholder="manager@artist.com | +1 555 101 3030"
              value={contact}
            />
          </label>
          <label className="field">
            <span>Verification notes</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Tell the iHYPE team how you can be reached and what proves this page belongs to you."
              rows={4}
              value={notes}
            />
          </label>
          <div className="cta-row">
            <button className="button" disabled={pending} type="submit">
              {pending ? 'Submitting...' : 'Submit verification'}
            </button>
            {message ? <span className="meta">{message}</span> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
