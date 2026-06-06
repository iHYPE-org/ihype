'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorkbenchData } from '@/types/workbench';

const HISTORY_KEY = 'ihype-agent-history';
const VISIT_KEY = 'ihype-last-visit';
const MAX_STORED_MESSAGES = 12;

type AgentMode = 'listener' | 'artist' | 'venue';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chips?: string[];
};

type AgentAction =
  | { type: 'NAVIGATE'; view: string }
  | { type: 'NAVIGATE_URL'; url: string }
  | { type: 'OPEN_SEARCH' }
  | { type: 'DISMISS' };

type AgentShellProps = {
  data: WorkbenchData;
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenSearch: () => void;
};

const MODE_OPTIONS: { id: AgentMode; icon: string; label: string; sub: string }[] = [
  { id: 'listener', icon: '🎵', label: 'Listen & Discover', sub: 'Find shows, follow artists, hype music' },
  { id: 'artist',   icon: '🎤', label: "I'm a Performer",   sub: 'Manage your page, upload music, grow fans' },
  { id: 'venue',    icon: '🏟️', label: 'I Run a Venue',     sub: 'Promote shows, manage bookings' },
];

const MODE_GREETINGS: Record<AgentMode, string> = {
  listener: "Hey! I'm your iHYPE guide. I can help you find shows, discover music, or hype your favorite artists. What sounds good?",
  artist:   "Welcome! I'm here to help you manage your artist page, upload tracks, and reach more fans. Where do you want to start?",
  venue:    "Hey! I can help you promote shows, manage your venue page, and connect with performers. What do you need?",
};

const MODE_TIPS: Record<AgentMode, { icon: string; headline: string; bullets: string[] }> = {
  listener: {
    icon: '🎵',
    headline: "Here's how to get the most out of iHYPE",
    bullets: [
      'Swipe Seeds to discover new artists — hype the ones you love',
      'Browse Live Events to find shows near you',
      'Ask me anything — I can find music, shows, and artists for you',
    ],
  },
  artist: {
    icon: '🎤',
    headline: "Here's how to grow on iHYPE",
    bullets: [
      'Upload tracks to your Artist Page and publish them as Seeds',
      'Check your Insights to see who\'s listening and where',
      'Ask me to help write your bio, set up shows, or find promoters',
    ],
  },
  venue: {
    icon: '🏟️',
    headline: "Here's how to fill your venue with iHYPE",
    bullets: [
      'List shows on your Venue Page to appear in discovery',
      'Connect Stripe to sell tickets with zero platform fees',
      'Ask me to help find artists, promote shows, or manage bookings',
    ],
  },
};

const MODE_CHIPS: Record<AgentMode, string[]> = {
  listener: ['Find a show near me', 'Discover new music', 'See my profile'],
  artist:   ['Go to my artist page', 'Upload a track', 'See my stats'],
  venue:    ['Go to my venue page', 'Browse artists', 'Manage shows'],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Web Speech API — not present in all TypeScript DOM lib versions; define locally
type SpeechRecognitionResultItem = { transcript: string };
type SpeechRecognitionResult = { [index: number]: SpeechRecognitionResultItem };
type SpeechRecognitionResultList = { [index: number]: SpeechRecognitionResult };
type LocalSpeechRecognitionEvent = { results: SpeechRecognitionResultList };

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: LocalSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type AnySpeechRecognition = { new (): SpeechRecognitionInstance };

function getSpeechRecognitionAPI(): AnySpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as AnySpeechRecognition | null;
}

function hasSpeechRecognition(): boolean {
  return getSpeechRecognitionAPI() !== null;
}

