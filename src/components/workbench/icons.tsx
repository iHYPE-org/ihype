'use client';

import React from 'react';

export const Ic = ({ s = 16, sw = 1.6, children }: { s?: number; sw?: number; children: React.ReactNode }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

export const IcHome     = (p: { s?: number }) => <Ic s={p.s}><path d="M3 11l9-8 9 8"/><path d="M5 9v12h14V9"/></Ic>;
export const IcLibrary  = (p: { s?: number }) => <Ic s={p.s}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M14 3v18"/></Ic>;
export const IcRadio    = (p: { s?: number }) => <Ic s={p.s}><circle cx="12" cy="12" r="3"/><path d="M5.5 8.5a8 8 0 0 1 13 0M3 6a11 11 0 0 1 18 0M5.5 15.5a8 8 0 0 0 13 0M3 18a11 11 0 0 0 18 0"/></Ic>;
export const IcTicket   = (p: { s?: number }) => <Ic s={p.s}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" strokeDasharray="2 2"/></Ic>;
export const IcDisco    = (p: { s?: number }) => <Ic s={p.s}><circle cx="12" cy="12" r="9"/><polygon points="15 9 13 13 9 15 11 11" fill="currentColor" stroke="none"/></Ic>;
export const IcStudio   = (p: { s?: number }) => <Ic s={p.s}><path d="M6 3v18M18 3v18M3 6h18M3 12h18M3 18h18"/></Ic>;
export const IcSettings = (p: { s?: number }) => <Ic s={p.s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Ic>;
export const IcPlay     = ({ s = 14 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
export const IcPause    = ({ s = 14 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
export const IcSkipP    = ({ s = 14 }: { s?: number }) => <Ic s={s} sw={2}><polygon points="19 4 9 12 19 20" fill="currentColor"/><rect x="5" y="4" width="2" height="16" fill="currentColor"/></Ic>;
export const IcSkipN    = ({ s = 14 }: { s?: number }) => <Ic s={s} sw={2}><polygon points="5 4 15 12 5 20" fill="currentColor"/><rect x="17" y="4" width="2" height="16" fill="currentColor"/></Ic>;
export const IcShuffle  = (p: { s?: number }) => <Ic s={p.s}><path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5"/></Ic>;
export const IcRepeat   = (p: { s?: number }) => <Ic s={p.s}><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></Ic>;
export const IcHeart    = ({ s = 14, c = 'currentColor', filled = false }: { s?: number; c?: string; filled?: boolean }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? c : 'none'} stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
export const IcQueue    = (p: { s?: number }) => <Ic s={p.s}><path d="M3 6h13M3 12h13M3 18h9M17 14v7l5-3.5z" fill="currentColor"/></Ic>;
export const IcVol      = (p: { s?: number }) => <Ic s={p.s}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><path d="M15 9a3 3 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></Ic>;
export const IcSearch   = (p: { s?: number }) => <Ic s={p.s}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
export const IcDot      = ({ c = 'currentColor', s = 8 }: { c?: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={c}/></svg>;
export const IcBolt     = (p: { s?: number }) => <Ic s={p.s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10" fill="currentColor"/></Ic>;
export const IcCheck    = (p: { s?: number }) => <Ic s={p.s}><polyline points="20 6 9 17 4 12"/></Ic>;
export const IcArrow    = ({ s = 14 }: { s?: number }) =>
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

export const IcQR = ({ s = 60 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 80 80">
    {([[0,0],[60,0],[0,60]] as [number,number][]).map(([x,y],i)=>(
      <g key={i}><rect x={x} y={y} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3"/><rect x={x+6} y={y+6} width="8" height="8" fill="currentColor"/></g>
    ))}
    {Array.from({length:40}).map((_,i)=>{
      const x=24+(i%10)*4, y=24+Math.floor(i/10)*4;
      return (i*13+7)%3===0 ? <rect key={i} x={x} y={y} width="3" height="3" fill="currentColor"/> : null;
    })}
  </svg>
);
