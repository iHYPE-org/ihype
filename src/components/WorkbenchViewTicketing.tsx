'use client';

import React, { useState, memo } from 'react';
import { type WorkbenchData, IcDot, IcArrow, IcCheck } from '@/components/WorkbenchShell';
import { ViewEventCreator } from '@/components/WorkbenchViewEventCreator';

// ── View: Ticketing ────────────────────────────────────────────
export const ViewTicketing = memo(function ViewTicketing({ data, activeProfileTypes }: { data: WorkbenchData; activeProfileTypes: string[] }) {
  const canCreateEvents = activeProfileTypes.some(r => r === 'ARTIST' || r === 'VENUE');
  const isDJ = activeProfileTypes.includes('DJ');
  const isVenue = activeProfileTypes.includes('VENUE');
  const [tab, setTab] = useState<'browse' | 'recommended' | 'mine' | 'selling' | 'scan' | 'create' | 'referral' | 'venue'>('browse');
  const upcoming = data.tickets[0];
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferSent, setTransferSent] = useState(false);

  return (
    <div className="wb-view-pad">
      {showTransfer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--wb-bg-2)', border: '1px solid var(--wb-line-2)', borderRadius: 14, padding: '32px 36px', maxWidth: 420, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,.5)' }}>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', color: 'var(--wb-ink)', margin: '0 0 6px' }}>Transfer ticket</h2>
            {transferSent ? (
              <>
                <p style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: '#22e5d4', lineHeight: 1.6, margin: '16px 0 24px' }}>Transfer sent — the recipient will get an email to claim their ticket.</p>
                <button onClick={() => setShowTransfer(false)} className="wb-btn-prime" style={{ width: '100%' }}>Close</button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink-3)', lineHeight: 1.6, margin: '6px 0 20px' }}>The recipient will receive an email to claim this ticket. Your ticket will be invalidated immediately.</p>
                <label style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', display: 'block', marginBottom: 6 }}>RECIPIENT'S EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={e => setTransferEmail(e.target.value)}
                  placeholder="fan@example.com"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button className="wb-btn-prime" style={{ flex: 1 }} onClick={() => setTransferSent(true)}>Send transfer →</button>
                  <button className="wb-btn-ghost" onClick={() => setShowTransfer(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="wb-greet">
        <div>
          <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● {data.showsTonight} TONIGHT · {data.city.toUpperCase()} · NO QUEUES, NO SCALPERS</div>
          <h1 className="wb-page-title">Events & Tickets</h1>
          <p className="wb-page-sub">Browse events, buy and hold tickets, and verify at the door — all within iHYPE. Every dollar settles directly to artists and venues.</p>
        </div>
        <div className="wb-tabs">
          <button onClick={() => setTab('browse')} className={`wb-tab${tab === 'browse' ? ' wb-tab-active' : ''}`}>Browse</button>
          <button onClick={() => setTab('recommended')} className={`wb-tab${tab === 'recommended' ? ' wb-tab-active' : ''}`}>Recommended</button>
          <button onClick={() => setTab('mine')} className={`wb-tab${tab === 'mine' ? ' wb-tab-active' : ''}`}>My tickets</button>
          <button onClick={() => setTab('selling')} className={`wb-tab${tab === 'selling' ? ' wb-tab-active' : ''}`}>Selling</button>
          <button onClick={() => setTab('scan')} className={`wb-tab${tab === 'scan' ? ' wb-tab-active' : ''}`}>Scan / verify</button>
          {canCreateEvents && (
            <button onClick={() => setTab('create')} className={`wb-tab${tab === 'create' ? ' wb-tab-active' : ''}`}>＋ Create event</button>
          )}
          {isVenue && (
            <button onClick={() => setTab('venue')} className={`wb-tab${tab === 'venue' ? ' wb-tab-active' : ''}`}>Venue overview</button>
          )}
          {isDJ && (
            <button onClick={() => setTab('referral')} className={`wb-tab${tab === 'referral' ? ' wb-tab-active' : ''}`}>Referral link</button>
          )}
        </div>
      </div>

      {tab === 'recommended' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--wb-ink-3)', marginBottom: 4 }}>BASED ON YOUR HYPES + LOCATION</div>
          {[
            { id: 'r1', name: 'Maya Reyes', venue: 'Empty Bottle', date: 'Thu Jun 18', time: '9PM', price: 18, hype: 412, reason: 'You hyped this artist 3× this week' },
            { id: 'r2', name: 'Cobalt Hour', venue: 'Sleeping Village', date: 'Sat Jun 20', time: '8PM', price: 15, hype: 287, reason: 'Fans like you are going' },
            { id: 'r3', name: 'Vela', venue: 'Subterranean', date: 'Tue Jun 23', time: '8PM', price: 12, hype: 156, reason: 'Trending in Chicago' },
          ].map(s => (
            <div key={s.id} className="wb-shows-row">
              <div style={{ width: 56, height: 56, borderRadius: 6, background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16 }}>{s.name} <span style={{ color: 'var(--wb-ink-3)', fontWeight: 500 }}>· {s.venue}</span></div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)', marginTop: 4 }}>{s.date} · {s.time} · ♡ {s.hype}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#22e5d4', marginTop: 3 }}>{s.reason}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 700 }}>${s.price}</div>
              <button className="wb-btn-prime">Get ticket</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {data.shows.map(s => (
            <div key={s.id} className="wb-shows-row">
              <div style={{ width: 56, height: 56, borderRadius: 6, background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16 }}>{s.name} <span style={{ color: 'var(--wb-ink-3)', fontWeight: 500 }}>· {s.venue}</span></div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)', marginTop: 4 }}>{s.date} · {s.time} · ♡ {s.hype}</div>
              </div>
              <div style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 700 }}>{s.price > 0 ? `$${s.price}` : 'Free'}</div>
              <button className="wb-btn-prime" onClick={() => setTab('mine')}>Get ticket</button>
            </div>
          ))}
          {data.shows.length === 0 && (
            <div className="wb-empty">No shows found for {data.city}. Check back soon or explore another city in Settings.</div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <>
          {upcoming && (
            <div style={{ marginBottom: 18 }}>
              <div className="wb-eyebrow-xs" style={{ marginBottom: 10 }}>NEXT UP</div>
              <div className="wb-hero-ticket">
                <div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#22e5d4', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcDot c="#22e5d4" s={7} /> CONFIRMED
                  </div>
                  <h2 className="wb-hero-name">{upcoming.showName}</h2>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink-2)', letterSpacing: '.06em' }}>{upcoming.date}</div>
                  <div className="wb-hero-facts">
                    <div><div className="wb-fact-l">SEAT</div><div className="wb-fact-v">{upcoming.seat}</div></div>
                    <div><div className="wb-fact-l">PAID</div><div className="wb-fact-v">${upcoming.price.toFixed(2)}</div></div>
                    <div><div className="wb-fact-l">CODE</div><div className="wb-fact-v" style={{ fontFamily: 'var(--f-m)' }}>{upcoming.code}</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
                    <button className="wb-btn-prime">Show at door →</button>
                    <button className="wb-btn-ghost" onClick={() => { setShowTransfer(true); setTransferSent(false); setTransferEmail(''); }}>Transfer</button>
                    <button className="wb-btn-ghost">Add to Wallet</button>
                    <button className="wb-btn-danger">Request refund</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div className="wb-qr-box">
                    <svg width={100} height={100} viewBox="0 0 80 80" fill="currentColor">
                      {[[0,0],[60,0],[0,60]].map(([x,y],i)=>(
                        <g key={i}><rect x={x} y={y} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3"/><rect x={x+6} y={y+6} width="8" height="8"/></g>
                      ))}
                      {Array.from({length:80}).map((_,i)=>{
                        const x = 24+(i%10)*4, y = 24+Math.floor(i/10)*4;
                        return (i*13+7)%3===0 ? <rect key={i} x={x} y={y} width="3" height="3"/> : null;
                      })}
                    </svg>
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)', textAlign: 'center', maxWidth: 120 }}>Signed by iHYPE · scan with venue app</div>
                </div>
              </div>
            </div>
          )}
          <div className="wb-panel">
            <div className="wb-panel-head">
              <div className="wb-panel-title">All my tickets</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{data.tickets.length} active</div>
            </div>
            {data.tickets.map(tk => (
              <div key={tk.id} className="wb-ticket-row">
                <div className="wb-ticket-stripe" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{tk.showName}</div>
                  <div className="wb-show-meta">{tk.date}</div>
                </div>
                <div className="wb-ticket-col"><div className="wb-fact-l">SEAT</div><div className="wb-fact-v">{tk.seat}</div></div>
                <div className="wb-ticket-col"><div className="wb-fact-l">PAID</div><div className="wb-fact-v">${tk.price}</div></div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)' }}>{tk.code}</div>
                <div className="wb-status-pill" style={{ color: tk.status === 'CONFIRMED' ? '#22e5d4' : '#ffb84a', borderColor: tk.status === 'CONFIRMED' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)' }}>{tk.status}</div>
                <button className="wb-row-btn"><IcArrow s={12} /></button>
              </div>
            ))}
            {data.tickets.length === 0 && (
              <div className="wb-act-row" style={{ color: 'var(--wb-ink-3)', fontSize: 13 }}>No tickets yet — browse shows to get started.</div>
            )}
          </div>
          {data.tickets.length > 0 ? (
            <div className="wb-panel" style={{ marginTop: 14, padding: '16px 18px' }}>
              <div className="wb-panel-title">Post-show recap</div>
              <p className="wb-page-sub" style={{ fontSize: 12, margin: '6px 0 12px' }}>After the show, save the artists discovered, songs played, and a shareable memory for your scene.</p>
              <button className="wb-btn-ghost" onClick={() => setTab('recommended')}>Find related artists</button>
            </div>
          ) : null}
        </>
      )}

      {tab === 'selling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="wb-stat-row">
            {[
              { label: 'TICKETS SOLD', value: String(data.shows.reduce((a, s) => a + s.sold, 0)), delta: 'across ' + data.shows.length + ' shows', color: '#22e5d4' },
              { label: 'GROSS', value: '$' + data.shows.reduce((a, s) => a + s.sold * s.price, 0).toLocaleString(), delta: 'this month', color: '#22e5d4' },
              { label: 'PLATFORM FEE', value: '0%', delta: 'always', color: '#b983ff' },
              { label: 'PAYOUT PENDING', value: data.stats.find(s => s.label.includes('PAYOUT'))?.value ?? '—', delta: 'next payout date', color: '#ffb84a' },
            ].map(s => (
              <div key={s.label} className="wb-stat-card">
                <div className="wb-stat-l">{s.label}</div>
                <div className="wb-stat-v">{s.value}</div>
                <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
              </div>
            ))}
          </div>
          <div className="wb-panel">
            <div className="wb-panel-head">
              <div className="wb-panel-title">Shows on sale</div>
              <button className="wb-btn-prime">＋ New show</button>
            </div>
            {data.shows.map(s => (
              <div key={s.id} className="wb-ticket-row">
                <div className="wb-show-stripe" style={{ background: '#22e5d4' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wb-show-name">{s.name} <span className="wb-show-venue">· {s.venue}</span></div>
                  <div className="wb-show-meta">{s.date} · {s.time}</div>
                </div>
                <div className="wb-ticket-col">
                  <div className="wb-fact-l">SOLD</div>
                  <div className="wb-cap-bar" style={{ width: 80, marginTop: 4 }}>
                    <div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-2)', marginTop: 5 }}>{s.sold} / {s.capacity}</div>
                </div>
                <div className="wb-ticket-col"><div className="wb-fact-l">PRICE</div><div className="wb-fact-v">${s.price}</div></div>
                <div className="wb-ticket-col"><div className="wb-fact-l">GROSS</div><div className="wb-fact-v">${(s.sold * s.price).toLocaleString()}</div></div>
                <button className="wb-btn-ghost-sm">Manage →</button>
              </div>
            ))}
            {data.shows.length === 0 && (
              <div className="wb-act-row" style={{ color: 'var(--wb-ink-3)', fontSize: 13 }}>No shows on sale — create your first show above.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'scan' && (
        <div className="wb-scan-card">
          <div>
            <div className="wb-eyebrow" style={{ color: '#22e5d4' }}>● VENUE MODE · DOOR SCANNER</div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '8px 0' }}>Door scanner</h2>
            <p className="wb-page-sub">Point a phone camera at the QR. Valid tickets show green; transferred tickets reveal the chain. Replays are blocked at the protocol layer.</p>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { code: 'iH-MR18-K3X9', meta: 'GA · admitted 21:04', valid: true },
                { code: 'iH-MR18-7QQR', meta: 'Transferred 14m ago · GA · admitted 21:06', valid: true },
                { code: 'iH-MR18-9BLN', meta: 'Already scanned at 20:51 · blocked', valid: false },
              ].map((r, i) => (
                <div key={i} className="wb-scan-row" style={{ borderLeft: `2px solid ${r.valid ? '#22e5d4' : '#ff5029'}` }}>
                  {r.valid ? <IcCheck s={14} /> : <span style={{ fontSize: 14 }}>⨯</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--wb-ink)' }}>{r.code}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', marginTop: 2 }}>{r.meta}</div>
                  </div>
                  <div style={{ color: r.valid ? '#22e5d4' : '#ff5029', fontFamily: 'var(--f-m)', fontSize: 11 }}>{r.valid ? 'VALID' : 'REPLAY'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="wb-scan-viewport">
            <div className="wb-scan-laser" />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', letterSpacing: '.1em' }}>Ready for QR…</div>
          </div>
        </div>
      )}

      {tab === 'create' && canCreateEvents && <ViewEventCreator />}

      {tab === 'venue' && isVenue && (() => {
        const totalSold = data.shows.reduce((a, s) => a + s.sold, 0);
        const totalGross = data.shows.reduce((a, s) => a + s.sold * s.price, 0);
        return (
          <>
            <div className="wb-stat-row" style={{ marginTop: 8 }}>
              {[
                { label: 'SHOWS HOSTED',   value: String(data.shows.length),              delta: 'this season',       color: '#22e5d4' },
                { label: 'TICKETS SOLD',   value: String(totalSold),                       delta: 'across all shows',  color: '#22e5d4' },
                { label: 'GROSS REVENUE',  value: `$${totalGross.toLocaleString()}`,       delta: 'at face value',     color: '#ffb84a' },
                { label: 'PLATFORM FEE',   value: '0%',                                    delta: 'always',            color: '#b983ff' },
              ].map(s => (
                <div key={s.label} className="wb-stat-card">
                  <div className="wb-stat-l">{s.label}</div>
                  <div className="wb-stat-v">{s.value}</div>
                  <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
                </div>
              ))}
            </div>
            <div className="wb-panel" style={{ marginTop: 12, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, background: 'rgba(34,229,212,.12)', color: '#22e5d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-d)', fontWeight: 800 }}>
                {data.pendingVenueRequestCount ?? 0}
              </div>
              <div style={{ flex: 1 }}>
                <div className="wb-panel-title">Booking request inbox</div>
                <div className="wb-small-muted">Review artist requests, fan recommendations, pending holds, and open-night opportunities.</div>
              </div>
              {data.profilePath ? <a className="wb-btn-prime" href={`${data.profilePath}?section=request`} style={{ textDecoration: 'none' }}>Open requests</a> : null}
            </div>
            <div className="wb-panel" style={{ marginTop: 12 }}>
              <div className="wb-panel-head">
                <div className="wb-panel-title">All shows</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)' }}>{data.shows.length} total</div>
              </div>
              {data.shows.length === 0 && <div className="wb-empty">No shows yet — create your first event.</div>}
              {data.shows.map(s => (
                <div key={s.id} className="wb-ticket-row">
                  <div className="wb-show-stripe" style={{ background: s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : 'var(--wb-ink-3)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="wb-show-name">{s.name}</div>
                    <div className="wb-show-meta">{s.date} · {s.time}</div>
                  </div>
                  <div className="wb-cap">
                    <div className="wb-cap-bar"><div className="wb-cap-fill" style={{ width: `${(s.sold / s.capacity) * 100}%`, background: s.sold / s.capacity > 0.85 ? '#ffb84a' : '#22e5d4' }} /></div>
                    <div className="wb-cap-txt">{s.sold}/{s.capacity}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: 'var(--wb-ink)', minWidth: 60, textAlign: 'right' }}>${(s.sold * s.price).toLocaleString()}</div>
                  <div className="wb-status-pill" style={{ color: s.status === 'TONIGHT' ? '#22e5d4' : '#ffb84a', borderColor: s.status === 'TONIGHT' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)' }}>{s.status}</div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {tab === 'referral' && isDJ && (
        <div className="wb-panel" style={{ marginTop: 20, padding: '24px 28px' }}>
          <div className="wb-eyebrow" style={{ color: '#b983ff', marginBottom: 10 }}>● PROMOTER / DJ · REFERRAL LINKS · 10% ON TICKETS YOU DRIVE</div>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', color: 'var(--wb-ink)', margin: '0 0 8px' }}>Your referral link</h2>
          <p className="wb-page-sub" style={{ marginBottom: 18 }}>Share your link for ticketed events. When fans buy tickets through it, you earn your promoter portion of the ticket payout. Free radio shows do not create payouts.</p>
          <div className="wb-stat-row" style={{ marginBottom: 18 }}>
            {[
              { label: 'LINK CLICKS', value: String(data.referralStats?.clicks ?? 0), delta: 'tracked joins', color: '#b983ff' },
              { label: 'TICKET BUYERS', value: String(data.referralStats?.buyers ?? 0), delta: 'orders attributed', color: '#22e5d4' },
              { label: 'GROSS DRIVEN', value: `$${((data.referralStats?.grossCents ?? 0) / 100).toFixed(0)}`, delta: 'ticket sales', color: '#ff3e9a' },
              { label: 'EST. PAYOUT', value: `$${((data.referralStats?.payoutCents ?? 0) / 100).toFixed(0)}`, delta: 'promoter portion', color: '#ffb84a' }
            ].map(s => (
              <div key={s.label} className="wb-stat-card">
                <div className="wb-stat-l">{s.label}</div>
                <div className="wb-stat-v">{s.value}</div>
                <div className="wb-stat-d" style={{ color: s.color }}>{s.delta}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <input readOnly value={`https://ihype.org/register?ref=${data.profileHexId ?? data.userInitials?.toLowerCase() ?? 'you'}`} style={{ flex: 1, padding: '10px 14px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-accent)', outline: 'none' }} />
            <button className="wb-btn-prime" onClick={() => navigator.clipboard?.writeText(`https://ihype.org/register?ref=${data.profileHexId ?? data.userInitials?.toLowerCase() ?? 'you'}`)}>Copy</button>
          </div>
          <div className="wb-panel" style={{ background: 'var(--wb-bg-3)' }}>
            <div className="wb-panel-head"><div className="wb-panel-title">Events you're attached to</div></div>
            {data.shows.length === 0 ? (
              <div className="wb-empty">No events linked yet — share your referral link with organizers to get attached.</div>
            ) : data.shows.map(s => (
              <div key={s.id} className="wb-ticket-row">
                <div className="wb-show-stripe" style={{ background: '#b983ff' }} />
                <div style={{ flex: 1 }}><div className="wb-show-name">{s.name}</div><div className="wb-show-meta">{s.date} · {s.venue}</div></div>
                <div className="wb-status-pill" style={{ color: '#b983ff', borderColor: 'rgba(185,131,255,.3)' }}>ATTACHED</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
