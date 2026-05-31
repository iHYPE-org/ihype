'use client';

import React from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T, WMPill, WMChip, WMViewHead, WMCard } from './MobilePrimitives';

// ─── Screen: Studio ──────────────────────────────────────────
export function MobileScreenStudio({ data }: { data: WorkbenchData }) {
  const [disputeSheetShowId, setDisputeSheetShowId] = React.useState<string | null>(null);
  const [disputeReason, setDisputeReason] = React.useState('');
  const [disputeAmount, setDisputeAmount] = React.useState('');
  const [disputeState, setDisputeState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [embedCopied, setEmbedCopied] = React.useState(false);
  const [fanMailOpen, setFanMailOpen] = React.useState(false);
  const [fanMailSubject, setFanMailSubject] = React.useState('');
  const [fanMailContent, setFanMailContent] = React.useState('');
  const [fanMailState, setFanMailState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [scheduleDate, setScheduleDate] = React.useState('');

  const handleCopyEmbed = () => {
    const profileHexId = data.profileHexId ?? '';
    if (!profileHexId) return;
    const snippet = `<iframe src="https://ihype.org/embed/${profileHexId}" width="320" height="80" frameborder="0" scrolling="no" allow="autoplay" style="border-radius:12px;overflow:hidden"></iframe>`;
    navigator.clipboard.writeText(snippet).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2500);
    }).catch(() => {});
  };

  const handleFanMail = async () => {
    const profileId = data.profileId ?? '';
    if (!profileId || !fanMailSubject.trim() || !fanMailContent.trim()) return;
    setFanMailState('loading');
    try {
      const res = await fetch(`/api/profile/${profileId}/fan-mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: fanMailSubject, content: fanMailContent }),
      });
      setFanMailState(res.ok ? 'done' : 'error');
      if (res.ok) setTimeout(() => { setFanMailOpen(false); setFanMailState('idle'); setFanMailSubject(''); setFanMailContent(''); }, 2000);
    } catch { setFanMailState('error'); }
  };

  const handleDispute = async (showId: string) => {
    if (!disputeReason.trim()) return;
    setDisputeState('loading');
    try {
      const res = await fetch('/api/payouts/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId,
          reason: disputeReason,
          expectedAmountCents: Math.round(parseFloat(disputeAmount || '0') * 100),
        }),
      });
      setDisputeState(res.ok ? 'done' : 'error');
      if (res.ok) setTimeout(() => { setDisputeSheetShowId(null); setDisputeState('idle'); setDisputeReason(''); setDisputeAmount(''); }, 2000);
    } catch { setDisputeState('error'); }
  };

  const clips = [
    { n: '01', t: 'Intro — Welcome back',         m: 'Maya · spoken',               type: 'VOICE', d: '0:42' },
    { n: '02', t: 'Sundown',                      m: 'Maya Reyes · Halflight EP',   type: 'TRACK', d: '3:24' },
    { n: '03', t: 'Westline',                     m: 'Cobalt Hour · 15% co-host',   type: 'TRACK', d: '4:11' },
    { n: '04', t: 'Talk break — writing the bridge', m: 'Maya · 2:18',              type: 'VOICE', d: '2:18' },
    { n: '05', t: 'Underpass',                    m: 'Saint Hex · Night Architect', type: 'TRACK', d: '4:36' },
    { n: '06', t: 'Halflight',                    m: 'Maya Reyes · debut spin',     type: 'TRACK', d: '3:51' },
  ];
  const timeline = [
    { c: T.accent, f: 14, t: 'Intro' },
    { c: T.pink,   f: 18, t: 'Sundown' },
    { c: T.purple, f: 22, t: 'Westline' },
    { c: T.teal,   f: 8,  t: 'Talk' },
    { c: T.blue,   f: 20, t: 'Underpass' },
    { c: T.amber,  f: 18, t: 'Halflight' },
  ];

  return (
    <>
      <WMViewHead
        eyebrow="SHOW CREATOR · PRERECORDED RADIO"
        title="Studio"
        sub="Drag tracks into the timeline. Splits auto-calc: 45/45/10."
        actions={<>
          <WMChip>↥ Import</WMChip>
          <WMChip accent>⬤ Publish</WMChip>
          <WMChip onClick={handleCopyEmbed}>{embedCopied ? '✓ Copied!' : '⊞ Embed'}</WMChip>
          <WMChip onClick={() => setFanMailOpen(true)}>✉ Fan mail</WMChip>
        </>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Composer card */}
        <div style={{ background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${T.line}` }}>
            <div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 17, color: T.ink }}>Halflight FM · Ep 05</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em', marginTop: 3 }}>47:00 · 6 tracks · Sun Jun 22 · 10AM</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
              <WMPill tone="amber">SCHEDULED</WMPill>
              <WMPill>CO 15%</WMPill>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: T.bg3, borderRadius: 9, padding: 12, marginTop: 12, border: `1px solid ${T.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em', marginBottom: 8 }}>
              <span>00:00</span><span>15:00</span><span>30:00</span><span>47:00</span>
            </div>
            <div style={{ position: 'relative', height: 46, background: T.bg4, borderRadius: 5, display: 'flex', gap: 2, padding: 3, overflow: 'hidden' }}>
              {timeline.map((c, i) => (
                <div key={i} style={{
                  flex: `0 0 ${c.f}%`, height: '100%', background: c.c, borderRadius: 3,
                  display: 'flex', alignItems: 'center', padding: '0 6px',
                  fontFamily: T.fm, fontSize: 12, fontWeight: 700, color: T.bg, letterSpacing: '.04em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative',
                }}>
                  {c.t}
                  <span style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 2px,transparent 2px 4px)' }} />
                </div>
              ))}
              {/* playhead */}
              <div style={{ position: 'absolute', top: -3, bottom: -3, left: '32%', width: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}`, zIndex: 3 }}>
                <div style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: '50%', background: T.accent }} />
              </div>
            </div>
          </div>

          {/* Clip list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
            {clips.map((c, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'center',
                padding: '7px 10px', borderRadius: 6, background: T.bg3, border: `1px solid ${T.line}`,
              }}>
                <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, fontWeight: 700 }}>{c.n}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{c.t}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.m}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: T.fm, fontSize: 7, color: T.ink2, letterSpacing: '.12em', padding: '2px 6px', borderRadius: 99, background: T.bg2, border: `1px solid ${T.line2}`, textTransform: 'uppercase', fontWeight: 700 }}>{c.type}</span>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>{c.d}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}`, flexWrap: 'wrap' }}>
            <WMChip>+ Track</WMChip>
            <WMChip>⏵ Voice</WMChip>
            <WMChip style={{ marginLeft: 'auto' }} accent>Save draft</WMChip>
          </div>
          {/* Schedule release */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>Schedule:</div>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              style={{ flex: 1, background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 7, color: T.ink, fontFamily: T.fm, fontSize: 12, padding: '6px 8px', outline: 'none' }}
            />
          </div>
        </div>

        {/* Revenue split */}
        <WMCard style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 13, color: T.ink }}>Revenue split · Ep 05</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>per spin</div>
          </div>
          <div style={{ height: 14, borderRadius: 99, overflow: 'hidden', background: T.bg3, display: 'flex' }}>
            <div style={{ width: '45%', background: T.accent }} />
            <div style={{ width: '30%', background: T.pink }} />
            <div style={{ width: '15%', background: T.purple }} />
            <div style={{ width: '10%', background: T.ink3 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontFamily: T.fm, fontSize: 12, color: T.ink2, letterSpacing: '.04em' }}>
            {([['Artist 45%', T.accent], ['Host 30%', T.pink], ['Co-host 15%', T.purple], ['Platform 10%', T.ink3]] as [string, string][]).map(([l, c], i) => (
              <div key={i}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, marginRight: 5, verticalAlign: 'middle' }} />{l}</div>
            ))}
          </div>
        </WMCard>

        {/* Drafts */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink, margin: 0 }}>My drafts</h2>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>4 total</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {[
            { t: 'Halflight FM · Ep 04', m: '8 tracks · 60:00 · 2,284 plays',   pill: ['teal',  'PUBLISHED'], r: '$184.20', g: `linear-gradient(135deg,${T.accent},${T.amber})` },
            { t: 'Halflight FM · Ep 05', m: '6 tracks · 47:00 · Sun Jun 22',    pill: ['amber', 'EDITING'],   r: 'co 15%',  g: `linear-gradient(135deg,${T.accent},${T.pink})`,  curr: true },
            { t: 'Writing room',         m: '5 tracks · 35:00 · unscheduled',   pill: ['soft',  'DRAFT'],     r: '—',       g: `linear-gradient(135deg,${T.blue},${T.bg4})` },
            { t: 'Sundown · back-half',  m: '4 tracks · 30:00 · co: DJ Vex 10%',pill: ['soft',  'DRAFT'],     r: '—',       g: `linear-gradient(135deg,${T.pink},${T.purple})` },
          ].map((d, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 10, alignItems: 'center',
              background: d.curr ? 'rgba(255,80,41,.04)' : T.bg2,
              border: `1px solid ${d.curr ? T.accent : T.line}`, borderRadius: 9, padding: 10,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 6, background: d.g }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{d.t}</div>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.m}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                <WMPill tone={d.pill[0]}>{d.pill[1]}</WMPill>
                <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>{d.r}</span>
                {d.pill[1] === 'PUBLISHED' && (
                  <button
                    onClick={() => setDisputeSheetShowId(d.t)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.amber, fontFamily: T.fm, fontSize: 11, padding: 0, fontWeight: 700 }}
                  >
                    Dispute payout →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fan mail sheet */}
      {fanMailOpen && (
        <>
          <div onClick={() => setFanMailOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Email your fans</div>
            <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink3, marginBottom: 14 }}>Send a message to all your followers. Limited to once per 7 days.</div>
            {fanMailState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.teal, fontFamily: T.fb }}>Mail sent!</div>
            ) : (
              <>
                <input
                  type="text"
                  value={fanMailSubject}
                  onChange={e => setFanMailSubject(e.target.value.slice(0, 100))}
                  placeholder="Subject (max 100 chars)"
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                />
                <textarea
                  value={fanMailContent}
                  onChange={e => setFanMailContent(e.target.value.slice(0, 2000))}
                  placeholder="Message to your fans… (max 2000 chars)"
                  rows={5}
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                />
                <button
                  onClick={handleFanMail}
                  disabled={fanMailState === 'loading' || !fanMailSubject.trim() || !fanMailContent.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: (fanMailSubject.trim() && fanMailContent.trim()) ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4, color: (fanMailSubject.trim() && fanMailContent.trim()) ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: (fanMailSubject.trim() && fanMailContent.trim()) ? 'pointer' : 'default' }}
                >
                  {fanMailState === 'loading' ? 'Sending…' : fanMailState === 'error' ? 'Failed — retry' : 'Send to fans'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Dispute payout sheet */}
      {disputeSheetShowId && (
        <>
          <div onClick={() => setDisputeSheetShowId(null)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Dispute payout</div>
            <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink3, marginBottom: 14 }}>Submit a payout dispute for admin review.</div>
            {disputeState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.teal, fontFamily: T.fb }}>Dispute submitted!</div>
            ) : (
              <>
                <input
                  type="number"
                  value={disputeAmount}
                  onChange={(e) => setDisputeAmount(e.target.value)}
                  placeholder="Expected payout amount ($)"
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                />
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value.slice(0, 500))}
                  placeholder="Describe the issue with your payout…"
                  rows={4}
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                />
                <button
                  onClick={() => handleDispute(disputeSheetShowId)}
                  disabled={disputeState === 'loading' || !disputeReason.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: disputeReason.trim() ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4, color: disputeReason.trim() ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: disputeReason.trim() ? 'pointer' : 'default' }}
                >
                  {disputeState === 'loading' ? 'Submitting…' : disputeState === 'error' ? 'Failed — retry' : 'Submit dispute'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
