'use client';

import React from 'react';

// ── SkeletonBlock ─────────────────────────────────────────────────
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 6,
  style,
}: {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, #1a1612 25%, #221c16 50%, #1a1612 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// ── SkeletonMeView ────────────────────────────────────────────────
export function SkeletonMeView() {
  return (
    <div style={{ padding: '32px 48px 48px', maxWidth: 1600, margin: '0 auto' }}>

      {/* Hero card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr auto',
        gap: 28,
        alignItems: 'center',
        padding: 26,
        borderRadius: 14,
        background: '#121009',
        border: '1px solid rgba(255,255,255,.07)',
        marginBottom: 28,
      }}>
        {/* Avatar circle */}
        <SkeletonBlock width={200} height={200} radius={14} />

        {/* Identity col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Role badges row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <SkeletonBlock width={72} height={24} radius={99} />
            <SkeletonBlock width={88} height={24} radius={99} />
          </div>
          {/* Name */}
          <SkeletonBlock width="55%" height={48} radius={8} />
          {/* Sub line */}
          <SkeletonBlock width="40%" height={14} radius={6} />
          {/* Bio */}
          <SkeletonBlock width="70%" height={14} radius={6} />
          <SkeletonBlock width="50%" height={14} radius={6} />
        </div>

        {/* Stats 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '18px 28px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <SkeletonBlock width={64} height={28} radius={6} />
              <SkeletonBlock width={80} height={12} radius={4} />
            </div>
          ))}
        </div>
      </div>

      {/* Discover / Trending Near You + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, marginBottom: 32 }}>
        <div>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SkeletonBlock width={160} height={18} radius={6} />
            <SkeletonBlock width={60} height={14} radius={4} />
          </div>
          {/* 3 trending cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#121009',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                {/* Cover area */}
                <SkeletonBlock width="100%" height={100} radius={0} />
                {/* Card body */}
                <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SkeletonBlock width="70%" height={14} radius={5} />
                  <SkeletonBlock width="50%" height={11} radius={4} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <SkeletonBlock width={40} height={18} radius={4} />
                      <SkeletonBlock width={32} height={10} radius={3} />
                    </div>
                    <SkeletonBlock width={64} height={32} radius={99} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Hype activity bars */}
          <div style={{
            background: '#121009',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <SkeletonBlock width={120} height={10} radius={3} style={{ marginBottom: 12 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 28px', gap: 6, alignItems: 'center', marginBottom: 7 }}>
                <SkeletonBlock width={60 + i * 4} height={10} radius={3} />
                <SkeletonBlock width="100%" height={4} radius={2} />
                <SkeletonBlock width={24} height={10} radius={3} />
              </div>
            ))}
          </div>

          {/* Recent Hypers */}
          <div style={{
            background: '#121009',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <SkeletonBlock width={100} height={10} radius={3} style={{ marginBottom: 12 }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
                <SkeletonBlock width={90} height={11} radius={3} />
                <SkeletonBlock width={40} height={11} radius={3} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.07) 30%, rgba(255,255,255,.07) 70%, transparent)', marginBottom: 28 }} />

      {/* Stat KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 14, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 10,
            background: '#121009',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <SkeletonBlock width="60%" height={12} radius={4} />
            <SkeletonBlock width="50%" height={28} radius={6} />
            <SkeletonBlock width="75%" height={12} radius={4} />
          </div>
        ))}
        {/* Streak card placeholder */}
        <div style={{
          padding: '14px 18px',
          border: '1px solid rgba(255,80,41,.12)',
          borderRadius: 12,
          background: '#121009',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minWidth: 110,
        }}>
          <SkeletonBlock width={40} height={36} radius={8} />
          <SkeletonBlock width={60} height={12} radius={4} />
        </div>
      </div>

      {/* Two-col panels skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 14 }}>
        {/* Top 5 panel */}
        <div style={{
          background: '#121009',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <SkeletonBlock width={120} height={14} radius={4} />
            <SkeletonBlock width={80} height={12} radius={4} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < 4 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
              <SkeletonBlock width={20} height={14} radius={3} />
              <SkeletonBlock width={32} height={32} radius={5} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <SkeletonBlock width="65%" height={13} radius={4} />
                <SkeletonBlock width="45%" height={11} radius={3} />
              </div>
              <SkeletonBlock width={28} height={13} radius={3} />
              <SkeletonBlock width={28} height={13} radius={3} />
            </div>
          ))}
        </div>

        {/* Activity panel */}
        <div style={{
          background: '#121009',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <SkeletonBlock width={110} height={14} radius={4} />
            <SkeletonBlock width={60} height={12} radius={4} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < 4 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />
              <SkeletonBlock width="70%" height={13} radius={4} />
              <SkeletonBlock width={36} height={12} radius={3} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
