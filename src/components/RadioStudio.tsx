'use client';

import { useState, useEffect, useRef } from 'react';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const CRATE_TRACKS = [
  { id: 1, title: 'Neon City', artist: 'Alex Rivera', dur: 218, color: '#ff5029' },
  { id: 2, title: 'Lost Frequency', artist: 'Alex Rivera', dur: 252, color: '#22e5d4' },
  { id: 3, title: 'Summer Nights', artist: 'Luna Park', dur: 234, color: '#b983ff' },
  { id: 4, title: 'Wavelength', artist: 'Alex Rivera', dur: 241, color: '#ff3e9a' },
  { id: 5, title: 'Static Love', artist: 'The Scene', dur: 198, color: '#ff5029' },
  { id: 6, title: 'Drift', artist: 'Drift Wave', dur: 267, color: '#22e5d4' },
];

const GENRES = ['Deep House', 'Tech House', 'Indie', 'Electronic', 'Soul', 'Alt-Rock'];

const WAVEFORM_BARS = [6, 14, 9, 18, 12, 20, 8, 16, 11, 19, 7, 15, 10, 17, 13, 20, 9, 16, 8, 14];

type Track = typeof CRATE_TRACKS[0];
type DeckState = { track: Track | null; playing: boolean; elapsed: number };

