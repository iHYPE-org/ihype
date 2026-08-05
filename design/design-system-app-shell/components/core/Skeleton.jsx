const _SK = { bg:'#1a1612', shimmer:'rgba(255,255,255,.04)' };

export function Skeleton({ width = '100%', height = 16, radius = 6, style: s }) {
  return React.createElement('div', {
    style:{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${_SK.bg} 25%, ${_SK.shimmer} 50%, ${_SK.bg} 75%)`,
      backgroundSize:'200% 100%',
      animation:'ihype-shimmer 1.6s ease-in-out infinite',
      flexShrink:0, ...s,
    },
  });
}

// Compound: SkeletonText — a block of n lines
export function SkeletonText({ lines = 3, lastWidth = '60%', style: s }) {
  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:8, ...s } },
    Array.from({ length: lines }, (_, i) =>
      React.createElement(Skeleton, { key: i, width: i === lines-1 ? lastWidth : '100%', height:12 })
    )
  );
}
