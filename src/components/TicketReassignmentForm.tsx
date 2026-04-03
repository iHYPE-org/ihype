'use client';

import { useState } from 'react';

type TicketReassignmentFormProps = {
  serializedId: string;
  faceValueCents: number;
};

export function TicketReassignmentForm({
  serializedId,
  faceValueCents
}: TicketReassignmentFormProps) {
  const [newHolderName, setNewHolderName] = useState('');
  const [newHolderEmail, setNewHolderEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/tickets/${serializedId}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newHolderName: newHolderName.trim(),
        newHolderEmail: newHolderEmail.trim(),
        resalePriceCents: faceValueCents
      })
    });

    const data = await response.json();
    setPending(false);

    if (response.ok) {
      setNewHolderName('');
      setNewHolderEmail('');
      setMessage(data.message ?? 'Ticket reassigned.');
      return;
    }

    setMessage(data.error ?? 'Could not reassign this ticket.');
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="grid grid-2">
        <label className="field">
          <span>New holder name</span>
          <input onChange={(event) => setNewHolderName(event.target.value)} required value={newHolderName} />
        </label>
        <label className="field">
          <span>New holder email</span>
          <input onChange={(event) => setNewHolderEmail(event.target.value)} required type="email" value={newHolderEmail} />
        </label>
      </div>
      <div className="empty">
        Reassignment is locked to face value only. This token will be reissued for the same ticket value and emailed to the new holder.
      </div>
      <div className="cta-row">
        <button className="button small secondary" disabled={pending} type="submit">
          {pending ? 'Reassigning...' : 'Reassign ticket'}
        </button>
        {message ? <span className="meta">{message}</span> : null}
      </div>
    </form>
  );
}