function Waveform({ playing, progress }: { playing: boolean; progress: number }) {
  return (
    <div style={{ height: 40, background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 8, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${progress}%`, background: 'rgba(255,80,41,0.15)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: '100%', padding: '4px 8px' }}>
        {WAVEFORM_BARS.map((h, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 2, background: 'rgba(255,80,41,0.3)',
            height: playing ? `${h + Math.random() * 6}px` : `${h}px`,
            transition: playing ? `height ${80 + i * 10}ms ease` : 'height 200ms',
          }} />
        ))}
      </div>
    </div>
  );
}

function DeckView({ label, deck, onPlayPause, onCue, onLoad }: {
  label: string;
  deck: DeckState;
  onPlayPause: () => void;
  onCue: () => void;
  onLoad?: (track: Track) => void;
}) {
  const pct = deck.track ? (deck.elapsed / deck.track.dur) * 100 : 0;
  const color = deck.track?.color || '#ff5029';

  return (
    <div style={{
      border: `1px solid ${deck.playing ? 'rgba(255,80,41,0.35)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10, padding: 16, background: 'var(--bg)',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.4)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Deck {label}</span>
        {deck.playing && <span style={{ background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>Playing</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, background: `linear-gradient(135deg,${color},#b983ff)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!deck.track && <span style={{ opacity: 0.4, fontSize: 18 }}>🎵</span>}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {deck.track?.title || 'No track loaded'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.5)' }}>{deck.track?.artist || 'Drag from crate'}</div>
        </div>
      </div>
      <Waveform playing={deck.playing} progress={pct} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,0.35)', marginBottom: 10 }}>
        <span>{fmt(deck.elapsed)}</span>
        <span>{deck.track ? fmt(deck.track.dur) : '--:--'}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
        <button onClick={onCue} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: 'var(--ink)', cursor: 'pointer', fontSize: 14 }}>⏮</button>
        <button onClick={onPlayPause} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: 18 }}>
          {deck.playing ? '⏸' : '▶'}
        </button>
        <button style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: 'var(--ink)', cursor: 'pointer', fontSize: 14 }}>⏭</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', width: 36 }}>Speed</span>
        <input type="range" min="-8" max="8" defaultValue="0" step="0.5" style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', outline: 'none', WebkitAppearance: 'none' as const }} />
      </div>
    </div>
  );
}

type SectionId = 'details' | 'setup' | 'deck' | 'archive';

function SectionBlock({ id, open, icon, name, desc, badge, onToggle, children }: {
  id: SectionId;
  open: boolean;
  icon: string;
  name: string;
  desc: string;
  badge?: string | null;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      border: `1px solid ${open ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12, background: 'var(--bg2)', marginBottom: 12, overflow: 'hidden',
    }}>
      <div onClick={() => onToggle(id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', cursor: 'pointer', userSelect: 'none' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, width: 32, textAlign: 'center' }}>{icon}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>{name}</span>
            {badge && <span style={{ background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{badge}</span>}
          </div>
          {!open && <div style={{ fontSize: 12, color: 'rgba(240,235,229,0.5)', marginLeft: 44, marginTop: 2 }}>{desc}</div>}
        </div>
        <span style={{ fontSize: 12, color: 'rgba(240,235,229,0.4)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: '0 22px 22px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function RadioStudio() {
  const [openSection, setOpenSection] = useState<SectionId>('details');
  const [toast, setToast] = useState<string | null>(null);
  const [genres, setGenres] = useState(['Deep House']);
  const [setlist, setSetlist] = useState<Track[]>([]);
  const [deckA, setDeckA] = useState<DeckState>({ track: CRATE_TRACKS[0], playing: false, elapsed: 0 });
  const [deckB, setDeckB] = useState<DeckState>({ track: null, playing: false, elapsed: 0 });
  const [recording, setRecording] = useState(false);
  const [onAir, setOnAir] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (deckA.playing) setDeckA(d => ({ ...d, elapsed: d.elapsed >= (d.track?.dur || 0) ? 0 : d.elapsed + 1 }));
      if (deckB.playing) setDeckB(d => ({ ...d, elapsed: d.elapsed >= (d.track?.dur || 0) ? 0 : d.elapsed + 1 }));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [deckA.playing, deckB.playing]);

  function addToSetlist(track: Track) {
    if (setlist.find(t => t.id === track.id)) { showToast('Already in setlist'); return; }
    setSetlist(s => [...s, track]);
  }

  function loadToDeck(deck: 'A' | 'B', track: Track) {
    if (deck === 'A') setDeckA(d => ({ ...d, track, elapsed: 0, playing: false }));
    else setDeckB(d => ({ ...d, track, elapsed: 0, playing: false }));
    showToast(`Loaded to Deck ${deck}`);
  }

  function toggleSection(id: SectionId) {
    setOpenSection(o => o === id ? 'details' : id);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)', fontSize: 14,
    fontFamily: 'var(--font-body)', boxSizing: 'border-box',
  };

  const fxBtnStyle: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)', color: 'rgba(240,235,229,0.75)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  };

  const tracksToLoad = setlist.length > 0 ? setlist : CRATE_TRACKS.slice(0, 3);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 24px 100px' }}>
      <style>{`
        @keyframes ihype-blink { 0%,100%{opacity:1}50%{opacity:.6} }
        @keyframes ihype-fadein { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Radio Studio</div>
          <div style={{ fontSize: 13, color: 'rgba(240,235,229,0.55)', marginTop: 4 }}>Build your show · Build your brand · Anyone can DJ</div>
        </div>
        <a href="/radio" style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--ink)', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
          My Shows →
        </a>
      </div>

      {/* DETAILS */}
      <SectionBlock id="details" open={openSection === 'details'} icon="📋" name="Details"
        desc="Title, description, schedule, genre" onToggle={toggleSection}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Show Title</label>
            <input style={inputStyle} placeholder="e.g. Late Night Frequencies" defaultValue="Late Night Frequencies" />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Episode</label>
            <input style={inputStyle} placeholder="e.g. Ep. 12" defaultValue="Ep. 12" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>About This Show</label>
          <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
            placeholder="What's the vibe? Tell fans what to expect…"
            defaultValue="Deep house selections from the Portland underground. One hour of uninterrupted movement." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Go Live / Schedule Date</label>
            <input type="datetime-local" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Duration (estimated)</label>
            <input style={inputStyle} placeholder="e.g. 60 min" defaultValue="60 min" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Genre Tags</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {GENRES.map(g => (
              <div key={g} onClick={() => setGenres(gs => gs.includes(g) ? gs.filter(x => x !== g) : [...gs, g])}
                style={{
                  padding: '6px 12px', borderRadius: 9999, cursor: 'pointer', fontSize: 12, transition: 'all 150ms',
                  border: genres.includes(g) ? '1px solid rgba(255,80,41,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  background: genres.includes(g) ? 'rgba(255,80,41,0.15)' : 'transparent',
                  color: genres.includes(g) ? 'var(--accent)' : 'rgba(240,235,229,0.7)',
                }}>
                {g}
              </div>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Highlights (optional)</label>
          <input style={inputStyle} placeholder="Featured tracks, guests, or moments worth mentioning…" />
        </div>
      </SectionBlock>

      {/* SETUP */}
      <SectionBlock id="setup" open={openSection === 'setup'} icon="🗂️" name="Setup"
        desc={`Crate · ${setlist.length} tracks in setlist · Notes`}
        badge={setlist.length > 0 ? String(setlist.length) : null}
        onToggle={toggleSection}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.45)', marginBottom: 10 }}>Crate · Free-use tracks only</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {CRATE_TRACKS.map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, background: 'var(--bg)', fontSize: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0, background: `linear-gradient(135deg,${t.color},#b983ff)` }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.5)' }}>{t.artist}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,0.4)', marginRight: 4 }}>{fmt(t.dur)}</span>
                  <button onClick={() => addToSetlist(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 18, padding: '2px 4px', lineHeight: 1 }}>+</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.45)', marginBottom: 10 }}>
              Setlist · {setlist.length > 0 ? `${Math.floor(setlist.reduce((a, t) => a + t.dur, 0) / 60)} min total` : 'Drag tracks here'}
            </div>
            {setlist.length === 0
              ? <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(240,235,229,0.3)', fontSize: 13, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>
                  Hit + on any track to add it here
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {setlist.map((t, i) => (
                    <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, background: 'var(--bg)', fontSize: 12 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(240,235,229,0.3)', width: 16, textAlign: 'right' }}>{i + 1}</span>
                      <div style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0, background: `linear-gradient(135deg,${t.color},#b983ff)` }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.5)' }}>{t.artist} · {fmt(t.dur)}</div>
                      </div>
                      <button onClick={() => setSetlist(s => s.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,235,229,0.3)', fontSize: 16, padding: '2px 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Show Notes · Fuzzy plan (only you see this)</label>
          <textarea style={{ ...inputStyle, minHeight: 130, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, resize: 'vertical' }}
            placeholder={`Track 1 → intro, keep it low for first 5 min\nTrack 2 → build after 3:00 mark\nVO after track 3 — shoutout Portland scene\n...`} />
        </div>
      </SectionBlock>

      {/* DECK */}
      <SectionBlock id="deck" open={openSection === 'deck'} icon="🎛️" name="Deck"
        desc={`${onAir ? '● ON AIR' : 'Ready'} · ${recording ? 'Recording' : 'Not recording'}`}
        badge={onAir ? 'Live' : recording ? 'Rec' : null}
        onToggle={toggleSection}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <DeckView label="A" deck={deckA}
            onPlayPause={() => setDeckA(d => ({ ...d, playing: !d.playing }))}
            onCue={() => setDeckA(d => ({ ...d, elapsed: 0, playing: false }))} />
          <DeckView label="B" deck={deckB}
            onPlayPause={() => {
              if (!deckB.track) { showToast('Load a track to Deck B first'); return; }
              setDeckB(d => ({ ...d, playing: !d.playing }));
            }}
            onCue={() => setDeckB(d => ({ ...d, elapsed: 0, playing: false }))} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.4)', width: 40 }}>A</span>
          <input type="range" min="0" max="100" defaultValue="50" style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg,#ff5029,rgba(255,255,255,0.1),#22e5d4)', outline: 'none', WebkitAppearance: 'none' as const, cursor: 'pointer' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.4)', width: 40, textAlign: 'right' }}>B</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.45)', marginBottom: 10 }}>Load to deck (click track → choose deck)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {tracksToLoad.map(t => (
              <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, background: 'var(--bg)', fontSize: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0, background: `linear-gradient(135deg,${t.color},#b983ff)` }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.5)' }}>{t.artist} · {fmt(t.dur)}</div>
                </div>
                <button onClick={() => loadToDeck('A', t)} style={{ ...fxBtnStyle, padding: '4px 8px', fontSize: 11 }}>→ A</button>
                <button onClick={() => loadToDeck('B', t)} style={{ ...fxBtnStyle, padding: '4px 8px', fontSize: 11 }}>→ B</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.45)', marginBottom: 8 }}>Sound Effects</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {['💥 Stab', '🌊 Reverb', '📣 Air Horn', '⬆️ Build', '🔇 Drop', '🎚️ Filter'].map(fx => (
            <button key={fx} onClick={() => showToast(`${fx} fired`)} style={fxBtnStyle}>{fx}</button>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.45)', marginBottom: 8 }}>Controls</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => { setVoicing(v => !v); showToast(voicing ? 'Voiceover off' : '🎙️ Voiceover on — speak now'); }}
            style={{ ...fxBtnStyle, background: voicing ? 'rgba(255,80,41,0.2)' : 'rgba(185,131,255,0.12)', borderColor: voicing ? 'rgba(255,80,41,0.5)' : 'rgba(185,131,255,0.3)', color: voicing ? 'var(--accent)' : 'var(--fan)' }}>
            🎙️ {voicing ? 'Stop VO' : 'Voiceover'}
          </button>
          <button onClick={() => { setRecording(r => !r); showToast(recording ? 'Recording stopped' : '● Recording started'); }}
            style={{ ...fxBtnStyle, ...(recording ? { background: 'rgba(255,80,41,0.2)', borderColor: 'rgba(255,80,41,0.5)', color: 'var(--accent)' } : {}) }}>
            {recording ? '⏹ Stop Rec' : '● Record'}
          </button>
          <button onClick={() => { setOnAir(a => !a); showToast(onAir ? 'Left the air' : '📡 You are live — audio only'); }}
            style={{ ...fxBtnStyle, ...(onAir ? { background: 'rgba(255,80,41,0.25)', borderColor: 'var(--accent)', color: 'var(--accent)', animation: 'ihype-blink 1.4s ease-in-out infinite' } : {}) }}>
            📡 {onAir ? 'End Live' : 'Go Live'}
          </button>
        </div>
        {onAir && (
          <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(255,80,41,0.1)', border: '1px solid rgba(255,80,41,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--accent)' }}>
            ● You are live · Audio only · No video · Fans can listen at ihype.org/radio
          </div>
        )}
      </SectionBlock>

      {/* ARCHIVE */}
      <SectionBlock id="archive" open={openSection === 'archive'} icon="📁" name="Archive"
        desc="Post-show notes · Track log · Stats" onToggle={toggleSection}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[{ val: '1,247', lbl: 'Total Plays' }, { val: '312', lbl: 'Peak Listeners' }, { val: '58 min', lbl: 'Duration' }].map(s => (
            <div key={s.lbl} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 14, background: 'var(--bg)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>{s.val}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.45)' }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.5)', marginBottom: 8, display: 'block' }}>Post-Show Notes</label>
          <textarea style={{ ...inputStyle, minHeight: 130, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, resize: 'vertical' }}
            placeholder="What worked? What would you change? Setlist feedback, transition moments, audience reaction…" />
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(240,235,229,0.45)', marginBottom: 10 }}>Track Log · Timestamped</div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { ts: '0:00', t: 'Neon City', a: 'Alex Rivera', note: 'Opened slow — worked well' },
            { ts: '3:38', t: 'Lost Frequency', a: 'Alex Rivera', note: '' },
            { ts: '7:50', t: 'Wavelength', a: 'Alex Rivera', note: 'Peak energy here' },
            { ts: '11:51', t: 'Summer Nights', a: 'Luna Park', note: 'Crowd-pleaser' },
            { ts: '15:45', t: 'Static Love', a: 'The Scene', note: 'Good cooldown' },
          ].map((row, i, arr) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(240,235,229,0.4)', width: 36 }}>{row.ts}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.t}</div>
                <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.5)' }}>{row.a}</div>
              </div>
              {row.note && <div style={{ fontSize: 11, color: 'rgba(240,235,229,0.45)', maxWidth: 160, textAlign: 'right' }}>{row.note}</div>}
            </div>
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}
