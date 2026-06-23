export function Badge({ children, color = '#ff5029', variant = 'filled' }) {
  const style = {
    display: 'inline-flex', alignItems: 'center',
    height: 20, padding: '0 8px', borderRadius: 4,
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 9, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
    background: variant === 'filled' ? `${color}22` : 'transparent',
    color: color,
    border: variant === 'outline' ? `1px solid ${color}50` : 'none',
  };
  return React.createElement('span', { style }, children);
}
