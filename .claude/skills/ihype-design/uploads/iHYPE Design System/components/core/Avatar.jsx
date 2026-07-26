export function Avatar({ name = '', roleColor = '#ff5029', size = 32 }) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return React.createElement('div', {
    style: {
      width: size, height: size, borderRadius: '50%',
      background: roleColor, color: '#0a0805',
      fontFamily: "'Syne',sans-serif", fontWeight: 800,
      fontSize: Math.round(size * 0.38),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
  }, initials);
}
