const _PB = { bg:'rgba(255,255,255,.06)', fb:"'DM Sans',system-ui,sans-serif", fm:"'JetBrains Mono',monospace", ink3:'#5a5048' };

export function ProgressBar({ value = 0, max = 100, accent = '#ff5029', height = 5, label, showValue, style: s }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:6, ...s } },
    (label || showValue) && React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'baseline' } },
      label && React.createElement('div', { style:{ fontFamily:_PB.fm, fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:_PB.ink3 } }, label),
      showValue && React.createElement('div', { style:{ fontFamily:_PB.fm, fontSize:9, color: accent } }, `${Math.round(pct)}%`)
    ),
    React.createElement('div', { style:{ height, borderRadius:99, background:_PB.bg, overflow:'hidden' } },
      React.createElement('div', {
        style:{
          height:'100%', width:`${pct}%`, background: accent, borderRadius:99,
          transition:'width 400ms cubic-bezier(0.2,0.7,0.3,1)',
        },
      })
    )
  );
}
