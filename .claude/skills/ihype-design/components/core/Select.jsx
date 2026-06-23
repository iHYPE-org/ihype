const _SC = {
  bg:'#1a1612', bg2:'#100d09', ink:'#f0ebe5', ink2:'#9e9080', ink3:'#5a5048',
  ac:'#ff5029', line:'rgba(255,255,255,.06)', line2:'rgba(255,255,255,.14)',
  fm:"'JetBrains Mono',monospace", fb:"'DM Sans',system-ui,sans-serif",
};

export function Select({ label, options = [], value, onChange, error, hint, style: s }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const sel = options.find(o => (o.value ?? o) === value);
  const display = sel ? (sel.label ?? sel) : '';

  React.useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const chevron = React.createElement('svg', { width:12, height:12, viewBox:'0 0 24 24', fill:'none', style:{ transition:'transform 150ms', transform: open ? 'rotate(180deg)' : 'none', flexShrink:0 } },
    React.createElement('path', { d:'M6 9l6 6 6-6', stroke: error ? _SC.ac : _SC.ink3, strokeWidth:'1.8', strokeLinecap:'round', strokeLinejoin:'round' })
  );

  return React.createElement('div', { ref, style:{ fontFamily:_SC.fb, position:'relative', ...s } },
    label && React.createElement('div', { style:{ fontFamily:_SC.fm, fontSize:9, letterSpacing:'.14em', textTransform:'uppercase', color: error ? _SC.ac : _SC.ink3, marginBottom:6 } }, label),
    React.createElement('button', {
      type:'button', onClick:() => setOpen(p => !p),
      style:{
        width:'100%', display:'flex', alignItems:'center', gap:8,
        height:40, padding:'0 12px',
        background: _SC.bg, border:`1px solid ${error ? _SC.ac+'88' : open ? _SC.line2 : _SC.line}`,
        borderRadius:8, color: display ? _SC.ink : _SC.ink3, fontSize:14, cursor:'pointer',
        transition:'border-color 120ms',
      },
    }, React.createElement('span', { style:{ flex:1, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, display || 'Select…'), chevron),
    open && React.createElement('div', {
      style:{
        position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:99,
        background:_SC.bg2, border:`1px solid ${_SC.line2}`, borderRadius:8,
        overflow:'hidden', boxShadow:'0 8px 24px rgba(0,0,0,.4)',
        animation:'ihype-scale-in 120ms ease both',
      },
    }, options.map((o, i) => {
      const v = o.value ?? o, lbl = o.label ?? o, active = v === value;
      return React.createElement('button', {
        key: i, type:'button',
        onClick:() => { onChange && onChange(v); setOpen(false); },
        style:{
          width:'100%', display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
          background: active ? `${_SC.ac}18` : 'transparent', border:'none',
          borderBottom: i < options.length-1 ? `1px solid ${_SC.line}` : 'none',
          color: active ? _SC.ac : _SC.ink, fontSize:14, cursor:'pointer', textAlign:'left',
        },
      },
      active && React.createElement('svg', { width:10, height:10, viewBox:'0 0 24 24', fill:'none' }, React.createElement('path', { d:'M5 12l4 4L19 7', stroke:_SC.ac, strokeWidth:'2.5', strokeLinecap:'round', strokeLinejoin:'round' })),
      !active && React.createElement('span', { style:{ width:10 } }),
      lbl);
    })),
    (hint || error) && React.createElement('div', { style:{ fontFamily:_SC.fm, fontSize:9, letterSpacing:'.08em', color: error ? _SC.ac : _SC.ink3, marginTop:5 } }, error || hint)
  );
}
