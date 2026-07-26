const _DC = {
  bg:'#100d09', ink:'#f0ebe5', ink3:'#5a5048', ac:'#ff5029',
  line:'rgba(255,255,255,.06)', line2:'rgba(255,255,255,.14)',
  fd:"'Syne',sans-serif", fb:"'DM Sans',system-ui,sans-serif", fm:"'JetBrains Mono',monospace",
};

export function Dialog({ open, title, description, children, onClose, width = 480 }) {
  if (!open) return null;
  return React.createElement(React.Fragment, null,
    // Backdrop
    React.createElement('div', {
      onClick: onClose,
      style:{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.65)', backdropFilter:'blur(4px)', animation:'ihype-fade-in 150ms ease both' },
    }),
    // Panel
    React.createElement('div', {
      style:{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:201, width, maxWidth:'calc(100vw - 32px)',
        background:_DC.bg, border:`1px solid ${_DC.line2}`, borderRadius:16,
        boxShadow:'0 24px 64px rgba(0,0,0,.6)', overflow:'hidden',
        animation:'ihype-scale-in 180ms cubic-bezier(0.2,0.7,0.3,1) both',
        fontFamily:_DC.fb,
      },
    },
    // Header
    React.createElement('div', { style:{ display:'flex', alignItems:'flex-start', gap:12, padding:'20px 22px 16px', borderBottom:`1px solid ${_DC.line}` } },
      React.createElement('div', { style:{ flex:1 } },
        React.createElement('div', { style:{ fontFamily:_DC.fd, fontWeight:800, fontSize:17, letterSpacing:'-.01em', color:_DC.ink } }, title),
        description && React.createElement('div', { style:{ fontSize:13, color:_DC.ink3, marginTop:4, lineHeight:1.6 } }, description),
      ),
      onClose && React.createElement('button', {
        onClick: onClose,
        style:{ width:28, height:28, borderRadius:6, background:'transparent', border:`1px solid ${_DC.line2}`, color:_DC.ink3, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 },
      }, React.createElement('svg', { width:12, height:12, viewBox:'0 0 24 24', fill:'none' }, React.createElement('path', { d:'M6 6l12 12M18 6L6 18', stroke:'currentColor', strokeWidth:'2', strokeLinecap:'round' })))
    ),
    // Body
    children && React.createElement('div', { style:{ padding:'16px 22px 22px' } }, children)
    )
  );
}
