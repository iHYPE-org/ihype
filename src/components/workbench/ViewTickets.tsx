'use client';

import React, { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkbenchData } from '@/components/WorkbenchShell';
import { IcDot, IcCheck, IcArrow, IcQR } from './icons';
import { StatCard } from './primitives';

export const ViewTickets = memo(function ViewTickets({ data }: { data: WorkbenchData }) {
  const router = useRouter();
  const [tab, setTab] = useState<'browse' | 'mine' | 'selling' | 'scan'>('browse');
  const tabs = [['browse','Browse'],['mine','My tickets'],['selling','Selling'],['scan','Scan / verify']] as const;

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, gap: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#22e5d4', marginBottom: 10 }}>
            ● {data.showsTonight} TONIGHT · NO SCALPERS · 45/45/10 SPLIT
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Live Events</h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>
            Every show in real rooms — browse, buy, hold, transfer, verify. <strong>45/45/10</strong> split: artist · venue · referrer. No platform fee, ever.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, flexShrink: 0 }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '7px 12px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 13, letterSpacing: '.04em', border: 'none', cursor: 'pointer',
              background: tab === k ? 'var(--bg-3)' : 'transparent',
              color: tab === k ? 'var(--ink)' : 'var(--ink-3)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['ALL CITIES','CHICAGO','THIS WEEK','UNDER $20'].map((f, i) => (
              <button key={f} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.12em', cursor: 'pointer', background: i === 1 ? 'var(--bg-4)' : 'var(--bg-2)', color: i === 1 ? 'var(--ink)' : 'var(--ink-2)', borderColor: i === 1 ? 'var(--line-2)' : 'var(--line)' }}>{f}</button>
            ))}
            <span style={{ flex: 1 }} />
            <button style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', background: 'var(--bg-2)', cursor: 'pointer' }}>Sort · by HYPE ↓</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {data.shows.map(s => {
              const pct = s.capacity > 0 ? (s.sold / s.capacity) * 100 : 0;
              const statusColor = s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : '#b983ff';
              const color = ['#ff5029','#b983ff','#22e5d4','#ff3e9a'][data.shows.indexOf(s) % 4];
              return (
                <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 140, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${color}, ${color}80)` }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.4) 100%)' }} />
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(0,0,0,.55)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: '#fff', letterSpacing: '.14em' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} /> {s.status}
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(0,0,0,.55)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: '#fff' }}>
                      ♡ {s.hype} HYPE
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{s.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{s.venue}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>{s.date} · {s.time}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: pct > 85 ? '#ffb84a' : '#22e5d4', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>{s.sold} / {s.capacity}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)' }}>${s.price}</div>
                      <button onClick={() => router.push(`/shows/${s.id}`)} style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>Get ticket →</button>
                      <button
                        aria-label="Share show"
                        onClick={async () => {
                          const url = `${window.location.origin}/shows/${s.id}`;
                          if (navigator.share) {
                            try { await navigator.share({ title: s.name, text: `${s.name} at ${s.venue}`, url }); } catch {}
                          } else {
                            await navigator.clipboard.writeText(url).catch(() => {});
                          }
                        }}
                        style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', color: 'var(--ink-2)', padding: '7px 10px', display: 'flex', alignItems: 'center' }}
                        title="Share show"
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 2, borderTop: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em' }}>
                      <span>${(s.price * 0.45).toFixed(2)} → artist</span>
                      <span>${(s.price * 0.45).toFixed(2)} → venue</span>
                      <span>${(s.price * 0.10).toFixed(2)} → referrer</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div>
          {data.tickets.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.16em', marginBottom: 10 }}>NEXT UP</div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 200px', gap: 32, padding: '24px 28px',
                border: '1px solid var(--line)', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(255,80,41,.15) 0%, transparent 60%), var(--bg-2)',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#22e5d4', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcDot c="#22e5d4" s={7} /> CONFIRMED · DOORS 7:30 PM
                  </div>
                  <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-.025em', margin: '10px 0 4px', color: 'var(--ink)' }}>
                    {data.tickets[0].showName}
                  </h2>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{data.tickets[0].date}</div>
                  <div style={{ display: 'flex', gap: 30, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                    {[['SEAT', data.tickets[0].seat], ['PAID', `$${data.tickets[0].price}`], ['ENTRY CODE', data.tickets[0].code]].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.16em', marginBottom: 6 }}>{l}</div>
                        <div style={{ fontFamily: l === 'ENTRY CODE' ? 'var(--f-m)' : 'var(--f-d)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
                    <button style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>Show at door →</button>
                    {['Transfer', 'Add to Wallet'].map(l => (
                      <button key={l} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', color: 'var(--ink)', background: 'none', cursor: 'pointer' }}>{l}</button>
                    ))}
                    <button style={{ padding: '9px 14px', border: '1px solid rgba(255,80,41,.3)', color: '#ff5029', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', background: 'none', cursor: 'pointer' }}>Request refund</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <div style={{ padding: 14, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 8 }}><IcQR s={140} /></div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em', textAlign: 'center', maxWidth: 140 }}>Signed by iHYPE · scan with venue app</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>All my tickets</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em' }}>{data.tickets.length} active</div>
            </div>
            {data.tickets.map(tk => (
              <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 3, height: 40, background: 'var(--accent)', borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{tk.showName}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{tk.date}</div>
                </div>
                {[['SEAT', tk.seat], ['PAID', `$${tk.price}`]].map(([l, v]) => (
                  <div key={l} style={{ minWidth: 80 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{v}</div>
                  </div>
                ))}
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.05em' }}>{tk.code}</div>
                <div style={{
                  padding: '4px 10px', border: `1px solid ${tk.status === 'CONFIRMED' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)'}`,
                  borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.08em',
                  color: tk.status === 'CONFIRMED' ? '#22e5d4' : '#ffb84a',
                }}>{tk.status}</div>
                <button onClick={() => router.push(`/tickets/${tk.id}`)} style={{ color: 'var(--ink-3)', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcArrow s={12} /></button>
              </div>
            ))}
            {data.tickets.length === 0 && (
              <div style={{ padding: 24, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>No tickets yet — browse events above.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'selling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { l: 'TICKETS SOLD', v: data.shows.reduce((a,s) => a + s.sold, 0).toString(), d: 'across all shows', c: '#22e5d4' },
              { l: 'GROSS', v: `$${data.shows.reduce((a,s) => a + s.sold * s.price, 0).toFixed(0)}`, d: 'this period', c: '#22e5d4' },
              { l: 'YOUR SHARE · 45%', v: `$${(data.shows.reduce((a,s) => a + s.sold * s.price, 0) * 0.45).toFixed(0)}`, d: '+ $0 platform fee', c: '#ff5029' },
              { l: 'PAYOUT PENDING', v: `$${(data.shows.reduce((a,s) => a + s.sold * s.price, 0) * 0.45).toFixed(0)}`, d: 'next release', c: '#ffb84a' },
            ].map(s => <StatCard key={s.l} label={s.l} value={s.v} delta={s.d} color={s.c} />)}
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Shows on sale</div>
              <button style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>＋ New show</button>
            </div>
            {data.shows.map(s => {
              const pct = s.capacity > 0 ? (s.sold / s.capacity) * 100 : 0;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 3, height: 40, background: '#22e5d4', borderRadius: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{s.name} <span style={{ color: 'var(--ink-3)' }}>· {s.venue}</span></div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{s.date} · {s.time}</div>
                  </div>
                  <div style={{ minWidth: 90 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 4 }}>SOLD</div>
                    <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, position: 'relative', overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: pct > 85 ? '#ffb84a' : '#22e5d4', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)' }}>{s.sold} / {s.capacity}</div>
                  </div>
                  <div style={{ minWidth: 60 }}><div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>PRICE</div><div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>${s.price}</div></div>
                  <div style={{ minWidth: 80 }}><div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>GROSS</div><div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>${(s.sold * s.price).toLocaleString()}</div></div>
                  <button style={{ padding: '7px 12px', border: '1px solid var(--line-2)', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', background: 'none', cursor: 'pointer' }}>Manage →</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'scan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, padding: 24, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)' }}>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#22e5d4', marginBottom: 10 }}>● VENUE MODE · GATE 1</div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '8px 0', color: 'var(--ink)' }}>Door scanner</h2>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: 480, lineHeight: 1.5 }}>Point a phone camera at the QR. Valid tickets show green; replays are blocked at the protocol layer.</p>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { code: 'iH-XX-K3X9', meta: 'GA · admitted 21:04', status: 'VALID', ok: true },
                { code: 'iH-XX-7QQR', meta: 'Transferred 14m ago · GA · admitted 21:06', status: 'VALID', ok: true },
                { code: 'iH-XX-9BLN', meta: 'Already scanned at 20:51 · blocked', status: 'REPLAY', ok: false },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 6, borderLeft: `2px solid ${r.ok ? '#22e5d4' : '#ff5029'}` }}>
                  {r.ok ? <IcCheck s={14} /> : <span style={{ fontSize: 14 }}>⨯</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink)', letterSpacing: '.04em' }}>{r.code}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r.meta}</div>
                  </div>
                  <div style={{ color: r.ok ? '#22e5d4' : '#ff5029', fontFamily: 'var(--f-m)', fontSize: 11 }}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ aspectRatio: '1', background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 10, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 30, border: '2px solid rgba(34,229,212,.5)', borderRadius: 4 }} />
              <div style={{ position: 'absolute', left: 30, right: 30, top: '50%', height: 1, background: '#22e5d4', boxShadow: '0 0 16px #22e5d4' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', letterSpacing: '.1em' }}>Ready for QR…</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-3)' }}>
              {[['ADMITTED', '148', 'var(--ink)'], ['WAITING', '23', 'var(--ink)'], ['BLOCKED', '2', '#ff5029']].map(([l, v, c]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
