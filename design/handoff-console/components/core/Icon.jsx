'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · default stroke #1c1408 → 'currentColor'. The design system specifies
     currentColor precisely so an icon inherits role colour and, more
     importantly, walnut ink from its container — a hardcoded board ink was
     invisible on the console chrome.
   · strokeWidth 1.6 kept: inside the documented 1.4–1.8 range. */
/* Requires lucide UMD on the page:
   <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"> */

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.6, style: s }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current) return;
    if (typeof lucide === 'undefined') return;
    ref.current.innerHTML = '';
    const icon = lucide.icons[name];
    if (!icon) return;
    const [, attrs, children] = icon;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.entries({ ...attrs, width: size, height: size, stroke: color, 'stroke-width': strokeWidth })
      .forEach(([k, v]) => svg.setAttribute(k, v));
    children.forEach(([ct, ca]) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', ct);
      Object.entries(ca).forEach(([k, v]) => el.setAttribute(k, v));
      svg.appendChild(el);
    });
    ref.current.appendChild(svg);
  }, [name, size, color, strokeWidth]);

  return (
    <span ref={ref} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color,
      ...s,
    }} />
  );
}
