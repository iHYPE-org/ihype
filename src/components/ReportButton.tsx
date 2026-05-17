'use client';

import { useState } from 'react';

export function ReportButton({
  entityType,
  entityId
}: {
  entityType: string;
  entityId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy || !reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, reason: reason.trim() })
      });
      if (res.ok) {
        setDone(true);
        setOpen(false);
        setReason('');
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="meta" style={{ fontSize: 12 }}>
        Report submitted. Thank you.
      </span>
    );
  }

  return (
    <>
      <button
        className="button small secondary"
        onClick={() => setOpen(true)}
        type="button"
        style={{ fontSize: 11 }}
      >
        Report
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="panel"
            style={{ width: 360, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>Submit a report</h3>
            <p className="meta" style={{ margin: 0, fontSize: 12 }}>
              Describe why this content should be reviewed.
            </p>
            <textarea
              style={{
                width: '100%',
                minHeight: 100,
                padding: 8,
                borderRadius: 6,
                border: '1px solid var(--line)',
                background: 'var(--bg-2)',
                color: 'var(--ink)',
                fontSize: 13,
                resize: 'vertical'
              }}
              maxLength={500}
              placeholder="Reason (max 500 chars)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="button small secondary"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button small"
                disabled={busy || !reason.trim()}
                onClick={submit}
                type="button"
              >
                {busy ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
