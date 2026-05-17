'use client';
import { useState, useEffect, useRef } from 'react';
import { BottomSheet } from '@/components/BottomSheet';

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [sent, setSent] = useState(false);
  const errors = useRef<string[]>([]);

  useEffect(() => {
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      errors.current = [...errors.current.slice(-4), args.map(String).join(' ')];
      orig(...args);
    };
    return () => { console.error = orig; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/bug-report', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ description: desc, url: window.location.href, errors: errors.current, viewport: `${window.innerWidth}x${window.innerHeight}` }) });
    setSent(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="bug-report-btn"
        style={{
          position: 'fixed',
          zIndex: 150,
          width: 36,
          height: 36,
          left: 16,
          borderRadius: '50%',
          background: 'var(--bg-3)',
          border: '1px solid var(--line)',
          cursor: 'pointer',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >?</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Report a bug">
        {sent ? <p>Thanks! We&apos;ll look into it.</p> : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea className="input" placeholder="What went wrong?" required rows={4} value={desc} onChange={e => setDesc(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="button" type="submit">Send report</button>
              <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </BottomSheet>
    </>
  );
}
