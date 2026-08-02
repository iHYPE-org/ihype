'use client';

import { useState } from 'react';
import { createAlphaDiagnostics } from '@/lib/alpha-diagnostics';

export function AlphaQuickFeedback({ module }: { module: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [reference, setReference] = useState('');

  async function send() {
    if (state === 'sending') return;
    setState('sending');
    const diagnostics = createAlphaDiagnostics(module);
    try {
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'One-tap alpha feedback marker.',
          diagnostics,
        }),
      });
      if (!response.ok) throw new Error('feedback failed');
      setReference(diagnostics.errorId);
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <button aria-live="polite" disabled={state === 'sending'} onClick={() => void send()} type="button">
      {state === 'idle' && <>Send quick alpha signal <span>↗</span></>}
      {state === 'sending' && <>Sending… <span>·</span></>}
      {state === 'sent' && <>Sent · {reference} <span>✓</span></>}
      {state === 'error' && <>Could not send · retry <span>↻</span></>}
    </button>
  );
}
