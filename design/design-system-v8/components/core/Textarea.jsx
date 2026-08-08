const _TaT = {
  bg: '#121b2e', ink: '#eef1f6', ink2: '#96a1b5', ink3: '#8792a6',
  line: 'rgba(255,255,255,0.06)', line2: 'rgba(255,255,255,0.14)', accent: '#ff5029',
  fb: "'Work Sans',system-ui,sans-serif", fm: "'JetBrains Mono',monospace",
};

export function Textarea({ label, placeholder = '', value, onChange, hint, error, rows = 4, disabled = false }) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? _TaT.accent : focused ? 'rgba(255,255,255,0.28)' : _TaT.line2;
  const wrap = { display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.45 : 1 };
  const areaStyle = {
    background: _TaT.bg, border: `1px solid ${borderColor}`, borderRadius: 10,
    padding: '10px 12px', fontFamily: _TaT.fb, fontSize: 14, color: _TaT.ink,
    outline: 'none', resize: 'vertical', caretColor: _TaT.accent,
  };
  return React.createElement('div', { style: wrap },
    label && React.createElement('div', { style: { fontFamily: _TaT.fm, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: _TaT.ink3 } }, label),
    React.createElement('textarea', {
      rows, placeholder, value, disabled,
      onChange: e => onChange && onChange(e.target.value),
      onFocus: () => setFocused(true), onBlur: () => setFocused(false),
      style: areaStyle,
    }),
    (hint || error) && React.createElement('div', { style: { fontFamily: _TaT.fb, fontSize: 12, color: error ? _TaT.accent : _TaT.ink3 } }, error || hint),
  );
}
