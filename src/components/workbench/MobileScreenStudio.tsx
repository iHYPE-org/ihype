'use client';

import React from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T, WMPill, WMChip, WMViewHead, WMCard } from './MobilePrimitives';
import { PageActions } from './PageActions';

type MobileBookingReq = {
  id: string; message: string; status: string; createdAt: string;
  fromUser?: { name: string | null; profiles?: Array<{ name: string; type: string }> } | null;
  toProfile?: { name: string; type: string } | null;
};

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
  const [draftSaved, setDraftSaved] = React.useState(false);
  const [localToast, setLocalToast] = React.useState<string | null>(null);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [publishTitle, setPublishTitle] = React.useState('Halflight FM · Ep 05');
  const [publishState, setPublishState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [trackPickerOpen, setTrackPickerOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [recordedBlob, setRecordedBlob] = React.useState<Blob | null>(null);
  const [voiceUploading, setVoiceUploading] = React.useState(false);
  const [bookingsOpen, setBookingsOpen] = React.useState(false);
  const [bookings, setBookings] = React.useState<{ received: MobileBookingReq[]; sent: MobileBookingReq[] } | null>(null);
  const [bookingsLoading, setBookingsLoading] = React.useState(false);
  const [bookingPatching, setBookingPatching] = React.useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  function showToast(msg: string) {
    setLocalToast(msg);
    setTimeout(() => setLocalToast(null), 2200);
  }

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

  const handlePublish = async () => {
    if (!publishTitle.trim()) return;
    setPublishState('loading');
    try {
      const startsAt = scheduleDate ? new Date(scheduleDate).toISOString() : new Date().toISOString();
      const res = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: publishTitle,
          isRadioShow: false,
          status: scheduleDate ? 'SCHEDULED' : 'DRAFT',
          startsAt,
        }),
      });
      if (res.ok) {
        setPublishState('done');
        setTimeout(() => { setPublishOpen(false); setPublishState('idle'); showToast('Episode published!'); }, 1500);
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setPublishState('error');
        setTimeout(() => setPublishState('idle'), 2000);
        showToast(d.error ?? 'Failed to publish');
      }
    } catch {
      setPublishState('error');
      setTimeout(() => setPublishState('idle'), 2000);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      showToast('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const openBookings = React.useCallback(() => {
    setBookingsOpen(true);
    if (!bookings) {
      setBookingsLoading(true);
      fetch('/api/booking-requests')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: { received?: MobileBookingReq[]; sent?: MobileBookingReq[] }) => {
          setBookings({ received: d.received ?? [], sent: d.sent ?? [] });
        })
        .catch(() => setBookings({ received: [], sent: [] }))
        .finally(() => setBookingsLoading(false));
    }
  }, [bookings]);

  async function respondBooking(id: string, status: 'accepted' | 'declined') {
    setBookingPatching(id);
    try {
      await fetch('/api/booking-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      setBookings(null);
      setBookingsLoading(true);
      fetch('/api/booking-requests')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: { received?: MobileBookingReq[]; sent?: MobileBookingReq[] }) => setBookings({ received: d.received ?? [], sent: d.sent ?? [] }))
        .catch(() => {})
        .finally(() => setBookingsLoading(false));
    } catch {}
    finally { setBookingPatching(null); }
  }

  const trackList = data.tracks;
  const clips = trackList.map((tr, i) => ({
    n: String(i + 1).padStart(2, '0'),
    t: tr.title,
    m: `${tr.artistName}${tr.album ? ` · ${tr.album}` : ''}`,
    type: 'TRACK' as const,
    d: tr.duration,
  }));
  const totalSec = trackList.reduce((s, tr) => s + (tr.durationSec ?? 0), 0);
  const timelineColors = [T.accent, T.pink, T.purple, T.teal, T.blue, T.amber];
  const timeline = trackList.map((tr, i) => ({
    c: timelineColors[i % timelineColors.length],
    f: totalSec > 0 ? Math.max(4, Math.round((tr.durationSec ?? 0) / totalSec * 100)) : Math.round(100 / trackList.length),
    t: tr.title,
  }));

  return (
    <>
      <WMViewHead
        eyebrow="SHOW CREATOR · PRERECORDED RADIO"
        title="Studio"
        sub="Drag tracks into the timeline. Splits auto-calc: 45/45/10."
        actions={<>
          <WMChip onClick={() => setTrackPickerOpen(true)}>↥ Import</WMChip>
          <WMChip accent onClick={() => setPublishOpen(true)}>⬤ Publish</WMChip>
          <WMChip onClick={handleCopyEmbed}>{embedCopied ? '✓ Copied!' : '⊞ Embed'}</WMChip>
          <WMChip onClick={() => setFanMailOpen(true)}>✉ Fan mail</WMChip>
          <WMChip onClick={openBookings}>⟳ Bookings</WMChip>
          <PageActions
            compact
            type={data.pageEditor?.type ?? data.profileType}
            slug={data.pageEditor?.slug}
            title={data.pageEditor?.name || data.userName}
          />
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
            {timeline.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em', marginBottom: 8 }}>
                <span>00:00</span>
                <span>{Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, '0')}</span>
              </div>
            )}
            <div style={{ position: 'relative', height: 46, background: T.bg4, borderRadius: 5, display: 'flex', gap: 2, padding: 3, overflow: 'hidden', alignItems: 'center', justifyContent: timeline.length === 0 ? 'center' : undefined }}>
              {timeline.length === 0 ? (
                <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.04em' }}>Add tracks to build your timeline</span>
              ) : timeline.map((c, i) => (
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
              {timeline.length > 0 && (
                <div style={{ position: 'absolute', top: -3, bottom: -3, left: '32%', width: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}`, zIndex: 3 }}>
                  <div style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: '50%', background: T.accent }} />
                </div>
              )}
            </div>
          </div>

          {/* Clip list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
            {clips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', background: T.bg3, borderRadius: 10, border: `1px dashed ${T.line2}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 26 }}>🎵</div>
                <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink }}>No tracks in your library</div>
                <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink3 }}>Upload a track to get started</div>
              </div>
            ) : clips.map((c, i) => (
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
            <WMChip onClick={() => setTrackPickerOpen(true)}>+ Track</WMChip>
            <WMChip onClick={() => setVoiceOpen(true)}>⏵ Voice</WMChip>
            <WMChip style={{ marginLeft: 'auto' }} accent onClick={() => { setDraftSaved(true); showToast('Draft saved'); setTimeout(() => setDraftSaved(false), 3000); }}>{draftSaved ? '✓ Saved' : 'Save draft'}</WMChip>
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

        {/* My shows */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink, margin: 0 }}>My shows</h2>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>{data.shows.length} upcoming</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {data.shows.length === 0 ? (
            <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink3, textAlign: 'center', padding: '20px 0' }}>No upcoming shows yet</div>
          ) : data.shows.map(s => {
            const tone = s.status === 'TONIGHT' ? 'teal' : s.status === 'NEAR SOLD' || s.status === 'THIS WEEK' ? 'amber' : 'soft';
            const label = s.status;
            const meta = `${s.venue} · ${s.date} ${s.time}`;
            const revenue = s.sold > 0 ? `${s.sold}/${s.capacity} sold` : s.price > 0 ? `$${s.price}` : 'Free';
            const grad = s.status === 'TONIGHT' ? `linear-gradient(135deg,${T.accent},${T.amber})`
              : s.status === 'NEAR SOLD' ? `linear-gradient(135deg,${T.amber},${T.pink})`
              : `linear-gradient(135deg,${T.accent},${T.pink})`;
            return (
              <div key={s.id} style={{
                display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 10, alignItems: 'center',
                background: s.status === 'TONIGHT' ? 'rgba(255,80,41,.04)' : T.bg2,
                border: `1px solid ${s.status === 'TONIGHT' ? T.accent : T.line}`, borderRadius: 9, padding: 10,
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 6, background: grad }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{s.name}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                  <WMPill tone={tone}>{label}</WMPill>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>{revenue}</span>
                </div>
              </div>
            );
          })}
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

      {/* Local toast */}
      {localToast && (
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 32, zIndex: 200, pointerEvents: 'none' }}>
          <div style={{ padding: '11px 16px', borderRadius: 10, background: T.bg3, border: `1px solid ${T.teal}40`, fontFamily: T.fb, fontSize: 13, color: T.ink, boxShadow: '0 8px 24px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, flexShrink: 0 }} />
            {localToast}
          </div>
        </div>
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

      {/* Publish sheet */}
      {publishOpen && (
        <>
          <div onClick={() => setPublishOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Publish episode</div>
            <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink3, marginBottom: 14 }}>
              {scheduleDate ? `Scheduled for ${new Date(scheduleDate).toLocaleString()}` : 'No schedule set — will save as draft.'}
            </div>
            {publishState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.teal, fontFamily: T.fb }}>Published!</div>
            ) : (
              <>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={e => setPublishTitle(e.target.value.slice(0, 100))}
                  placeholder="Episode title"
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
                />
                <button
                  onClick={handlePublish}
                  disabled={publishState === 'loading' || !publishTitle.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: publishTitle.trim() ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4, color: publishTitle.trim() ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: publishTitle.trim() ? 'pointer' : 'default' }}
                >
                  {publishState === 'loading' ? 'Publishing…' : publishState === 'error' ? 'Failed — retry' : scheduleDate ? 'Schedule & publish' : 'Save as draft'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Track picker sheet */}
      {trackPickerOpen && (
        <>
          <div onClick={() => setTrackPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px', maxHeight: '72vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18 }}>Import from library</div>
              <button onClick={() => setTrackPickerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', paddingBottom: 32 }}>
              {data.tracks.length === 0 ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: T.ink3, fontFamily: T.fb, fontSize: 13 }}>No tracks in your library yet.</div>
              ) : data.tracks.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => { showToast(`Added "${t.title}"`); setTrackPickerOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', background: 'none', border: 'none', borderBottom: i < data.tracks.length - 1 ? `1px solid ${T.line}` : 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: `linear-gradient(135deg,${t.color},${t.color}80)`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.fb, fontSize: 14, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>{t.artistName} · {t.duration}</div>
                  </div>
                  <span style={{ color: T.teal, fontFamily: T.fm, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', flexShrink: 0 }}>+ ADD</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Voice recorder sheet */}
      {voiceOpen && (
        <>
          <div onClick={() => { if (!recording) setVoiceOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18 }}>Voice recorder</div>
              {!recording && <button onClick={() => setVoiceOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 20, lineHeight: 1 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '24px 0' }}>
              {recordedBlob ? (
                <>
                  <audio controls src={URL.createObjectURL(recordedBlob)} style={{ width: '100%' }} />
                  <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <button onClick={() => setRecordedBlob(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: `1px solid ${T.line2}`, background: 'none', color: T.ink2, fontFamily: T.fm, fontSize: 13, cursor: 'pointer' }}>Re-record</button>
                    <button
                      disabled={voiceUploading}
                      onClick={async () => {
                        if (!recordedBlob) return;
                        setVoiceUploading(true);
                        try {
                          const fd = new FormData();
                          const ts = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                          fd.append('file', new File([recordedBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' }));
                          fd.append('title', `Voice Note ${ts}`);
                          fd.append('freeUseEnabled', 'false');
                          const res = await fetch('/api/artist-media', { method: 'POST', body: fd });
                          if (res.ok) {
                            showToast('Voice note saved to library');
                          } else {
                            showToast('Saved locally — upload failed');
                          }
                        } catch {
                          showToast('Saved locally — upload failed');
                        } finally {
                          setVoiceUploading(false);
                          setVoiceOpen(false);
                          setRecordedBlob(null);
                        }
                      }}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: voiceUploading ? T.bg2 : `linear-gradient(135deg,${T.accent},${T.pink})`, color: voiceUploading ? T.ink3 : T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 13, cursor: voiceUploading ? 'default' : 'pointer' }}
                    >{voiceUploading ? 'Saving…' : 'Add to episode'}</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: recording ? 'rgba(255,80,41,.15)' : T.bg2, border: `2px solid ${recording ? T.accent : T.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
                    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={recording ? T.accent : T.ink2} strokeWidth="1.5">
                      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
                    </svg>
                  </div>
                  {recording && <div style={{ fontFamily: T.fm, fontSize: 13, color: T.accent, letterSpacing: '.12em' }}>● RECORDING</div>}
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    style={{ padding: '12px 32px', borderRadius: 10, border: recording ? `1px solid ${T.accent}` : 'none', background: recording ? 'rgba(255,80,41,.18)' : `linear-gradient(135deg,${T.accent},${T.pink})`, color: recording ? T.accent : T.bg, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
                  >
                    {recording ? 'Stop recording' : 'Start recording'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bookings sheet */}
      {bookingsOpen && (
        <>
          <div onClick={() => setBookingsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px', maxHeight: '75vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18 }}>Booking requests</div>
              <button onClick={() => setBookingsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            {bookingsLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: T.fm, fontSize: 13, color: T.ink3 }}>Loading…</div>
            ) : !bookings || (bookings.received.length === 0 && bookings.sent.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: T.fm, fontSize: 13, color: T.ink3 }}>No booking requests yet</div>
            ) : (
              <>
                {bookings.received.length > 0 && (
                  <>
                    <div style={{ fontFamily: T.fm, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: T.ink3, marginBottom: 10 }}>RECEIVED</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      {bookings.received.map(r => {
                        const name = r.fromUser?.profiles?.[0]?.name ?? r.fromUser?.name ?? 'Someone';
                        const statusColor = r.status === 'accepted' ? T.teal : r.status === 'declined' ? T.ink3 : T.amber;
                        return (
                          <div key={r.id} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink }}>{name}</span>
                              <span style={{ fontFamily: T.fm, fontSize: 10, fontWeight: 700, color: statusColor, letterSpacing: '.08em' }}>{r.status.toUpperCase()}</span>
                            </div>
                            <div style={{ fontFamily: T.fb, fontSize: 13, color: T.ink2, marginBottom: r.status === 'pending' ? 12 : 0 }}>{r.message || 'No message.'}</div>
                            {r.status === 'pending' && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button disabled={bookingPatching === r.id} onClick={() => void respondBooking(r.id, 'accepted')}
                                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: `rgba(34,229,212,.15)`, color: T.teal, fontFamily: T.fd, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                                  Accept
                                </button>
                                <button disabled={bookingPatching === r.id} onClick={() => void respondBooking(r.id, 'declined')}
                                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${T.line2}`, background: 'none', color: T.ink2, fontFamily: T.fm, fontSize: 13, cursor: 'pointer' }}>
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {bookings.sent.length > 0 && (
                  <>
                    <div style={{ fontFamily: T.fm, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: T.ink3, marginBottom: 10 }}>SENT</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {bookings.sent.map(r => {
                        const statusColor = r.status === 'accepted' ? T.teal : r.status === 'declined' ? T.ink3 : T.amber;
                        return (
                          <div key={r.id} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink }}>{r.toProfile?.name ?? 'Unknown'}</span>
                              <span style={{ fontFamily: T.fm, fontSize: 10, fontWeight: 700, color: statusColor, letterSpacing: '.08em' }}>{r.status.toUpperCase()}</span>
                            </div>
                            <div style={{ fontFamily: T.fb, fontSize: 13, color: T.ink2 }}>{r.message || 'No message.'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
