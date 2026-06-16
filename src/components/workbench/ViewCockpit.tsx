'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { WorkbenchData } from '@/types/workbench';

const C = {
  bg: '#0a0805', bg2: '#100d09', bg3: '#1a1612', bg4: '#221c16',
  ink: '#f0ebe5', ink2: '#9e9080', ink3: '#5a5048',
  teal: '#22e5d4', purple: '#b983ff', amber: '#ffb84a', accent: '#ff5029',
  line: 'rgba(255,255,255,.07)', line2: 'rgba(255,255,255,.15)',
  fd: '"Syne",sans-serif', fb: '"DM Sans",sans-serif', fm: '"JetBrains Mono",monospace',
};

interface PageStyle {
  previewBg: string;
  previewSurface: string;
  previewInk: string;
  previewAccent: string;
  previewFont: 'serif' | 'sans';
  previewRadius: number;
  previewShowTour: boolean;
  previewBio: string;
}

interface Msg { role: 'user' | 'ai'; text: string; }

const DEFAULT_STYLE: PageStyle = {
  previewBg: '#0a0805',
  previewSurface: '#1a1612',
  previewInk: '#f0ebe5',
  previewAccent: '#ff5029',
  previewFont: 'sans',
  previewRadius: 12,
  previewShowTour: false,
  previewBio: 'Electronic producer & DJ based in Chicago. Known for floor-filling sets that blend house, techno, and raw emotion.',
};

function interpretCommand(cmd: string, ps: PageStyle): { style: Partial<PageStyle>; reply: string } {
  const c = cmd.toLowerCase();
  if (/dark|darker|midnight/.test(c)) return { style: { previewBg: '#070605', previewSurface: '#121009' }, reply: 'Done — dark mood applied.' };
  if (/light|bright|paper/.test(c)) return { style: { previewBg: '#f6f0e6', previewInk: '#1a1612' }, reply: 'Switched to paper mood.' };
  if (/purple/.test(c)) return { style: { previewAccent: '#b983ff' }, reply: 'Purple accent is live.' };
  if (/teal|cyan/.test(c)) return { style: { previewAccent: '#22e5d4' }, reply: 'Teal accent applied.' };
  if (/pink/.test(c)) return { style: { previewAccent: '#ff3e9a' }, reply: 'Pink accent live.' };
  if (/amber|gold|orange/.test(c)) return { style: { previewAccent: '#ffb84a' }, reply: 'Amber accent live.' };
  if (/serif|elegant|editorial/.test(c)) return { style: { previewFont: 'serif' }, reply: 'Switched to serif headlines.' };
  if (/sans|modern|clean/.test(c)) return { style: { previewFont: 'sans' }, reply: 'Switched to clean sans.' };
  if (/round|soft|pill/.test(c)) return { style: { previewRadius: 22 }, reply: 'Rounded corners applied.' };
  if (/sharp|square/.test(c)) return { style: { previewRadius: 3 }, reply: 'Sharp corners applied.' };
  if (/tour|shows|dates/.test(c)) return { style: { previewShowTour: true }, reply: 'Tour dates section added.' };
  if (/bio|rewrite/.test(c)) return { style: { previewBio: 'Award-winning producer with a signature sound that blurs the line between club and concert hall. 3 LPs, 12 EPs, and counting.' }, reply: 'Bio rewritten — check the preview.' };
  void ps;
  return { style: {}, reply: "I tightened the spacing and refreshed the accent. Try: 'make it darker', 'purple accent', 'add tour dates', 'serif font', or 'rewrite my bio'." };
}

