const _ChC = {
  ac:'#ff5029', ink:'#f0ebe5', ink2:'#9e9080', ink3:'#5a5048',
  bg:'#1a1612', line:'rgba(255,255,255,.06)', line2:'rgba(255,255,255,.14)',
  fb:"'DM Sans',system-ui,sans-serif", fm:"'JetBrains Mono',monospace",
};

export function Checkbox({ checked, onChange, label, detail, disabled, accent = '#ff5029' }) {
  return React.createElement('label', {
    style:{ display:'flex', alignItems:'flex-start', gap:10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .45 : 1 },
  },
    React.createElement('div', {
      onClick: disabled ? null : () => onChange && onChange(!checked),
      style:{
        width:18, height:18, borderRadius:4, flexShrink:0, marginTop:2,
        background: checked ? accent : 'transparent',
        border:`1.5px solid ${checked ? accent : _ChC.line2}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'background 120ms, border-color 120ms',
      },
    }, checked && React.createElement('svg', { width:10, height:10, viewBox:'0 0 24 24', fill:'none' },
      React.createElement('path', { d:'M5 12l4 4L19 7', stroke:'#0a0805', strokeWidth:'3', strokeLinecap:'round', strokeLinejoin:'round' })
    )),
    React.createElement('div', null,
      label && React.createElement('div', { style:{ fontSize:14, fontFamily:_ChC.fb, color:_ChC.ink, lineHeight:1.4 } }, label),
      detail && React.createElement('div', { style:{ fontSize:12, fontFamily:_ChC.fb, color:_ChC.ink3, marginTop:2, lineHeight:1.5 } }, detail)
    )
  );
}
