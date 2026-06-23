const _RC = {
  ac:'#ff5029', ink:'#f0ebe5', ink3:'#5a5048',
  line2:'rgba(255,255,255,.14)', fb:"'DM Sans',system-ui,sans-serif",
};

export function Radio({ options = [], value, onChange, accent = '#ff5029' }) {
  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:10 } },
    options.map((o, i) => {
      const v = o.value ?? o, lbl = o.label ?? o, active = v === value;
      return React.createElement('label', {
        key: i,
        style:{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
      },
        React.createElement('div', {
          onClick:() => onChange && onChange(v),
          style:{
            width:18, height:18, borderRadius:'50%', flexShrink:0,
            border:`1.5px solid ${active ? accent : _RC.line2}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'border-color 120ms',
          },
        }, active && React.createElement('div', { style:{ width:8, height:8, borderRadius:'50%', background: accent } })),
        React.createElement('span', { style:{ fontSize:14, fontFamily:_RC.fb, color: active ? _RC.ink : _RC.ink3 } }, lbl)
      );
    })
  );
}