function PagePreview({ ps, name }: { ps: PageStyle; name: string }) {
  const headFont = ps.previewFont === 'serif' ? '"Instrument Serif",serif' : C.fd;
  return (
    <div style={{ width: '100%', height: '100%', background: ps.previewBg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', gap: 20, overflowY: 'auto', transition: 'background .4s' }}>
      {/* Avatar */}
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: `linear-gradient(135deg, ${ps.previewAccent}, ${ps.previewSurface})`, border: `3px solid ${ps.previewAccent}40`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: ps.previewInk, fontFamily: headFont, fontWeight: 700, transition: 'border-color .4s' }}>
        {name.slice(0, 1).toUpperCase()}
      </div>
      {/* Name + tagline */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: headFont, fontSize: 22, fontWeight: 700, color: ps.previewInk, letterSpacing: '-.01em', transition: 'color .4s' }}>{name}</div>
        <div style={{ fontFamily: C.fm, fontSize: 11, color: ps.previewAccent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 4, transition: 'color .4s' }}>Artist · DJ · Producer</div>
      </div>
      {/* Genre chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['House', 'Techno', 'Electronic'].map(g => (
          <span key={g} style={{ fontFamily: C.fm, fontSize: 10, color: ps.previewAccent, border: `1px solid ${ps.previewAccent}40`, borderRadius: ps.previewRadius, padding: '3px 10px', letterSpacing: '.1em', textTransform: 'uppercase', transition: 'all .4s' }}>{g}</span>
        ))}
      </div>
      {/* Bio */}
      <div style={{ background: ps.previewSurface, borderRadius: ps.previewRadius, padding: '16px 18px', fontFamily: C.fb, fontSize: 13, color: ps.previewInk, lineHeight: 1.7, maxWidth: 420, transition: 'all .4s' }}>
        {ps.previewBio}
      </div>
      {/* Tour dates (conditional) */}
      {ps.previewShowTour && (
        <div style={{ background: ps.previewSurface, borderRadius: ps.previewRadius, padding: '14px 18px', width: '100%', maxWidth: 420, transition: 'all .4s' }}>
          <div style={{ fontFamily: C.fd, fontSize: 13, fontWeight: 700, color: ps.previewInk, marginBottom: 10 }}>Tour Dates</div>
          {[{ date: 'Jul 12', venue: 'Fabric, London' }, { date: 'Jul 19', venue: 'Berghain, Berlin' }, { date: 'Aug 2', venue: 'Output, NYC' }].map(d => (
            <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: `1px solid ${ps.previewAccent}20`, fontFamily: C.fb, fontSize: 12 }}>
              <span style={{ color: ps.previewAccent, fontFamily: C.fm, fontSize: 11 }}>{d.date}</span>
              <span style={{ color: ps.previewInk }}>{d.venue}</span>
            </div>
          ))}
        </div>
      )}
      {/* CTA */}
      <button style={{ background: ps.previewAccent, color: '#fff', fontFamily: C.fd, fontSize: 13, fontWeight: 700, letterSpacing: '.06em', border: 'none', borderRadius: ps.previewRadius, padding: '10px 28px', cursor: 'pointer', transition: 'all .4s' }}>
        Follow
      </button>
    </div>
  );
}

const SUGGESTIONS = ['🌙 Make it darker', '✦ Purple accent', '✒ Serif font', '📅 Add tour dates', '✍ Rewrite bio'];

function CockpitChat({ onCommand, msgs, typing }: { onCommand: (cmd: string) => void; msgs: Msg[]; typing: boolean }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typing]);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    onCommand(t);
  }, [input, onCommand]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', padding: '10px 14px', borderRadius: 14,
              background: m.role === 'user' ? C.accent : C.bg3,
              color: C.ink, fontFamily: C.fb, fontSize: 13, lineHeight: 1.55,
              borderBottomRightRadius: m.role === 'user' ? 3 : 14,
              borderBottomLeftRadius: m.role === 'ai' ? 3 : 14,
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 16px', borderRadius: 14, borderBottomLeftRadius: 3, background: C.bg3, display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: C.ink3, animation: `cockpit-dot .9s ${i * 0.15}s infinite ease-in-out` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => onCommand(s.replace(/^[^\s]+ /, ''))} style={{ fontFamily: C.fm, fontSize: 10, color: C.ink2, background: C.bg3, border: `1px solid ${C.line2}`, borderRadius: 99, padding: '4px 10px', cursor: 'pointer', letterSpacing: '.06em', minHeight: 'unset' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '0 12px 16px', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Describe what you want…"
          style={{ flex: 1, background: C.bg3, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '10px 14px', color: C.ink, fontFamily: C.fb, fontSize: 13, outline: 'none' }}
        />
        <button onClick={send} style={{ background: C.accent, border: 'none', borderRadius: 10, width: 42, height: 42, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  );
}

