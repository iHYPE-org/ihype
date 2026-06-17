'use client';

import React from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T } from './MobilePrimitives';
import { logoutAction } from '@/app/logout/actions';

interface Props {
  data: WorkbenchData;
  onPage: () => void;
  onCockpit: () => void;
  onStudio: () => void;
  onManage: () => void;
  onJournal: () => void;
  onNotif: () => void;
  onSettings: () => void;
}

function ToolRow({ label, sub, icon, onClick, last = false }: {
  label: string; sub: string; icon: React.ReactNode; onClick: () => void; last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', background: 'none', border: 'none',
        borderBottom: last ? 'none' : `1px solid ${T.line}`,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.ink2,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fd, fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{label}</div>
        <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, marginTop: 3 }}>{sub}</div>
      </div>
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );
}

export function MobileScreenPages({ data, onPage, onCockpit, onStudio, onManage, onJournal, onNotif, onSettings }: Props) {
  const role = (data.profileType ?? '').toUpperCase();
  const isArtist = role === 'ARTIST';
  const isDJ = role === 'DJ';
  const isVenue = role === 'VENUE';
  const isCreator = isArtist || isDJ;
  const hasPowerPage = isArtist || isDJ || isVenue;
  const canTools = isCreator || isVenue;

  const pageTypeLabel = isArtist ? 'Artist Page' : isDJ ? 'DJ Page' : isVenue ? 'Venue Page' : 'Fan Page';
  const hasPage = hasPowerPage || (data.profileCompletion?.percent ?? 0) >= 25;

  return (
    <div style={{ overflowY: 'auto', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 8 }}>
          Your presence
        </div>
        <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 28, letterSpacing: '-.03em', color: T.ink, lineHeight: 1 }}>
          Pages
        </div>
      </div>

      {/* Page section — merged creator + cockpit */}
      <div style={{ margin: '0 16px 24px' }}>
        {hasPage ? (
          <div style={{ borderRadius: 18, background: T.bg2, border: `1px solid ${T.line2}`, overflow: 'hidden' }}>
            <div style={{ padding: '18px 18px 16px', background: 'linear-gradient(135deg, rgba(185,131,255,.1), rgba(255,80,41,.06))' }}>
              <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 5 }}>
                {pageTypeLabel}
              </div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 20, color: T.ink, lineHeight: 1 }}>
                {data.userName ?? 'Your Page'}
              </div>
            </div>
            <div style={{ display: 'flex', borderTop: `1px solid ${T.line}` }}>
              <button onClick={onPage} style={{
                flex: 1, padding: '14px 0', background: 'none', border: 'none',
                borderRight: `1px solid ${T.line}`, cursor: 'pointer',
                fontFamily: T.fm, fontSize: 11, fontWeight: 700, color: T.ink2, letterSpacing: '.1em',
              }}>
                EDIT
              </button>
              <button onClick={onCockpit} style={{
                flex: 1, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: T.fm, fontSize: 11, fontWeight: 700, color: T.purple, letterSpacing: '.1em',
              }}>
                ✦ AI EDIT
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onPage}
            style={{
              width: '100%', padding: '28px 20px', borderRadius: 18, cursor: 'pointer', textAlign: 'left',
              background: 'linear-gradient(135deg, rgba(185,131,255,.07), rgba(255,80,41,.05))',
              border: `1.5px dashed ${T.line2}`,
            }}
          >
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, color: T.ink, marginBottom: 6, lineHeight: 1.1 }}>
              Create your {pageTypeLabel}
            </div>
            <div style={{ fontFamily: T.fb, fontSize: 13, color: T.ink2, marginBottom: 18, lineHeight: 1.4 }}>
              Start with AI — takes 2 minutes.
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 99, background: T.accent, color: '#fff', fontFamily: T.fm, fontSize: 11, fontWeight: 700, letterSpacing: '.08em' }}>
              Get started →
            </div>
          </button>
        )}
      </div>

      {/* Role tools */}
      {canTools && (
        <div style={{ margin: '0 16px 20px' }}>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2 }}>
            Tools
          </div>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.bg2 }}>
            {isCreator && (
              <ToolRow
                label="Studio"
                sub="Tracks, releases & tools"
                onClick={onStudio}
                icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><rect x="2" y="5" width="16" height="10" rx="2"/><path d="M6 10h1.5M10 8v4M13.5 9v2" strokeLinecap="round"/></svg>}
              />
            )}
            <ToolRow
              label="Console"
              sub={isVenue ? 'Venue requests & stats' : 'Artist stats & tools'}
              onClick={onManage}
              icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><rect x="1" y="4" width="18" height="12" rx="2"/><path d="M5 10h2.5M10 7.5v5M14 9v3"/></svg>}
            />
            <ToolRow
              label="Journal"
              sub="Posts & updates"
              last
              onClick={onJournal}
              icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><rect x="3" y="2" width="14" height="16" rx="2"/><path d="M7 7h6M7 11h4" strokeLinecap="round"/></svg>}
            />
          </div>
        </div>
      )}

      {/* Account */}
      <div style={{ margin: '0 16px 24px' }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2 }}>
          Account
        </div>
        <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.bg2 }}>
          <ToolRow
            label="Notifications"
            sub="Alerts & activity"
            onClick={onNotif}
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><path d="M5 8a5 5 0 0 1 10 0v3.5l1.5 2.5h-13L5 11.5V8Z"/><path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round"/></svg>}
          />
          <ToolRow
            label="Settings"
            sub="Account & preferences"
            onClick={onSettings}
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" strokeLinecap="round"/></svg>}
          />
          <ToolRow
            label="Sign out"
            sub="End your session"
            last
            onClick={() => { void logoutAction(); }}
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><path d="M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3M13 14l3-4-3-4M16 10H8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>
      </div>
    </div>
  );
}