export function AgentShell({ data, currentView, onNavigate, onOpenSearch }: AgentShellProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<AgentMode | null>(null);
  const [open, setOpen] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [pendingMode, setPendingMode] = useState<AgentMode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ihype-agent-mode') as AgentMode | null;
    setMode(saved);
    setSpeechSupported(hasSpeechRecognition());

    // Restore message history
    if (saved) {
      try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Message[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch {}
    }

    setMounted(true);
  }, []);

  // Persist history to localStorage whenever messages change
  useEffect(() => {
    if (!mounted || messages.length === 0) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch {}
  }, [messages, mounted]);

  // Proactive nudge on first open after 48h+ absence
  useEffect(() => {
    if (!open || !mode || !mounted) return;
    const now = Date.now();
    const lastVisit = Number(localStorage.getItem(VISIT_KEY) || '0');
    localStorage.setItem(VISIT_KEY, String(now));
    const absent = now - lastVisit;
    if (lastVisit && absent > 48 * 3600 * 1000 && messages.length <= 1) {
      const upcoming = data.shows.filter(s => s.status !== 'ENDED').length;
      setMessages((prev: Message[]) => [
        {
          id: uid(),
          role: 'assistant',
          content: `Hey, welcome back! You've been away for a bit — there ${upcoming === 1 ? 'is' : 'are'} ${upcoming || 'some'} upcoming show${upcoming === 1 ? '' : 's'} near you and new music to discover. Want to catch up?`,
          chips: ['See upcoming shows', 'Discover new music', 'What did I miss?'],
        },
        ...prev,
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll messages to bottom on new message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const selectMode = useCallback((m: AgentMode) => {
    setPendingMode(m);
    setShowTip(true);
  }, []);

  const confirmMode = useCallback((m: AgentMode) => {
    localStorage.setItem('ihype-agent-mode', m);
    localStorage.setItem(VISIT_KEY, String(Date.now()));
    setMode(m);
    setShowTip(false);
    setPendingMode(null);
    setMessages([
      {
        id: uid(),
        role: 'assistant',
        content: MODE_GREETINGS[m],
        chips: MODE_CHIPS[m],
      },
    ]);
    setOpen(true);
  }, []);

  const handleAction = useCallback(
    (action: AgentAction | null) => {
      if (!action) return;
      if (action.type === 'NAVIGATE') {
        onNavigate(action.view);
        setOpen(false);
      } else if (action.type === 'NAVIGATE_URL') {
        window.open(action.url, '_blank', 'noopener,noreferrer');
      } else if (action.type === 'OPEN_SEARCH') {
        onOpenSearch();
        setOpen(false);
      } else if (action.type === 'DISMISS') {
        setOpen(false);
      }
    },
    [onNavigate, onOpenSearch]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      const userMsg: Message = { id: uid(), role: 'user', content: trimmed };
      setMessages((prev: Message[]) =>[...prev, userMsg]);
      setInputVal('');
      setPending(true);

      // Build history from existing messages (exclude the new user msg)
      const history = messages.slice(-6).map((m: Message) => ({ role: m.role, content: m.content }));

      // Summarize upcoming shows for agent context
      const upcomingShows = data.shows
        .filter((s) => s.status !== 'ENDED')
        .slice(0, 5)
        .map((s) => `${s.name} at ${s.venue} — ${s.date} ${s.time} (${s.status})`)
        .join('\n');

      // Trending artists with slugs for deep-link navigation
      const trendingArtists = (data.trending ?? [])
        .slice(0, 6)
        .map((a) => `${a.name} (${a.genre || a.type}) — /artists/${a.slug}`)
        .join('\n');

      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            context: {
              view: currentView,
              userName: data.userName,
              city: data.city || '',
              activeProfileTypes: data.activeProfileTypes,
              mode: mode ?? 'listener',
              upcomingShows: upcomingShows || undefined,
              trendingArtists: trendingArtists || undefined,
              history,
            },
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessages((prev: Message[]) =>[
            ...prev,
            { id: uid(), role: 'assistant', content: payload.error ?? 'Something went wrong. Try again.', chips: [] },
          ]);
          return;
        }

        const assistantMsg: Message = {
          id: uid(),
          role: 'assistant',
          content: payload.reply ?? '',
          chips: payload.chips ?? [],
        };
        setMessages((prev: Message[]) =>[...prev, assistantMsg]);
        handleAction(payload.action);
      } catch {
        setMessages((prev: Message[]) =>[
          ...prev,
          { id: uid(), role: 'assistant', content: "Couldn't reach the guide right now. Try again.", chips: [] },
        ]);
      } finally {
        setPending(false);
      }
    },
    [pending, messages, currentView, data, mode, handleAction]
  );

  const startVoice = useCallback(() => {
    if (!speechSupported || listening) return;
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI) return;
    const recog = new SpeechRecognitionAPI();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e: LocalSpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) sendMessage(transcript);
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }, [speechSupported, listening, sendMessage]);

  const stopVoice = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  if (!mounted) return null;

  // ── Post-mode tip overlay — must precede the mode === null check ──────────
  // selectMode sets pendingMode/showTip without changing mode, so this guard
  // must run first or the onboarding screen will re-render instead of the tip.
  if (showTip && pendingMode) {
    const tip = MODE_TIPS[pendingMode];
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,8,6,0.97)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'agentFadeIn .3s ease-out both',
      }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>{tip.icon}</div>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 20px', textAlign: 'center', maxWidth: '32ch' }}>
          {tip.headline}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380, marginBottom: 32 }}>
          {tip.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #ff5029, #ff3e9a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#fff', fontWeight: 700, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.5 }}>{b}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => confirmMode(pendingMode)}
          style={{
            padding: '14px 32px', borderRadius: 12,
            background: 'linear-gradient(135deg, #ff5029, #ff3e9a)',
            border: 'none', color: '#fff',
            fontFamily: 'var(--f-m, sans-serif)', fontSize: 15, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(255,80,41,0.4)',
          }}
        >
          Got it — let&apos;s go →
        </button>
      </div>
    );
  }

  // ── Onboarding overlay (first visit) ──────────────────────────────────────
  if (mode === null) {
    return (
      <>
        <style>{`
          @keyframes agentFadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
          .agent-card:hover { transform: translateY(-2px); border-color: #ff5029 !important; }
          .agent-card:active { transform: scale(0.98); }
        `}</style>
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(10,8,6,0.96)',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          animation: 'agentFadeIn .4s ease-out both',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 6px', textAlign: 'center' }}>
            Hi{data.userName ? `, ${data.userName.split(' ')[0]}` : ''}! What brings you here?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 28px', textAlign: 'center' }}>
            I&apos;ll guide you through everything — just tap below.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className="agent-card"
                onClick={() => selectMode(opt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 16, padding: '18px 20px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'transform .15s, border-color .15s',
                  minHeight: 72,
                }}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{opt.icon}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{opt.label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 }}>{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => selectMode('listener')}
            style={{
              marginTop: 24, background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer',
              textDecoration: 'underline', padding: '8px 16px',
            }}
          >
            Skip — take me to everything
          </button>
        </div>
      </>
    );
  }

  // ── Floating button + chat drawer ─────────────────────────────────────────
  const lastChips = [...messages].reverse().find((m) => m.role === 'assistant' && m.chips?.length)?.chips ?? [];

  return (
    <>
      <style>{`
        @keyframes agentSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:none; } }
        @keyframes agentBubble { 0%,100% { transform:scale(1); } 50% { transform:scale(1.06); } }
        @keyframes agentDot { 0%,80%,100% { opacity:.2; transform:translateY(0); } 40% { opacity:1; transform:translateY(-4px); } }
        .agent-chip:hover { background: rgba(255,80,41,0.18) !important; border-color: rgba(255,80,41,0.5) !important; }
        .agent-fab:hover { transform: scale(1.08); }
        .agent-fab:active { transform: scale(0.95); }
      `}</style>

      {/* Floating action button */}
      {!open && (
        <button
          className="agent-fab"
          aria-label="Open guide"
          onClick={() => {
            if (messages.length === 0) {
              setMessages([{
                id: uid(), role: 'assistant',
                content: MODE_GREETINGS[mode],
                chips: MODE_CHIPS[mode],
              }]);
            }
            setOpen(true);
          }}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--player-h, 78px) + 16px)',
            right: 20,
            zIndex: 8000,
            width: 52, height: 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff5029, #ff3e9a)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
            boxShadow: '0 4px 20px rgba(255,80,41,0.5)',
            transition: 'transform .15s',
            animation: 'agentBubble 3s ease-in-out infinite',
          }}
        >
          ✦
        </button>
      )}

      {/* Drawer overlay */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 8500,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              background: '#141210',
              borderRadius: '20px 20px 0 0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none',
              display: 'flex', flexDirection: 'column',
              maxHeight: '70vh',
              animation: 'agentSlideUp .25s ease-out both',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Handle + header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff5029, #ff3e9a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>✦</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, lineHeight: 1 }}>iHYPE Guide</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                    {mode === 'listener' ? 'Listener mode' : mode === 'artist' ? 'Artist mode' : 'Venue mode'}
                    {' · '}
                    <button
                      onClick={() => { localStorage.removeItem('ihype-agent-mode'); localStorage.removeItem(HISTORY_KEY); setMode(null); setOpen(false); setMessages([]); }}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,80,41,0.7)', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      switch
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              style={{
                flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              {messages.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '82%',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #ff5029, #ff3e9a)'
                      : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px',
                    fontSize: 14, lineHeight: 1.5,
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {pending && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '16px 16px 16px 4px',
                    padding: '12px 16px',
                    display: 'flex', gap: 5, alignItems: 'center',
                  }}>
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.4)',
                        display: 'inline-block',
                        animation: `agentDot 1.2s ${delay}s ease-in-out infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chips */}
            {lastChips.length > 0 && !pending && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
                padding: '4px 16px 8px',
              }}>
                {lastChips.map((chip) => (
                  <button
                    key={chip}
                    className="agent-chip"
                    onClick={() => sendMessage(chip)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 20, padding: '6px 14px',
                      color: 'rgba(255,255,255,0.8)', fontSize: 13,
                      cursor: 'pointer', transition: 'background .15s, border-color .15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Input row */}
            <div style={{
              display: 'flex', gap: 8, padding: '8px 16px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {speechSupported && (
                <button
                  onMouseDown={startVoice}
                  onMouseUp={stopVoice}
                  onTouchStart={startVoice}
                  onTouchEnd={stopVoice}
                  aria-label={listening ? 'Listening…' : 'Hold to speak'}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    border: listening ? '2px solid #ff5029' : '1px solid rgba(255,255,255,0.1)',
                    background: listening ? 'rgba(255,80,41,0.15)' : 'rgba(255,255,255,0.04)',
                    color: listening ? '#ff5029' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', fontSize: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  🎤
                </button>
              )}
              <input
                ref={inputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputVal); } }}
                placeholder={listening ? 'Listening…' : 'Ask me anything…'}
                disabled={pending || listening}
                style={{
                  flex: 1, height: 44, borderRadius: 22,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 14, padding: '0 16px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => sendMessage(inputVal)}
                disabled={!inputVal.trim() || pending}
                aria-label="Send"
                style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: inputVal.trim() && !pending
                    ? 'linear-gradient(135deg, #ff5029, #ff3e9a)'
                    : 'rgba(255,255,255,0.08)',
                  border: 'none', cursor: inputVal.trim() && !pending ? 'pointer' : 'default',
                  color: '#fff', fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .15s',
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
