export function Eyebrow({ children, color = '#5a5048' }) {
  return React.createElement('div', {
    style: { fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '.18em', color, textTransform: 'uppercase', fontWeight: 600 },
  }, children);
}
