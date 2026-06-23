// iHYPE Icon — thin wrapper around Lucide icons via CDN
// Requires: <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"> in page head

const _IC = { color:'#f0ebe5' };

export function Icon({ name, size = 16, color, strokeWidth = 1.6, style: s }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    if (typeof lucide === 'undefined') return;
    ref.current.innerHTML = '';
    const icon = lucide.icons[name];
    if (!icon) return;
    const [tag, attrs, children] = icon;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.entries({ ...attrs, width: size, height: size, stroke: color || _IC.color, 'stroke-width': strokeWidth }).forEach(([k, v]) => svg.setAttribute(k, v));
    children.forEach(([ct, ca]) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', ct);
      Object.entries(ca).forEach(([k, v]) => el.setAttribute(k, v));
      svg.appendChild(el);
    });
    ref.current.appendChild(svg);
  }, [name, size, color, strokeWidth]);

  return React.createElement('span', {
    ref,
    style: { display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, ...s },
  });
}