export function ViewCockpit({ data }: { data: WorkbenchData }) {
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_STYLE);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: "Hey, I'm your page cockpit. Describe what you want — I'll apply it live. Try: 'make it darker', 'purple accent', 'add tour dates', 'serif font'." },
  ]);
  const [typing, setTyping] = useState(false);

  const handleCommand = useCallback((cmd: string) => {
    setMsgs(m => [...m, { role: 'user', text: cmd }]);
    setTyping(true);
    setTimeout(() => {
      const { style, reply } = interpretCommand(cmd, pageStyle);
      setPageStyle(ps => ({ ...ps, ...style }));
      setMsgs(m => [...m, { role: 'ai', text: reply }]);
      setTyping(false);
    }, 1200);
  }, [pageStyle]);

  return (
    <>
      <style>{`@keyframes cockpit-dot { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-4px);opacity:1} }`}</style>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '55% 45%', background: C.bg }}>
        {/* Preview panel */}
        <div style={{ borderRight: `1px solid ${C.line}`, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 16px', background: `${C.bg}cc`, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 2, borderBottom: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: C.fm, fontSize: 10, color: C.ink3, letterSpacing: '.14em', textTransform: 'uppercase' }}>Live Preview</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal, flexShrink: 0, display: 'inline-block' }} />
          </div>
          <div style={{ position: 'absolute', inset: 0, paddingTop: 38, overflow: 'hidden' }}>
            <PagePreview ps={pageStyle} name={data.userName ?? 'Artist'} />
          </div>
        </div>
        {/* Chat panel */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
            <div style={{ fontFamily: C.fd, fontWeight: 700, fontSize: 15, color: C.ink }}>Page Cockpit</div>
            <div style={{ fontFamily: C.fm, fontSize: 10, color: C.ink3, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2 }}>AI-powered page editor</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CockpitChat onCommand={handleCommand} msgs={msgs} typing={typing} />
          </div>
        </div>
      </div>
    </>
  );
}

export function ViewCockpitMobile({ data }: { data: WorkbenchData }) {
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_STYLE);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: "Hey, I'm your page cockpit. Try: 'make it darker', 'purple accent', 'add tour dates'." },
  ]);
  const [typing, setTyping] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const handleCommand = useCallback((cmd: string) => {
    setMsgs(m => [...m, { role: 'user', text: cmd }]);
    setTyping(true);
    setTimeout(() => {
      const { style, reply } = interpretCommand(cmd, pageStyle);
      setPageStyle(ps => ({ ...ps, ...style }));
      setMsgs(m => [...m, { role: 'ai', text: reply }]);
      setTyping(false);
    }, 1200);
  }, [pageStyle]);

  return (
    <>
      <style>{`@keyframes cockpit-dot { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-4px);opacity:1} }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
        {/* Small preview card */}
        {showPreview && (
          <div style={{ height: 200, flexShrink: 0, overflow: 'hidden', borderBottom: `1px solid ${C.line}`, position: 'relative' }}>
            <PagePreview ps={pageStyle} name={data.userName ?? 'Artist'} />
            <button onClick={() => setShowPreview(false)} style={{ position: 'absolute', top: 8, right: 8, background: `${C.bg}cc`, border: `1px solid ${C.line}`, borderRadius: 99, fontFamily: C.fm, fontSize: 10, color: C.ink3, padding: '3px 8px', cursor: 'pointer', minHeight: 'unset' }}>Hide preview</button>
          </div>
        )}
        {!showPreview && (
          <button onClick={() => setShowPreview(true)} style={{ padding: '8px 16px', background: C.bg2, border: 'none', borderBottom: `1px solid ${C.line}`, fontFamily: C.fm, fontSize: 10, color: C.teal, letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left', minHeight: 'unset' }}>
            Show preview
          </button>
        )}
        {/* Chat */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CockpitChat onCommand={handleCommand} msgs={msgs} typing={typing} />
        </div>
      </div>
    </>
  );
}
