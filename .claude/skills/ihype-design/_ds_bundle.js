/* @ds-bundle: {"format":4,"namespace":"IHYPEDesignSystem_39bcce","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Checkbox","sourcePath":"components/core/Checkbox.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Dialog","sourcePath":"components/core/Dialog.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"ProgressBar","sourcePath":"components/core/ProgressBar.jsx"},{"name":"Radio","sourcePath":"components/core/Radio.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Skeleton","sourcePath":"components/core/Skeleton.jsx"},{"name":"SkeletonText","sourcePath":"components/core/Skeleton.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"Toast","sourcePath":"components/core/Toast.jsx"},{"name":"Toggle","sourcePath":"components/core/Toggle.jsx"}],"sourceHashes":{"beta/demo-walkthrough.js":"9ece8039b673","components/core/Avatar.jsx":"9114ab49e476","components/core/Badge.jsx":"8ac3a93994c0","components/core/Button.jsx":"c0c559dc8c3f","components/core/Card.jsx":"5c24339f964a","components/core/Checkbox.jsx":"397dd07298da","components/core/Chip.jsx":"62b091127312","components/core/Dialog.jsx":"897b10b716e0","components/core/Eyebrow.jsx":"5b899d64163f","components/core/Icon.jsx":"f1e354f0e36d","components/core/Input.jsx":"4175b7acb4cf","components/core/ProgressBar.jsx":"b76d9c275901","components/core/Radio.jsx":"421158deaeeb","components/core/Select.jsx":"4f1ab6a7f9d1","components/core/Skeleton.jsx":"6aaed5c0fac3","components/core/Tabs.jsx":"c40de05261d4","components/core/Toast.jsx":"adb69bdb19cf","components/core/Toggle.jsx":"2f0b6b45dfb9","engineering/sw.js":"89c7c520112f","lib/api.js":"f5aaa06abe55","lib/db.js":"b5df8464df06","lib/hydrate.js":"d51e0f23ce1f","sw.js":"89c7c520112f","ui_kits/fan-app/EventsTab.jsx":"fb76c9d12f41","ui_kits/fan-app/ListenTab.jsx":"15827f85351a","ui_kits/fan-app/MoreSheets.jsx":"0031eb761eb8","ui_kits/fan-app/PagesTab.jsx":"447b7d406195","ui_kits/fan-app/RadioShowCreator.jsx":"2858932604a6","ui_kits/fan-app/Seeds.jsx":"ef62befd6988","ui_kits/fan-app/Sheets.jsx":"2f4ea6a088ce","ui_kits/fan-app/Shell.jsx":"ef73835b875e","ui_kits/fan-app/data.js":"67b419eeab91","ui_kits/ops/ops.jsx":"959d989edde3"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.IHYPEDesignSystem_39bcce = window.IHYPEDesignSystem_39bcce || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// beta/demo-walkthrough.js
try { (() => {
// iHYPE Guided Demo — drives the embedded fan app via its window globals.
(function () {
  const frame = document.getElementById('appframe');
  const elList = document.getElementById('steplist');
  const elTitle = document.getElementById('ntitle');
  const elBody = document.getElementById('nbody');
  const elFill = document.getElementById('progfill');
  const elNext = document.getElementById('next');
  const elPause = document.getElementById('pause');
  const elCount = document.getElementById('count');
  const win = () => frame.contentWindow;
  const call = (fn, ...a) => {
    try {
      const w = win();
      if (w && typeof w[fn] === 'function') w[fn](...a);
    } catch (e) {}
  };
  const data = () => {
    try {
      return win().IHYPE_DATA;
    } catch (e) {
      return null;
    }
  };

  // Bypass the beta gate + onboarding inside the demo iframe so the tour lands
  // straight in the app. Seed flags, then reload once (guard prevents a loop).
  frame.addEventListener('load', () => {
    try {
      const ls = win().localStorage;
      if (!ls.getItem('ihype_beta_ok')) {
        ls.setItem('ihype_beta_ok', '1');
        ls.setItem('ihype_onboarded_v2', JSON.stringify({
          role: 'fan',
          city: 'Los Angeles',
          genres: ['dream-pop', 'lo-fi', 'electronic']
        }));
        win().location.reload();
      }
    } catch (e) {/* cross-origin guard */}
  });

  // Tour steps. dur = ms on screen before auto-advance.
  const STEPS = [{
    label: 'Welcome',
    title: 'iHYPE in 90 seconds',
    body: 'Artist-owned live music. Fans hype who they love, buy tickets direct, and earn by promoting — with 70% of every ticket locked to the artist. Let’s walk the app.',
    dur: 6500,
    run() {
      call('closeIHYPESheets');
      call('setIHYPETab', 'listen');
    }
  }, {
    label: 'Listen & hype',
    title: 'Hype the artists you believe in',
    body: 'The Listen tab is discovery. Each 🔥 is a fan backing a rising artist — every fan gets a weekly hype budget, so attention can’t be bought.',
    dur: 7000,
    run() {
      call('closeIHYPESheets');
      call('setIHYPETab', 'listen');
    }
  }, {
    label: 'Artist page',
    title: 'Real artists, verified',
    body: 'Tap any artist for their page — tracks, upcoming shows, and a verified ✓ badge. This is where hype turns into a following.',
    dur: 7500,
    run() {
      call('setIHYPETab', 'listen');
      const w = win();
      const a = w && w.lookupArtist && w.lookupArtist('Midnight Echo', '#ff5029');
      if (a) call('openIHYPEArtistProfile', a);
    }
  }, {
    label: 'Events',
    title: 'Tickets, direct from the artist',
    body: 'No scalper markup, no 30% fees. Every event ships with a frozen charter — 70% to the artist, locked the moment tickets go on sale.',
    dur: 7000,
    run() {
      call('closeIHYPESheets');
      call('setIHYPETab', 'events');
    }
  }, {
    label: 'Live show',
    title: 'When the artist goes live',
    body: 'A LIVE show flips the app into the moment — real-time listener count, a hype pulse, and live chat. This is the iHYPE heartbeat.',
    dur: 7500,
    run() {
      call('setIHYPETab', 'events');
      const D = data();
      const live = D && D.shows && (D.shows.find(s => s.status === 'LIVE') || D.shows[0]);
      if (live) call('openIHYPELiveEvent', live);
    }
  }, {
    label: 'Earn',
    title: 'Promote a show, earn a cut',
    body: 'Any fan or DJ can share a referral link and earn up to 10% of the gate they drive — paid from its own dedicated 10% slice — iHYPE takes 0%.',
    dur: 7500,
    run() {
      call('closeIHYPESheets');
      call('setIHYPETab', 'events');
      call('openIHYPEEarnings');
    }
  }, {
    label: 'Your pages',
    title: 'Your home on iHYPE',
    body: 'Pages holds your profile, your crate, your playlists, and — for DJs — the radio studio and earnings. One account, four roles.',
    dur: 7000,
    run() {
      call('closeIHYPESheets');
      call('setIHYPETab', 'pages');
    }
  }, {
    label: 'Join the beta',
    title: 'That’s iHYPE.',
    body: 'Built for desktop, mobile web, iOS, and Android from one codebase. Closed beta is live — join at admin@ihype.org. Replay the tour anytime.',
    dur: 99999,
    run() {
      call('closeIHYPESheets');
      call('setIHYPETab', 'listen');
    },
    last: true
  }];
  let idx = -1,
    timer = null,
    rafID = null,
    paused = false,
    started = false,
    ready = false;

  // Build the step list
  STEPS.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'si';
    row.innerHTML = `<div class="dot">${i + 1}</div><div class="t">${s.label}</div>`;
    row.onclick = () => {
      if (ready) goto(i);
    };
    elList.appendChild(row);
  });
  const rows = [...elList.children];
  function renderList() {
    rows.forEach((r, i) => {
      r.classList.toggle('on', i === idx);
      r.classList.toggle('done', i < idx);
      r.querySelector('.dot').textContent = i < idx ? '✓' : i + 1;
    });
  }
  function clearTimers() {
    clearTimeout(timer);
    cancelAnimationFrame(rafID);
  }
  function runProgress(dur) {
    elFill.style.width = '0%';
    if (dur > 90000) {
      elFill.style.width = '100%';
      return;
    } // last step: no countdown
    const start = performance.now();
    const tick = now => {
      if (paused) {
        return;
      }
      const p = Math.min(1, (now - start) / dur);
      elFill.style.width = p * 100 + '%';
      if (p < 1) rafID = requestAnimationFrame(tick);
    };
    rafID = requestAnimationFrame(tick);
  }
  function goto(i) {
    clearTimers();
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    const s = STEPS[idx];
    elTitle.textContent = s.title;
    elBody.textContent = s.body;
    elCount.textContent = idx + 1 + ' / ' + STEPS.length;
    elNext.textContent = s.last ? 'Replay tour ↻' : 'Next →';
    renderList();
    try {
      s.run();
    } catch (e) {}
    if (!paused) runProgress(s.dur);
    if (!s.last && !paused) timer = setTimeout(() => goto(idx + 1), s.dur);
  }
  elNext.onclick = () => {
    if (!started) {
      started = true;
      goto(0);
      return;
    }
    const s = STEPS[idx];
    if (s.last) {
      idx = -1;
      started = true;
      goto(0);
      return;
    }
    goto(idx + 1);
  };
  elPause.onclick = () => {
    paused = !paused;
    elPause.textContent = paused ? '▶' : '❚❚';
    if (paused) {
      clearTimers();
    } else if (started) {
      runProgress(STEPS[idx].dur);
      if (!STEPS[idx].last) timer = setTimeout(() => goto(idx + 1), STEPS[idx].dur * (1 - parseFloat(elFill.style.width) / 100 || 1));
    }
  };

  // Wait for the embedded app to finish mounting (globals available)
  elTitle.textContent = 'Loading the app…';
  elBody.textContent = 'Spinning up the iHYPE fan app in the iOS frame.';
  elNext.disabled = true;
  elNext.style.opacity = '.5';
  let waited = 0;
  const poll = setInterval(() => {
    waited += 200;
    if (win() && typeof win().setIHYPETab === 'function' || waited > 9000) {
      clearInterval(poll);
      ready = true;
      elNext.disabled = false;
      elNext.style.opacity = '1';
      elTitle.textContent = 'iHYPE in 90 seconds';
      elBody.textContent = 'A guided, auto-advancing tour of the fan app. Press Start — or click any step on the left to jump.';
      elCount.textContent = '0 / ' + STEPS.length;
    }
  }, 200);
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "beta/demo-walkthrough.js", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
function Avatar({
  name = '',
  roleColor = '#ff5029',
  size = 32
}) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return React.createElement('div', {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: roleColor,
      color: '#0a0805',
      fontFamily: "'Syne',sans-serif",
      fontWeight: 800,
      fontSize: Math.round(size * 0.38),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function Badge({
  children,
  color = '#ff5029',
  variant = 'filled'
}) {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    padding: '0 8px',
    borderRadius: 4,
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    background: variant === 'filled' ? `${color}22` : 'transparent',
    color: color,
    border: variant === 'outline' ? `1px solid ${color}50` : 'none'
  };
  return React.createElement('span', {
    style
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const _BtnT = {
  bg: '#0a0805',
  ink: '#f0ebe5',
  accent: '#ff5029',
  fb: "'DM Sans',system-ui,sans-serif"
};
function Button({
  children,
  tone = 'solid',
  accent = _BtnT.accent,
  disabled = false,
  leading,
  full,
  onClick
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: _BtnT.fb,
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '.01em',
    padding: '0 20px',
    opacity: disabled ? 0.45 : 1,
    width: full ? '100%' : undefined,
    transition: 'opacity 120ms, background 120ms'
  };
  const styles = {
    solid: {
      ...base,
      background: accent,
      color: _BtnT.bg
    },
    ghost: {
      ...base,
      background: `${accent}22`,
      color: accent
    },
    outline: {
      ...base,
      background: 'transparent',
      color: accent,
      border: `1px solid ${accent}40`
    }
  };
  return React.createElement('button', {
    style: styles[tone] || styles.solid,
    disabled,
    onClick
  }, leading, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
const _T = {
  bg2: '#100d09',
  ink: '#f0ebe5',
  ink3: '#5a5048',
  line: 'rgba(255,255,255,.06)',
  fb: "'DM Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace"
};
function Card({
  children,
  title,
  link,
  style
}) {
  const cardStyle = {
    border: `1px solid ${_T.line}`,
    borderRadius: 10,
    background: _T.bg2,
    overflow: 'hidden',
    ...style
  };
  const headerStyle = {
    padding: '12px 16px',
    borderBottom: `1px solid ${_T.line}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };
  return React.createElement('section', {
    style: cardStyle
  }, title && React.createElement('div', {
    style: headerStyle
  }, React.createElement('div', {
    style: {
      fontFamily: _T.fb,
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: '-.005em',
      color: _T.ink
    }
  }, title), link && React.createElement('div', {
    style: {
      fontFamily: _T.fm,
      fontSize: 9,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: _T.ink3
    }
  }, link)), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Checkbox.jsx
try { (() => {
const _ChC = {
  ac: '#ff5029',
  ink: '#f0ebe5',
  ink2: '#9e9080',
  ink3: '#5a5048',
  bg: '#1a1612',
  line: 'rgba(255,255,255,.06)',
  line2: 'rgba(255,255,255,.14)',
  fb: "'DM Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace"
};
function Checkbox({
  checked,
  onChange,
  label,
  detail,
  disabled,
  accent = '#ff5029'
}) {
  return React.createElement('label', {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .45 : 1
    }
  }, React.createElement('div', {
    onClick: disabled ? null : () => onChange && onChange(!checked),
    style: {
      width: 18,
      height: 18,
      borderRadius: 4,
      flexShrink: 0,
      marginTop: 2,
      background: checked ? accent : 'transparent',
      border: `1.5px solid ${checked ? accent : _ChC.line2}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 120ms, border-color 120ms'
    }
  }, checked && React.createElement('svg', {
    width: 10,
    height: 10,
    viewBox: '0 0 24 24',
    fill: 'none'
  }, React.createElement('path', {
    d: 'M5 12l4 4L19 7',
    stroke: '#0a0805',
    strokeWidth: '3',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }))), React.createElement('div', null, label && React.createElement('div', {
    style: {
      fontSize: 14,
      fontFamily: _ChC.fb,
      color: _ChC.ink,
      lineHeight: 1.4
    }
  }, label), detail && React.createElement('div', {
    style: {
      fontSize: 12,
      fontFamily: _ChC.fb,
      color: _ChC.ink3,
      marginTop: 2,
      lineHeight: 1.5
    }
  }, detail)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
const _CT = {
  bg: '#0a0805',
  bg2: '#1a1612',
  ink2: '#9e9080',
  ink3: '#5a5048',
  line: 'rgba(255,255,255,.06)',
  line2: 'rgba(255,255,255,.12)',
  fm: "'JetBrains Mono',monospace"
};
function Chip({
  children,
  accent = '#ff5029',
  active = false,
  leading,
  onClick
}) {
  return React.createElement('button', {
    onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 12px',
      borderRadius: 9999,
      fontFamily: _CT.fm,
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      background: active ? `${accent}22` : _CT.line,
      color: active ? accent : _CT.ink2,
      border: `1px solid ${active ? accent + '44' : _CT.line2}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 150ms',
      whiteSpace: 'nowrap'
    }
  }, leading, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Dialog.jsx
try { (() => {
const _DC = {
  bg: '#100d09',
  ink: '#f0ebe5',
  ink3: '#5a5048',
  ac: '#ff5029',
  line: 'rgba(255,255,255,.06)',
  line2: 'rgba(255,255,255,.14)',
  fd: "'Syne',sans-serif",
  fb: "'DM Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace"
};
function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  width = 480
}) {
  if (!open) return null;
  return React.createElement(React.Fragment, null,
  // Backdrop
  React.createElement('div', {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(0,0,0,.65)',
      backdropFilter: 'blur(4px)',
      animation: 'ihype-fade-in 150ms ease both'
    }
  }),
  // Panel
  React.createElement('div', {
    style: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      zIndex: 201,
      width,
      maxWidth: 'calc(100vw - 32px)',
      background: _DC.bg,
      border: `1px solid ${_DC.line2}`,
      borderRadius: 16,
      boxShadow: '0 24px 64px rgba(0,0,0,.6)',
      overflow: 'hidden',
      animation: 'ihype-scale-in 180ms cubic-bezier(0.2,0.7,0.3,1) both',
      fontFamily: _DC.fb
    }
  },
  // Header
  React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '20px 22px 16px',
      borderBottom: `1px solid ${_DC.line}`
    }
  }, React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontFamily: _DC.fd,
      fontWeight: 800,
      fontSize: 17,
      letterSpacing: '-.01em',
      color: _DC.ink
    }
  }, title), description && React.createElement('div', {
    style: {
      fontSize: 13,
      color: _DC.ink3,
      marginTop: 4,
      lineHeight: 1.6
    }
  }, description)), onClose && React.createElement('button', {
    onClick: onClose,
    style: {
      width: 28,
      height: 28,
      borderRadius: 6,
      background: 'transparent',
      border: `1px solid ${_DC.line2}`,
      color: _DC.ink3,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, React.createElement('svg', {
    width: 12,
    height: 12,
    viewBox: '0 0 24 24',
    fill: 'none'
  }, React.createElement('path', {
    d: 'M6 6l12 12M18 6L6 18',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round'
  })))),
  // Body
  children && React.createElement('div', {
    style: {
      padding: '16px 22px 22px'
    }
  }, children)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function Eyebrow({
  children,
  color = '#5a5048'
}) {
  return React.createElement('div', {
    style: {
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 9,
      letterSpacing: '.18em',
      color,
      textTransform: 'uppercase',
      fontWeight: 600
    }
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
// iHYPE Icon — thin wrapper around Lucide icons via CDN
// Requires: <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"> in page head

const _IC = {
  color: '#f0ebe5'
};
function Icon({
  name,
  size = 16,
  color,
  strokeWidth = 1.6,
  style: s
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    if (typeof lucide === 'undefined') return;
    ref.current.innerHTML = '';
    const icon = lucide.icons[name];
    if (!icon) return;
    const [tag, attrs, children] = icon;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.entries({
      ...attrs,
      width: size,
      height: size,
      stroke: color || _IC.color,
      'stroke-width': strokeWidth
    }).forEach(([k, v]) => svg.setAttribute(k, v));
    children.forEach(([ct, ca]) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', ct);
      Object.entries(ca).forEach(([k, v]) => el.setAttribute(k, v));
      svg.appendChild(el);
    });
    ref.current.appendChild(svg);
  }, [name, size, color, strokeWidth]);
  return React.createElement('span', {
    ref,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...s
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
const _InT = {
  bg: '#100d09',
  bg2: '#1a1612',
  ink: '#f0ebe5',
  ink2: '#9e9080',
  ink3: '#5a5048',
  line: 'rgba(255,255,255,0.06)',
  line2: 'rgba(255,255,255,0.14)',
  accent: '#ff5029',
  fb: "'DM Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace"
};
function Input({
  label,
  placeholder = '',
  value,
  onChange,
  hint,
  leading,
  trailing,
  error,
  disabled = false,
  type = 'text'
}) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? _InT.accent : focused ? 'rgba(255,255,255,0.28)' : _InT.line2;
  const wrap = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    opacity: disabled ? 0.45 : 1
  };
  const inputRow = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: _InT.bg,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: '0 12px',
    height: 42,
    transition: 'border-color 150ms'
  };
  const inputStyle = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontFamily: _InT.fb,
    fontSize: 14,
    fontWeight: 400,
    color: _InT.ink,
    caretColor: _InT.accent
  };
  return React.createElement('div', {
    style: wrap
  }, label && React.createElement('div', {
    style: {
      fontFamily: _InT.fm,
      fontSize: 9,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: _InT.ink3
    }
  }, label), React.createElement('div', {
    style: inputRow
  }, leading && React.createElement('div', {
    style: {
      color: _InT.ink3,
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, leading), React.createElement('input', {
    type,
    placeholder,
    value,
    disabled,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      ...inputStyle,
      '::placeholder': {
        color: _InT.ink3
      }
    }
  }), trailing && React.createElement('div', {
    style: {
      color: _InT.ink3,
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, trailing)), (hint || error) && React.createElement('div', {
    style: {
      fontFamily: _InT.fb,
      fontSize: 12,
      color: error ? _InT.accent : _InT.ink3
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/ProgressBar.jsx
try { (() => {
const _PB = {
  bg: 'rgba(255,255,255,.06)',
  fb: "'DM Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
  ink3: '#5a5048'
};
function ProgressBar({
  value = 0,
  max = 100,
  accent = '#ff5029',
  height = 5,
  label,
  showValue,
  style: s
}) {
  const pct = Math.min(100, Math.max(0, value / max * 100));
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...s
    }
  }, (label || showValue) && React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, label && React.createElement('div', {
    style: {
      fontFamily: _PB.fm,
      fontSize: 9,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: _PB.ink3
    }
  }, label), showValue && React.createElement('div', {
    style: {
      fontFamily: _PB.fm,
      fontSize: 9,
      color: accent
    }
  }, `${Math.round(pct)}%`)), React.createElement('div', {
    style: {
      height,
      borderRadius: 99,
      background: _PB.bg,
      overflow: 'hidden'
    }
  }, React.createElement('div', {
    style: {
      height: '100%',
      width: `${pct}%`,
      background: accent,
      borderRadius: 99,
      transition: 'width 400ms cubic-bezier(0.2,0.7,0.3,1)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/core/Radio.jsx
try { (() => {
const _RC = {
  ac: '#ff5029',
  ink: '#f0ebe5',
  ink3: '#5a5048',
  line2: 'rgba(255,255,255,.14)',
  fb: "'DM Sans',system-ui,sans-serif"
};
function Radio({
  options = [],
  value,
  onChange,
  accent = '#ff5029'
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, options.map((o, i) => {
    const v = o.value ?? o,
      lbl = o.label ?? o,
      active = v === value;
    return React.createElement('label', {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer'
      }
    }, React.createElement('div', {
      onClick: () => onChange && onChange(v),
      style: {
        width: 18,
        height: 18,
        borderRadius: '50%',
        flexShrink: 0,
        border: `1.5px solid ${active ? accent : _RC.line2}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 120ms'
      }
    }, active && React.createElement('div', {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: accent
      }
    })), React.createElement('span', {
      style: {
        fontSize: 14,
        fontFamily: _RC.fb,
        color: active ? _RC.ink : _RC.ink3
      }
    }, lbl));
  }));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Radio.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
const _SC = {
  bg: '#1a1612',
  bg2: '#100d09',
  ink: '#f0ebe5',
  ink2: '#9e9080',
  ink3: '#5a5048',
  ac: '#ff5029',
  line: 'rgba(255,255,255,.06)',
  line2: 'rgba(255,255,255,.14)',
  fm: "'JetBrains Mono',monospace",
  fb: "'DM Sans',system-ui,sans-serif"
};
function Select({
  label,
  options = [],
  value,
  onChange,
  error,
  hint,
  style: s
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const sel = options.find(o => (o.value ?? o) === value);
  const display = sel ? sel.label ?? sel : '';
  React.useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const chevron = React.createElement('svg', {
    width: 12,
    height: 12,
    viewBox: '0 0 24 24',
    fill: 'none',
    style: {
      transition: 'transform 150ms',
      transform: open ? 'rotate(180deg)' : 'none',
      flexShrink: 0
    }
  }, React.createElement('path', {
    d: 'M6 9l6 6 6-6',
    stroke: error ? _SC.ac : _SC.ink3,
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }));
  return React.createElement('div', {
    ref,
    style: {
      fontFamily: _SC.fb,
      position: 'relative',
      ...s
    }
  }, label && React.createElement('div', {
    style: {
      fontFamily: _SC.fm,
      fontSize: 9,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: error ? _SC.ac : _SC.ink3,
      marginBottom: 6
    }
  }, label), React.createElement('button', {
    type: 'button',
    onClick: () => setOpen(p => !p),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 40,
      padding: '0 12px',
      background: _SC.bg,
      border: `1px solid ${error ? _SC.ac + '88' : open ? _SC.line2 : _SC.line}`,
      borderRadius: 8,
      color: display ? _SC.ink : _SC.ink3,
      fontSize: 14,
      cursor: 'pointer',
      transition: 'border-color 120ms'
    }
  }, React.createElement('span', {
    style: {
      flex: 1,
      textAlign: 'left',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, display || 'Select…'), chevron), open && React.createElement('div', {
    style: {
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 0,
      right: 0,
      zIndex: 99,
      background: _SC.bg2,
      border: `1px solid ${_SC.line2}`,
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      animation: 'ihype-scale-in 120ms ease both'
    }
  }, options.map((o, i) => {
    const v = o.value ?? o,
      lbl = o.label ?? o,
      active = v === value;
    return React.createElement('button', {
      key: i,
      type: 'button',
      onClick: () => {
        onChange && onChange(v);
        setOpen(false);
      },
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
        background: active ? `${_SC.ac}18` : 'transparent',
        border: 'none',
        borderBottom: i < options.length - 1 ? `1px solid ${_SC.line}` : 'none',
        color: active ? _SC.ac : _SC.ink,
        fontSize: 14,
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, active && React.createElement('svg', {
      width: 10,
      height: 10,
      viewBox: '0 0 24 24',
      fill: 'none'
    }, React.createElement('path', {
      d: 'M5 12l4 4L19 7',
      stroke: _SC.ac,
      strokeWidth: '2.5',
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    })), !active && React.createElement('span', {
      style: {
        width: 10
      }
    }), lbl);
  })), (hint || error) && React.createElement('div', {
    style: {
      fontFamily: _SC.fm,
      fontSize: 9,
      letterSpacing: '.08em',
      color: error ? _SC.ac : _SC.ink3,
      marginTop: 5
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Skeleton.jsx
try { (() => {
const _SK = {
  bg: '#1a1612',
  shimmer: 'rgba(255,255,255,.04)'
};
function Skeleton({
  width = '100%',
  height = 16,
  radius = 6,
  style: s
}) {
  return React.createElement('div', {
    style: {
      width,
      height,
      borderRadius: radius,
      background: `linear-gradient(90deg, ${_SK.bg} 25%, ${_SK.shimmer} 50%, ${_SK.bg} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'ihype-shimmer 1.6s ease-in-out infinite',
      flexShrink: 0,
      ...s
    }
  });
}

// Compound: SkeletonText — a block of n lines
function SkeletonText({
  lines = 3,
  lastWidth = '60%',
  style: s
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...s
    }
  }, Array.from({
    length: lines
  }, (_, i) => React.createElement(Skeleton, {
    key: i,
    width: i === lines - 1 ? lastWidth : '100%',
    height: 12
  })));
}
Object.assign(__ds_scope, { Skeleton, SkeletonText });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
const _TabT = {
  fb: "'DM Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
  fd: "'Syne',sans-serif",
  ink: '#f0ebe5',
  ink3: '#5a5048',
  line: 'rgba(255,255,255,.06)'
};
function Tabs({
  tabs = [],
  active,
  onChange,
  accent = '#ff5029'
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      borderBottom: `1px solid ${_TabT.line}`
    }
  }, tabs.map(({
    id,
    label,
    count
  }) => {
    const on = id === active;
    return React.createElement('button', {
      key: id,
      onClick: () => onChange && onChange(id),
      style: {
        padding: '10px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${on ? accent : 'transparent'}`,
        marginBottom: -1,
        cursor: 'pointer',
        transition: 'color 120ms, border-color 120ms',
        fontFamily: _TabT.fm,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: on ? _TabT.ink : _TabT.ink3,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, label, count !== undefined && React.createElement('span', {
      style: {
        fontFamily: _TabT.fd,
        fontWeight: 800,
        fontSize: 10,
        color: on ? accent : _TabT.ink3
      }
    }, count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/core/Toast.jsx
try { (() => {
const _TstC = {
  success: '#22e5d4',
  warn: '#ffb84a',
  error: '#ff5029',
  info: '#7fb3ff'
};
const _icon = (paths, vb = '0 0 24 24') => React.createElement('svg', {
  width: 14,
  height: 14,
  viewBox: vb,
  fill: 'none'
}, ...paths);
const _TstI = {
  success: _icon([React.createElement('path', {
    key: 0,
    d: 'M5 12l4 4L19 7',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  })]),
  warn: _icon([React.createElement('path', {
    key: 0,
    d: 'M12 9v4M12 17h.01M10.3 3.6L2.6 18a1 1 0 00.87 1.5h17.1a1 1 0 00.87-1.5L13.7 3.6a1 1 0 00-1.74 0z',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round'
  })]),
  error: _icon([React.createElement('path', {
    key: 0,
    d: 'M6 6l12 12M18 6L6 18',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round'
  })]),
  info: _icon([React.createElement('circle', {
    key: 0,
    cx: '12',
    cy: '12',
    r: '9',
    stroke: 'currentColor',
    strokeWidth: '1.6'
  }), React.createElement('path', {
    key: 1,
    d: 'M12 11v5M12 8h.01',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round'
  })])
};
function Toast({
  message,
  detail,
  variant = 'info',
  onClose
}) {
  const c = _TstC[variant] || _TstC.info;
  const icon = _TstI[variant] || _TstI.info;
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '12px 14px 12px 12px',
      borderRadius: 10,
      background: '#100d09',
      border: '1px solid rgba(255,255,255,.1)',
      boxShadow: `0 8px 32px rgba(0,0,0,.4), 0 0 0 1px ${c}18`,
      minWidth: 280,
      maxWidth: 380,
      fontFamily: "'DM Sans',system-ui,sans-serif"
    }
  }, React.createElement('div', {
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      background: `${c}20`,
      color: c,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1
    }
  }, icon), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement('div', {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: '#f0ebe5',
      lineHeight: 1.3
    }
  }, message), detail && React.createElement('div', {
    style: {
      fontSize: 12,
      color: '#9e9080',
      marginTop: 3,
      lineHeight: 1.5
    }
  }, detail)), onClose && React.createElement('button', {
    onClick: onClose,
    style: {
      background: 'transparent',
      border: 'none',
      color: '#5a5048',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      flexShrink: 0,
      marginTop: 2
    }
  }, _icon([React.createElement('path', {
    key: 0,
    d: 'M6 6l12 12M18 6L6 18',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round'
  })])));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toast.jsx", error: String((e && e.message) || e) }); }

// components/core/Toggle.jsx
try { (() => {
function Toggle({
  on = false,
  label,
  detail,
  onChange
}) {
  const trackStyle = {
    width: 44,
    height: 26,
    borderRadius: 13,
    flexShrink: 0,
    background: on ? '#ff5029' : 'rgba(255,255,255,0.12)',
    position: 'relative',
    transition: 'background 180ms',
    cursor: 'pointer'
  };
  const thumbStyle = {
    position: 'absolute',
    top: 3,
    left: on ? 21 : 3,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#f0ebe5',
    transition: 'left 180ms cubic-bezier(0.2,0.7,0.3,1)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
  };
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontFamily: "'DM Sans',system-ui,sans-serif"
  };
  return React.createElement('div', {
    style: rowStyle,
    onClick: () => onChange && onChange(!on)
  }, React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontSize: 14,
      color: '#f0ebe5',
      fontWeight: 500
    }
  }, label), detail && React.createElement('div', {
    style: {
      fontSize: 11,
      color: '#5a5048',
      marginTop: 3
    }
  }, detail)), React.createElement('div', {
    style: trackStyle
  }, React.createElement('div', {
    style: thumbStyle
  })));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toggle.jsx", error: String((e && e.message) || e) }); }

// engineering/sw.js
try { (() => {
/**
 * iHYPE Service Worker — sw.js
 * Precaches the app shell + offline fallback.
 * Serves stale-while-revalidate for feed requests.
 *
 * Registration: add to index.html (or any entry point):
 *   <script>
 *     if ('serviceWorker' in navigator) {
 *       navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(console.warn);
 *     }
 *   </script>
 */

const VERSION = 'ihype-v1';

// App shell — precache on install
const PRECACHE = ['/', '/offline.html', '/styles.css', '/lib/api.js', '/lib/db.js', '/ui_kits/fan-app/index.html', '/ui_kits/fan-app/data.js', '/assets/logo/favicon.svg'];

// Network-first routes (always try network; fallback to cache)
const NETWORK_FIRST = ['/v1/feed/', '/v1/events', '/v1/charts/'];

// Cache-first routes (serve from cache; revalidate in bg)
const CACHE_FIRST = ['/styles.css', '/lib/', '/assets/', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/* ── Install: precache app shell ──────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

/* ── Activate: clear old caches ───────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* ── Fetch: routing strategy ──────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const {
    request
  } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Network-first (API feeds)
  if (NETWORK_FIRST.some(p => url.pathname.startsWith(p))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first (static assets, fonts)
  if (CACHE_FIRST.some(p => url.pathname.startsWith(p) || url.hostname.includes(p))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stale-while-revalidate (HTML pages)
  event.respondWith(staleWhileRevalidate(request));
});

/* ── Strategy helpers ─────────────────────────────────────────────── */
async function networkFirst(request) {
  try {
    const res = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put(request, res.clone());
    return res;
  } catch {
    return caches.match('/offline.html');
  }
}
async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(res => {
    cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || networkPromise || caches.match('/offline.html');
}

/* ── Push notifications ────────────────────────────────────────────── */
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(data.title || 'iHYPE', {
    body: data.body || '',
    icon: '/assets/logo/favicon.svg',
    badge: '/assets/logo/favicon.svg',
    data: data,
    vibrate: [100, 50, 100]
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({
    type: 'window'
  }).then(wins => {
    if (wins.length > 0) {
      wins[0].focus();
      return;
    }
    clients.openWindow('/ui_kits/fan-app/index.html');
  }));
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "engineering/sw.js", error: String((e && e.message) || e) }); }

// lib/api.js
try { (() => {
/**
 * iHYPE API Client — lib/api.js
 * Works in two modes:
 *   MOCK  — no backend needed; uses window.IHYPE_DATA + localStorage (default in beta)
 *   REAL  — set window.IHYPE_API_BASE = 'https://api.ihype.app/v1' before loading
 *
 * Usage (after loading this script):
 *   const api = window.IHYPE_API;
 *   const { jwt, user } = await api.auth.verify(token);
 *   const events        = await api.feed.events({ city:'LA' });
 *   await api.hype.send('artist', artistId);
 *
 * All methods return plain objects or throw { status, message }.
 * In MOCK mode, network latency is simulated (~120ms).
 */

(function () {
  'use strict';

  /* ── config ──────────────────────────────────────────────────────── */
  const BASE = () => window.IHYPE_API_BASE || null; // null = mock mode
  const MOCK = () => !BASE();
  const DELAY = (ms = 120) => new Promise(r => setTimeout(r, ms));
  const BETA_CODES = ['IHYPE', 'HYPE2026', 'BETA', 'LISTEN'];

  /* ── JWT store ───────────────────────────────────────────────────── */
  const Token = {
    get: () => {
      try {
        return localStorage.getItem('ihype_jwt');
      } catch {
        return null;
      }
    },
    set: t => {
      try {
        localStorage.setItem('ihype_jwt', t);
      } catch {}
    },
    clear: () => {
      try {
        localStorage.removeItem('ihype_jwt');
      } catch {}
    }
  };

  /* ── base fetch ──────────────────────────────────────────────────── */
  async function req(method, path, body) {
    if (MOCK()) throw new Error('req() called in mock mode — this is a bug');
    const headers = {
      'Content-Type': 'application/json'
    };
    const jwt = Token.get();
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    const res = await fetch(BASE() + path, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw {
      status: res.status,
      message: json.message || res.statusText
    };
    return json;
  }
  const GET = path => req('GET', path);
  const POST = (path, body) => req('POST', path, body);
  const DELETE = path => req('DELETE', path);

  /* ── mock helpers ────────────────────────────────────────────────── */
  function mockUser(prefs) {
    return {
      id: 'u_' + Math.random().toString(36).slice(2, 8),
      handle: prefs?.handle || 'demo_user',
      display_name: prefs?.displayName || 'Demo User',
      email: prefs?.email || 'demo@ihype.app',
      city: prefs?.city || 'Los Angeles',
      genres: prefs?.genres || ['dream-pop', 'lo-fi', 'electronic'],
      roles: [prefs?.role || 'fan'],
      verified: false
    };
  }
  function mockJWT() {
    return 'mock_jwt_' + Date.now();
  }
  function getPrefs() {
    try {
      return JSON.parse(localStorage.getItem('ihype_onboarded_v2'));
    } catch {
      return null;
    }
  }
  function D() {
    return window.IHYPE_DATA || {};
  }

  /* ══════════════════════════════════════════════════════════════════
     AUTH
  ══════════════════════════════════════════════════════════════════ */
  const auth = {
    /** Send magic-link email */
    async sendMagicLink(email) {
      if (MOCK()) {
        await DELAY();
        return null;
      }
      return POST('/auth/magic-link', {
        email
      });
    },
    /** Exchange token → JWT + user */
    async verify(token) {
      if (MOCK()) {
        await DELAY();
        const prefs = getPrefs();
        const user = mockUser(prefs);
        const jwt = mockJWT();
        Token.set(jwt);
        window.IHYPE_USER_PREFS = prefs || {};
        return {
          jwt,
          user
        };
      }
      const data = await POST('/auth/verify', {
        token
      });
      Token.set(data.jwt);
      return data;
    },
    /** Redeem closed-beta invite code */
    async betaRedeem(code) {
      if (MOCK()) {
        await DELAY(80);
        if (BETA_CODES.includes(code.trim().toUpperCase())) {
          localStorage.setItem('ihype_beta_ok', '1');
          window.track && window.track('beta_gate_pass', {
            code
          });
          return null; // 204 ok
        }
        throw {
          status: 403,
          message: 'Invalid invite code'
        };
      }
      return POST('/auth/beta-redeem', {
        code
      });
    },
    /** Join public waitlist (no auth required) */
    async joinWaitlist(email, role = 'fan') {
      if (MOCK()) {
        await DELAY(200);
        const wl = JSON.parse(localStorage.getItem('ihype_waitlist') || '[]');
        if (!wl.find(e => e.email === email)) {
          wl.push({
            email,
            role,
            ts: Date.now()
          });
          localStorage.setItem('ihype_waitlist', JSON.stringify(wl));
        }
        window.track && window.track('waitlist_join', {
          email,
          role
        });
        return null;
      }
      // In production: POST /v1/waitlist (not in OpenAPI yet — engineering to add)
      return POST('/waitlist', {
        email,
        role
      });
    },
    /** Artist application */
    async artistApply(fields) {
      if (MOCK()) {
        await DELAY(200);
        const apps = JSON.parse(localStorage.getItem('ihype_artist_apps') || '[]');
        apps.push({
          ...fields,
          ts: Date.now()
        });
        localStorage.setItem('ihype_artist_apps', JSON.stringify(apps));
        window.track && window.track('artist_apply', fields);
        return null;
      }
      return POST('/artist-apply', fields);
    },
    logout() {
      Token.clear();
      window.IHYPE_USER_PREFS = null;
    },
    get isAuthed() {
      return !!Token.get();
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     FEED / DISCOVERY
  ══════════════════════════════════════════════════════════════════ */
  const feed = {
    async listen({
      city,
      genres
    } = {}) {
      if (MOCK()) {
        await DELAY();
        let artists = D().artists || [];
        if (genres?.length) artists = artists.filter(a => a.genres?.some(g => genres.includes(g)));
        if (city) artists = artists.filter(a => !a.city || a.city === city).concat(artists.filter(a => a.city && a.city !== city));
        return {
          artists
        };
      }
      return GET(`/feed/listen?city=${city || ''}&genres=${(genres || []).join(',')}`);
    },
    async events({
      city,
      scope = 'local'
    } = {}) {
      if (MOCK()) {
        await DELAY();
        let evts = D().events || [];
        if (city) evts = evts.filter(e => !e.city || e.city === city);
        return {
          events: evts
        };
      }
      return GET(`/feed/events?city=${city || ''}&scope=${scope}`);
    },
    async search(q) {
      if (MOCK()) {
        await DELAY(80);
        const qq = q.toLowerCase();
        const D_ = D();
        return {
          artists: (D_.artists || []).filter(a => a.name?.toLowerCase().includes(qq)),
          events: (D_.events || []).filter(e => e.title?.toLowerCase().includes(qq)),
          tracks: (D_.tracks || []).filter(t => t.title?.toLowerCase().includes(qq)),
          venues: []
        };
      }
      return GET(`/search?q=${encodeURIComponent(q)}`);
    },
    async hypeChart({
      window: w = 'week'
    } = {}) {
      if (MOCK()) {
        await DELAY();
        const artists = D().artists || [];
        return {
          artists: [...artists].sort((a, b) => (b.hype || 0) - (a.hype || 0))
        };
      }
      return GET(`/charts/hype?window=${w}`);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     HYPE
  ══════════════════════════════════════════════════════════════════ */
  const hype = {
    /** Get remaining weekly budget */
    async budget() {
      if (MOCK()) {
        await DELAY(60);
        const spent = parseInt(localStorage.getItem('ihype_hypes_spent') || '0');
        const cap = 50;
        return {
          left: Math.max(0, cap - spent),
          resets_at: _nextMonday()
        };
      }
      return GET('/hype/budget');
    },
    /** Send a hype */
    async send(target_type, target_id) {
      if (MOCK()) {
        await DELAY(80);
        const spent = parseInt(localStorage.getItem('ihype_hypes_spent') || '0');
        if (spent >= 50) throw {
          status: 429,
          message: 'Weekly hype budget exhausted'
        };
        localStorage.setItem('ihype_hypes_spent', spent + 1);
        window.track && window.track('hype', {
          target_type,
          target_id
        });
        return {
          hypes_left: 49 - spent
        };
      }
      return POST('/hype', {
        target_type,
        target_id
      });
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     EVENTS & TICKETING
  ══════════════════════════════════════════════════════════════════ */
  const ticketing = {
    async getEvent(id) {
      if (MOCK()) {
        await DELAY();
        const ev = (D().events || []).find(e => e.id === id);
        if (!ev) throw {
          status: 404,
          message: 'Event not found'
        };
        return ev;
      }
      return GET(`/events/${id}`);
    },
    async availability(eventId) {
      if (MOCK()) {
        await DELAY(60);
        return {
          remaining: 48,
          waitlist: false
        };
      }
      return GET(`/events/${eventId}/tickets/availability`);
    },
    /** Buy ticket — MOCK: creates a local record (simulated). Real: banking-gated. */
    async buyTicket(event_id, referral_code = null) {
      if (MOCK()) {
        await DELAY(400);
        const tickets = JSON.parse(localStorage.getItem('ihype_tickets') || '[]');
        const ticket = {
          id: 'tk_' + Math.random().toString(36).slice(2, 10),
          event_id,
          referral_code,
          status: 'valid',
          qr_token: Math.random().toString(36).slice(2, 18),
          created_at: new Date().toISOString(),
          _simulated: true
        };
        tickets.push(ticket);
        localStorage.setItem('ihype_tickets', JSON.stringify(tickets));
        window.track && window.track('ticket_purchase', {
          event_id,
          referral_code,
          _simulated: true
        });
        return ticket;
      }
      // Real: POST /tickets → Stripe payment intent
      return POST('/tickets', {
        event_id,
        referral_code
      });
    },
    async myTickets() {
      if (MOCK()) {
        await DELAY();
        const tickets = JSON.parse(localStorage.getItem('ihype_tickets') || '[]');
        return {
          tickets
        };
      }
      return GET('/me/tickets');
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     REFERRALS
  ══════════════════════════════════════════════════════════════════ */
  const referrals = {
    async create(event_id) {
      if (MOCK()) {
        await DELAY();
        const prefs = getPrefs() || {};
        const code = (prefs.handle || 'demo') + '-' + event_id.slice(-4) + '-' + Math.random().toString(36).slice(2, 6);
        const url = `https://ihype.app/e/${event_id}?ref=${code}`;
        window.track && window.track('referral_create', {
          event_id,
          code
        });
        return {
          code,
          share_url: url
        };
      }
      return POST('/referrals', {
        event_id
      });
    },
    async myEarnings() {
      if (MOCK()) {
        await DELAY();
        return {
          referrals: [{
            code: 'demo-nyla-x7k2',
            event: 'Nyla — Glasslight Tour',
            status: 'accruing',
            gross_driven_cents: 5600,
            earned_cents: 252
          }, {
            code: 'demo-echo-k9p1',
            event: 'Midnight Echo Live',
            status: 'locked',
            gross_driven_cents: 2200,
            earned_cents: 99
          }],
          total_earned_cents: 351,
          pending_cents: 252,
          cleared_cents: 99
        };
      }
      return GET('/me/referrals');
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     RADIO STUDIO
  ══════════════════════════════════════════════════════════════════ */
  const studio = {
    async library({
      free_use = true
    } = {}) {
      if (MOCK()) {
        await DELAY();
        const tracks = (D().tracks || []).filter(t => !free_use || t.license === 'free_use_limited');
        return {
          tracks
        };
      }
      return GET(`/library?free_use=${free_use}`);
    },
    async addToCrate(track_id) {
      if (MOCK()) {
        await DELAY(80);
        const crate = JSON.parse(localStorage.getItem('ihype_crate') || '[]');
        if (!crate.includes(track_id)) crate.push(track_id);
        localStorage.setItem('ihype_crate', JSON.stringify(crate));
        return null;
      }
      return POST('/crate', {
        track_id
      });
    },
    async sfx() {
      if (MOCK()) {
        await DELAY();
        return {
          sfx: D().sfx || []
        };
      }
      return GET('/sfx');
    },
    async saveShow(show) {
      if (MOCK()) {
        await DELAY(200);
        const shows = JSON.parse(localStorage.getItem('ihype_shows') || '[]');
        const id = show.id || 'rs_' + Date.now();
        const idx = shows.findIndex(s => s.id === id);
        if (idx >= 0) shows[idx] = {
          ...show,
          id
        };else shows.push({
          ...show,
          id
        });
        localStorage.setItem('ihype_shows', JSON.stringify(shows));
        return {
          id
        };
      }
      return POST('/radio-shows', show);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     TELEMETRY
  ══════════════════════════════════════════════════════════════════ */
  const telemetry = {
    async track(event, props = {}) {
      // Fire-and-forget — never await in hot paths
      if (MOCK()) {
        try {
          const log = JSON.parse(localStorage.getItem('ihype_track_log') || '[]');
          log.push({
            event,
            props,
            ts: Date.now()
          });
          if (log.length > 200) log.splice(0, log.length - 200);
          localStorage.setItem('ihype_track_log', JSON.stringify(log));
        } catch {}
        return;
      }
      fetch(BASE() + '/events/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event,
          props
        }),
        keepalive: true
      }).catch(() => {});
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     PAYOUTS  (banking-gated — all mock until nonprofit status clears)
  ══════════════════════════════════════════════════════════════════ */
  const payouts = {
    async balance() {
      if (MOCK()) {
        await DELAY();
        return {
          available: 0,
          pending: 351,
          _banking_gated: true
        };
      }
      return GET('/me/balance');
    },
    async requestPayout(amount_cents) {
      throw {
        status: 503,
        message: '⚠ Payouts are banking-gated — live once nonprofit status clears.',
        _banking_gated: true
      };
    }
  };

  /* ── helpers ─────────────────────────────────────────────────────── */
  function _nextMonday() {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  /* ── public API ──────────────────────────────────────────────────── */
  const IHYPE_API = {
    auth,
    feed,
    hype,
    ticketing,
    referrals,
    studio,
    telemetry,
    payouts,
    get isMock() {
      return MOCK();
    },
    get base() {
      return BASE();
    },
    /** Set real API base — call before using real mode */
    setBase(url) {
      window.IHYPE_API_BASE = url;
    }
  };
  window.IHYPE_API = IHYPE_API;

  // Override the global track() stub to go through the API
  window.track = (event, props) => telemetry.track(event, props);
  if (MOCK()) {
    console.info('[iHYPE API] Running in MOCK mode. Set window.IHYPE_API_BASE to switch to real mode.');
  } else {
    console.info('[iHYPE API] Running against', BASE());
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "lib/api.js", error: String((e && e.message) || e) }); }

// lib/db.js
try { (() => {
/**
 * iHYPE DB — lib/db.js
 * IndexedDB-backed offline store with localStorage fallback.
 *
 * Stores:
 *   users      — cached user profiles
 *   events     — cached event records
 *   tickets    — user's ticket wallet (offline-readable)
 *   tracks     — free-use library cache
 *   feed_cache — listen / events feed snapshots
 *   kv         — generic key-value (prefs, flags, etc.)
 *
 * Usage:
 *   await db.tickets.getAll()
 *   await db.tickets.put(ticket)
 *   await db.kv.set('last_city', 'Los Angeles')
 *   await db.kv.get('last_city')
 *   await db.clear()  // full wipe (used by Settings → Reset)
 */

(function () {
  'use strict';

  const DB_NAME = 'ihype_db';
  const DB_VERSION = 1;
  const STORES = ['users', 'events', 'tickets', 'tracks', 'feed_cache', 'kv'];

  /* ── open / upgrade ──────────────────────────────────────────────── */
  let _db = null;
  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, {
              keyPath: 'id'
            });
          }
        }
      };
      req.onsuccess = e => {
        _db = e.target.result;
        resolve(_db);
      };
      req.onerror = e => reject(e.target.error);
    });
  }

  /* ── IDB transaction helpers ─────────────────────────────────────── */
  async function tx(storeName, mode, fn) {
    try {
      const db = await openDB();
      const t = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = fn(store);
        if (req && typeof req.onsuccess !== 'undefined') {
          req.onsuccess = e => resolve(e.target.result);
          req.onerror = e => reject(e.target.error);
        } else {
          t.oncomplete = () => resolve(req);
          t.onerror = e => reject(e.target.error);
        }
      });
    } catch (e) {
      // Fallback: IndexedDB unavailable — use localStorage
      return lsFallback(storeName, mode, fn);
    }
  }
  async function getAll(storeName) {
    try {
      const db = await openDB();
      const t = db.transaction(storeName, 'readonly');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
      });
    } catch {
      try {
        return Object.values(JSON.parse(localStorage.getItem('idb_' + storeName) || '{}'));
      } catch {
        return [];
      }
    }
  }
  async function getOne(storeName, id) {
    try {
      const db = await openDB();
      const t = db.transaction(storeName, 'readonly');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror = e => reject(e.target.error);
      });
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('idb_' + storeName) || '{}');
        return all[id] || null;
      } catch {
        return null;
      }
    }
  }
  async function putOne(storeName, record) {
    if (!record || !record.id) throw new Error('putOne: record must have an id');
    try {
      const db = await openDB();
      const t = db.transaction(storeName, 'readwrite');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
      });
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('idb_' + storeName) || '{}');
        all[record.id] = record;
        localStorage.setItem('idb_' + storeName, JSON.stringify(all));
        return record.id;
      } catch {}
    }
  }
  async function deleteOne(storeName, id) {
    try {
      const db = await openDB();
      const t = db.transaction(storeName, 'readwrite');
      const store = t.objectStore(storeName);
      return await new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = e => reject(e.target.error);
      });
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('idb_' + storeName) || '{}');
        delete all[id];
        localStorage.setItem('idb_' + storeName, JSON.stringify(all));
      } catch {}
    }
  }

  /* ── localStorage fallback ───────────────────────────────────────── */
  function lsFallback(storeName) {
    try {
      return Object.values(JSON.parse(localStorage.getItem('idb_' + storeName) || '{}'));
    } catch {
      return [];
    }
  }

  /* ── store API factory ───────────────────────────────────────────── */
  function makeStore(name) {
    return {
      getAll: () => getAll(name),
      get: id => getOne(name, id),
      put: record => putOne(name, record),
      delete: id => deleteOne(name, id),
      /** Upsert many records */
      putMany: async records => {
        for (const r of records) await putOne(name, r);
      },
      /** Replace entire store */
      replaceAll: async records => {
        // Clear then put all
        const db = await openDB().catch(() => null);
        if (db) {
          const t = db.transaction(name, 'readwrite');
          const store = t.objectStore(name);
          await new Promise((res, rej) => {
            const r = store.clear();
            r.onsuccess = res;
            r.onerror = rej;
          });
        } else {
          localStorage.setItem('idb_' + name, '{}');
        }
        for (const r of records) await putOne(name, r);
      }
    };
  }

  /* ── kv store (no keyPath — wrap with synthetic id) ─────────────── */
  const kv = {
    async get(key) {
      const rec = await getOne('kv', key);
      return rec ? rec.value : null;
    },
    async set(key, value) {
      return putOne('kv', {
        id: key,
        value,
        updated: Date.now()
      });
    },
    async delete(key) {
      return deleteOne('kv', key);
    }
  };

  /* ── feed cache helpers ──────────────────────────────────────────── */
  const feedCache = {
    async set(key, data, ttlMs = 5 * 60 * 1000) {
      return putOne('feed_cache', {
        id: key,
        data,
        expires: Date.now() + ttlMs
      });
    },
    async get(key) {
      const rec = await getOne('feed_cache', key);
      if (!rec || Date.now() > rec.expires) return null;
      return rec.data;
    },
    async invalidate(key) {
      return deleteOne('feed_cache', key);
    }
  };

  /* ── full clear (Settings → Reset app data) ──────────────────────── */
  async function clearAll() {
    try {
      const db = await openDB();
      for (const name of STORES) {
        const t = db.transaction(name, 'readwrite');
        const s = t.objectStore(name);
        await new Promise((res, rej) => {
          const r = s.clear();
          r.onsuccess = res;
          r.onerror = rej;
        });
      }
    } catch {}
    // Also clear relevant localStorage keys
    const keep = []; // preserve nothing on full reset
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('ihype_') || key.startsWith('idb_')) {
        localStorage.removeItem(key);
      }
    }
  }

  /* ── snapshot: dump everything to a plain object (for debug) ──────── */
  async function snapshot() {
    const out = {};
    for (const name of STORES) {
      out[name] = await getAll(name);
    }
    return out;
  }

  /* ── public DB object ────────────────────────────────────────────── */
  window.IHYPE_DB = {
    users: makeStore('users'),
    events: makeStore('events'),
    tickets: makeStore('tickets'),
    tracks: makeStore('tracks'),
    feedCache,
    kv,
    clear: clearAll,
    snapshot,
    /** Seed the DB with IHYPE_DATA mock records (call once on first load) */
    async seedFromMockData() {
      const D = window.IHYPE_DATA;
      if (!D) return;
      if (D.artists) await makeStore('users').putMany(D.artists.map(a => ({
        id: a.id || a.name,
        ...a
      })));
      if (D.events) await makeStore('events').putMany(D.events.map(e => ({
        id: e.id || e.title,
        ...e
      })));
      if (D.tracks) await makeStore('tracks').putMany(D.tracks.map(t => ({
        id: t.id || t.title,
        ...t
      })));
      await kv.set('db_seeded', true);
    }
  };
  console.info('[iHYPE DB] IndexedDB store ready:', DB_NAME, 'v' + DB_VERSION);
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "lib/db.js", error: String((e && e.message) || e) }); }

// lib/hydrate.js
try { (() => {
/**
 * iHYPE Hydration Layer — lib/hydrate.js
 * Load AFTER lib/api.js and data.js.
 *
 * MOCK mode (default): does nothing — window.IHYPE_DATA from data.js stands.
 * REAL mode (window.IHYPE_API_BASE set): fetches live data via IHYPE_API,
 * maps API rows into the IHYPE_DATA shape the UI reads, then dispatches
 * 'ihype:data' so the shell re-renders. Components stay untouched.
 *
 * Also bridges WRITES: hype sends, ticket purchases, referral mints go
 * through IHYPE_API in real mode (fire-and-forget with optimistic UI).
 */
(function () {
  'use strict';

  const REAL = () => !!window.IHYPE_API_BASE;

  /* ── row mappers: API schema → IHYPE_DATA shape ─────────────────── */
  const mapEvent = e => ({
    id: e.id,
    artist: e.artist_name || e.artist_id,
    title: e.title,
    venue: e.venue_name || '',
    city: e.city,
    date: e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }) : '',
    price: Math.round((e.price_cents || 0) / 100),
    status: e.status === 'live' ? 'LIVE' : (e.status || '').toUpperCase(),
    tint: e.tint || '#ff5029'
  });
  const mapTrack = t => ({
    id: t.id,
    artist: t.artist_name || t.artist_id,
    track: t.title,
    dur: t.duration_s,
    tint: t.tint || '#ff3e9a',
    freeUse: !!t.free_use
  });
  async function hydrate() {
    if (!REAL()) return;
    const api = window.IHYPE_API;
    if (!api) return console.error('hydrate.js: IHYPE_API missing — load lib/api.js first');
    const D = window.IHYPE_DATA = window.IHYPE_DATA || {};
    const prefs = window.IHYPE_USER_PREFS || {};
    const results = await Promise.allSettled([api.feed.events({
      city: prefs.city,
      scope: 'local'
    }), api.feed.listen({
      city: prefs.city,
      genres: (prefs.genres || []).join(',')
    }), api.feed.hypeChart({
      window: 'week'
    }), api.studio.library({
      free_use: true
    }), api.ticketing.myTickets(), api.referrals.myEarnings()]);
    const [events, listen, chart, lib, tickets, refs] = results.map(r => r.status === 'fulfilled' ? r.value : null);
    if (events) D.shows = (events.events || events).map(mapEvent);
    if (listen) {
      if (listen.seeds) D.seeds = listen.seeds.map(mapTrack);
      if (listen.tracks) D.tracks = listen.tracks.map(mapTrack);
    }
    if (chart) D.demand = (chart.artists || chart).map(a => ({
      artist: a.display_name || a.handle,
      trend: a.trend || '+0%'
    }));
    if (lib) D.freeUseLibrary = (lib.tracks || lib).map(mapTrack);
    if (tickets) D.myTickets = tickets.tickets || tickets;
    if (refs) D.myReferrals = refs.referrals || refs;
    window.dispatchEvent(new CustomEvent('ihype:data'));
  }

  /* ── write bridges (optimistic; API call in real mode) ──────────── */
  const orig = {};
  function bridge(name, fn) {
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        return orig[name] ? wrap : undefined;
      },
      set(v) {
        orig[name] = v;
      }
    });
    const wrap = function () {
      const r = orig[name] && orig[name].apply(this, arguments);
      if (REAL()) {
        try {
          fn.apply(null, arguments);
        } catch (e) {
          console.warn('hydrate bridge', name, e);
        }
      }
      return r;
    };
  }
  // hype: components call window.IHYPE_SEND_HYPE(targetType, targetId) if defined
  window.IHYPE_SEND_HYPE = function (type, id) {
    if (REAL()) window.IHYPE_API.hype.send(type, id).catch(e => console.warn('hype sync failed', e));else window.IHYPE_API && window.IHYPE_API.hype.send(type, id).catch(() => {});
  };
  // purchase: components call window.IHYPE_PURCHASE(eventId, referralCode) if defined
  window.IHYPE_PURCHASE = function (eventId, code) {
    return window.IHYPE_API.ticketing.buyTicket(eventId, code);
  };
  void bridge; // reserved for wrapping legacy window.* handlers if needed

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate);else hydrate();
  window.IHYPE_HYDRATE = hydrate; // manual refresh: await IHYPE_HYDRATE()
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "lib/hydrate.js", error: String((e && e.message) || e) }); }

// sw.js
try { (() => {
/**
 * iHYPE Service Worker — sw.js
 * Precaches the app shell + offline fallback.
 * Serves stale-while-revalidate for feed requests.
 *
 * Registration: add to index.html (or any entry point):
 *   <script>
 *     if ('serviceWorker' in navigator) {
 *       navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(console.warn);
 *     }
 *   </script>
 */

const VERSION = 'ihype-v1';

// App shell — precache on install
const PRECACHE = ['/', '/offline.html', '/styles.css', '/lib/api.js', '/lib/db.js', '/ui_kits/fan-app/index.html', '/ui_kits/fan-app/data.js', '/assets/logo/favicon.svg'];

// Network-first routes (always try network; fallback to cache)
const NETWORK_FIRST = ['/v1/feed/', '/v1/events', '/v1/charts/'];

// Cache-first routes (serve from cache; revalidate in bg)
const CACHE_FIRST = ['/styles.css', '/lib/', '/assets/', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/* ── Install: precache app shell ──────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

/* ── Activate: clear old caches ───────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* ── Fetch: routing strategy ──────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const {
    request
  } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Network-first (API feeds)
  if (NETWORK_FIRST.some(p => url.pathname.startsWith(p))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first (static assets, fonts)
  if (CACHE_FIRST.some(p => url.pathname.startsWith(p) || url.hostname.includes(p))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stale-while-revalidate (HTML pages)
  event.respondWith(staleWhileRevalidate(request));
});

/* ── Strategy helpers ─────────────────────────────────────────────── */
async function networkFirst(request) {
  try {
    const res = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    const cache = await caches.open(VERSION);
    cache.put(request, res.clone());
    return res;
  } catch {
    return caches.match('/offline.html');
  }
}
async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(res => {
    cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || networkPromise || caches.match('/offline.html');
}

/* ── Push notifications ────────────────────────────────────────────── */
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(data.title || 'iHYPE', {
    body: data.body || '',
    icon: '/assets/logo/favicon.svg',
    badge: '/assets/logo/favicon.svg',
    data: data,
    vibrate: [100, 50, 100]
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({
    type: 'window'
  }).then(wins => {
    if (wins.length > 0) {
      wins[0].focus();
      return;
    }
    clients.openWindow('/ui_kits/fan-app/index.html');
  }));
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "sw.js", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/EventsTab.jsx
try { (() => {
// iHYPE Events Tab — My Tickets · Local · For You · Search

const VERIFIED_ARTISTS = new Set(['Midnight Echo', 'Nyla', 'DJ Caro', 'Wax Tropic', 'Cold Harbor']);
function VBadge() {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 13,
      height: 13,
      borderRadius: '50%',
      background: '#5b8cff',
      marginLeft: 3,
      flexShrink: 0,
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "8",
    viewBox: "0 0 10 10",
    fill: "none"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "2,5 4,7 8,3",
    stroke: "#fff",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
const DISTANCES = {
  s1: '0.4 mi',
  s2: '1.2 mi',
  s3: '1.8 mi',
  s4: '0.9 mi'
};
const SOLD_OUT = {
  s3: true
};
const GENRES_F = ['All', 'dream-pop', 'shoegaze', 'lo-fi', 'r&b', 'electronic', 'folk'];
function CheckoutSheet({
  show,
  onClose,
  onDone
}) {
  const [qty, setQty] = React.useState(1);
  if (!show) return null;
  const gross = (show.price * qty).toFixed(2);
  const tm = (show.price * 1.27 * qty).toFixed(2);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      letterSpacing: '-.03em',
      marginBottom: 4
    }
  }, show.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.75rem',
      color: 'var(--ink-3)',
      marginBottom: 18
    }
  }, show.venue, " \xB7 ", show.date), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
      gap: 2,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 45,
      background: '#ff5029',
      borderRadius: '999px 0 0 999px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 45,
      background: '#22e5d4'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 10,
      background: '#b983ff',
      borderRadius: '0 999px 999px 0'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 12px',
      borderRadius: 11,
      background: 'var(--bg-3)',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)'
    }
  }, "Ticketmaster: $", tm), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      color: '#22e5d4'
    }
  }, "You pay $", gross)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)'
    }
  }, "Qty"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setQty(q => Math.max(1, q - 1)),
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      cursor: 'pointer',
      fontSize: 18,
      display: 'grid',
      placeItems: 'center'
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      minWidth: 20,
      textAlign: 'center'
    }
  }, qty), /*#__PURE__*/React.createElement("button", {
    onClick: () => setQty(q => Math.min(4, q + 1)),
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      cursor: 'pointer',
      fontSize: 18,
      display: 'grid',
      placeItems: 'center'
    }
  }, "+"))), /*#__PURE__*/React.createElement("button", {
    onClick: onDone,
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(255,80,41,.3)'
    }
  }, "Pay $", gross, " \xB7 Apple Pay"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      color: 'var(--ink-3)',
      textAlign: 'center',
      marginTop: 8
    }
  }, "+ $0.00 fees \xB7 70% to artist \xB7 locked in charter"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.62rem',
      color: '#ffb84a',
      textAlign: 'center',
      marginTop: 6,
      opacity: .8
    }
  }, "\u26A0 Beta \u2014 simulated purchase, no real charge. By buying you agree to the ", /*#__PURE__*/React.createElement("a", {
    href: "https://ihype.app/terms",
    target: "_blank",
    style: {
      color: '#ffb84a'
    }
  }, "Terms"), ".")));
}
function FilterSheet({
  open,
  filter,
  onFilter,
  onClose
}) {
  const [maxPrice, setMaxPrice] = React.useState(50);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      background: 'rgba(0,0,0,.5)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 16
    }
  }, "Filter events"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Genre"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 16
    }
  }, GENRES_F.map(g => {
    const on = filter === g;
    return /*#__PURE__*/React.createElement("button", {
      key: g,
      onClick: () => onFilter(g),
      style: {
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.1)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--ink-2)',
        fontFamily: 'var(--f-m)',
        fontSize: '.78rem',
        fontWeight: on ? 700 : 500,
        cursor: 'pointer'
      }
    }, g);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Max price: $", maxPrice), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 5,
    max: 100,
    value: maxPrice,
    onChange: e => setMaxPrice(+e.target.value),
    style: {
      width: '100%',
      accentColor: 'var(--accent)',
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Apply filters")));
}

// Shared entrance animation
if (!document.getElementById('ihype-anim-css')) {
  const s = document.createElement('style');
  s.id = 'ihype-anim-css';
  s.textContent = '@keyframes fadeSlide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(s);
}
function Skeleton({
  h = 120
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      borderRadius: 18,
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      marginBottom: 12,
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes ihype-skeleton{0%,100%{opacity:.4}50%{opacity:.9}}'), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%)',
      animation: 'ihype-skeleton 1.4s ease-in-out infinite'
    }
  }));
}
function EventCard({
  s,
  onBuy,
  idx
}) {
  const [hyped, setHyped] = React.useState(false);
  const [tilted, setTilted] = React.useState(false);
  const [liveCount, setLiveCount] = React.useState(s.hype || 1284);
  React.useEffect(() => {
    if (s.status !== 'LIVE') return;
    const t = setInterval(() => setLiveCount(c => c + Math.floor(Math.random() * 3 + 1)), 2800);
    return () => clearInterval(t);
  }, [s.status]);
  return /*#__PURE__*/React.createElement("div", {
    onPointerDown: () => setTilted(true),
    onPointerUp: () => setTilted(false),
    onPointerLeave: () => setTilted(false),
    style: {
      borderRadius: 18,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      overflow: 'hidden',
      marginBottom: 12,
      transform: tilted ? 'perspective(600px) rotateX(2deg) scale(.985)' : 'perspective(600px) rotateX(0deg) scale(1)',
      transition: 'transform .15s ease',
      animation: `fadeSlide .3s ${(idx || 0) * .07}s both`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 100,
      background: `linear-gradient(135deg,${s.tint}44,${s.tint}11)`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at 30% 50%,${s.tint}44,transparent 60%)`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 10,
      left: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => {
      e.stopPropagation();
      const a = window.lookupArtist && window.lookupArtist(s.artist, s.tint);
      if (a) window.openIHYPEArtistProfile && window.openIHYPEArtistProfile(a);
    },
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      color: 'rgba(240,235,229,.95)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 2
    }
  }, s.artist, VERIFIED_ARTISTS.has(s.artist) && /*#__PURE__*/React.createElement(VBadge, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'rgba(240,235,229,.7)'
    }
  }, s.venue, " \xB7 ", s.city)), (() => {
    const d = window.IHYPE_DATA && window.IHYPE_DATA.demand && window.IHYPE_DATA.demand.find(d => d.artist === s.artist);
    return d ? /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 10,
        left: 12,
        fontFamily: 'var(--f-m)',
        fontSize: '.63rem',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: '#fff',
        background: 'rgba(0,0,0,.45)',
        border: `1px solid ${d.tint}55`,
        borderRadius: 999,
        padding: '3px 8px',
        backdropFilter: 'blur(4px)'
      }
    }, d.up, " this week") : null;
  })(), SOLD_OUT[s.id] && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(6,5,4,.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.75rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'rgba(240,235,229,.7)',
      padding: '5px 14px',
      borderRadius: 999,
      background: 'rgba(0,0,0,.5)',
      border: '1px solid rgba(255,255,255,.15)'
    }
  }, "Sold out")), s.status === 'LIVE' && !SOLD_OUT[s.id] && /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      window.openIHYPELiveEvent && window.openIHYPELiveEvent(s);
    },
    style: {
      position: 'absolute',
      top: 10,
      right: 12,
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: '#ff3c3c',
      background: 'rgba(255,60,60,.15)',
      border: '1px solid rgba(255,60,60,.3)',
      borderRadius: 999,
      padding: '3px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: '#ff3c3c'
    }
  }), liveCount.toLocaleString(), " live")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, s.date), DISTANCES[s.id] && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)',
      padding: '2px 7px',
      borderRadius: 999,
      border: '1px solid var(--line-2)',
      background: 'var(--bg-3)'
    }
  }, DISTANCES[s.id])), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem'
    }
  }, "$", s.price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: '#22e5d4'
    }
  }, "+ $0 fees"), (() => {
    const D = window.IHYPE_DATA;
    const dem = D && D.demand && D.demand.find(x => x.artist === s.artist);
    return dem ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.62rem',
        color: dem.tint,
        padding: '2px 7px',
        borderRadius: 999,
        border: `1px solid ${dem.tint}33`,
        background: `${dem.tint}0d`
      }
    }, dem.up) : null;
  })())), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setHyped(h => {
        navigator.vibrate && navigator.vibrate(hyped ? 10 : [20, 10, 20]);
        return !h;
      });
    },
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: `1px solid ${hyped ? 'var(--accent)' : 'var(--line)'}`,
      background: hyped ? 'rgba(255,80,41,.12)' : 'transparent',
      color: hyped ? 'var(--accent)' : 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 16,
      display: 'grid',
      placeItems: 'center'
    }
  }, hyped ? '🔥' : '☆'), /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      const url = 'https://ihype.app/e/' + s.id + '?ref=me';
      if (navigator.share) {
        try {
          await navigator.share({
            title: s.artist + ' @ ' + s.venue,
            text: 'Get tickets — no fees',
            url
          });
          return;
        } catch (e) {}
      }
      navigator.clipboard && navigator.clipboard.writeText(url);
    },
    title: "Share referral link",
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 6 12 2 8 6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "2",
    x2: "12",
    y2: "15"
  }))), SOLD_OUT[s.id] ? /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '8px 14px',
      borderRadius: 999,
      background: 'transparent',
      color: 'var(--ink-3)',
      border: '1px solid var(--line)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer'
    }
  }, "Join waitlist") : /*#__PURE__*/React.createElement("button", {
    onClick: () => onBuy && onBuy(s),
    style: {
      padding: '8px 18px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Get ticket")));
}
function MyTickets() {
  const D = window.IHYPE_DATA;
  const [tab2, setTab2] = React.useState('upcoming');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      marginBottom: 14,
      borderBottom: '1px solid var(--line)'
    }
  }, [['upcoming', 'Upcoming'], ['past', 'Past']].map(([id, lbl]) => {
    const on = tab2 === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => setTab2(id),
      style: {
        flex: 1,
        padding: '8px 4px 7px',
        border: 'none',
        borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent',
        background: 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.75rem',
        letterSpacing: '.04em',
        fontWeight: on ? 700 : 500,
        cursor: 'pointer'
      }
    }, lbl);
  })), D.fanReceipts.length === 0 && tab2 === 'upcoming' && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '3rem 1rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 12
    }
  }, "\uD83C\uDF9F"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      marginBottom: 8
    }
  }, "No upcoming shows"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)',
      marginBottom: 16
    }
  }, "Hype artists in Seeds to unlock early ticket access."), /*#__PURE__*/React.createElement("button", {
    onClick: onBrowse,
    style: {
      padding: '10px 22px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.85rem',
      cursor: 'pointer'
    }
  }, "Browse local events \u2192")), D.fanReceipts.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '3rem 1rem',
      gap: 14,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "48",
    height: "48",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--ink-3)",
    strokeWidth: "1.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem'
    }
  }, "No tickets yet."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      color: 'var(--ink-3)',
      lineHeight: 1.6,
      maxWidth: '28ch'
    }
  }, "Find a show you love, hype the artist, and buy direct \u2014 no fees."), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '9px 22px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.85rem',
      cursor: 'pointer'
    }
  }, "Browse events \u2192")), D.fanReceipts.map(r => {
    const isTonight = r.date.includes('May 30');
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      onClick: () => window.openIHYPETicketQR && window.openIHYPETicketQR(r),
      style: {
        padding: '1rem',
        borderRadius: 16,
        border: `1px solid ${isTonight ? r.tint + '55' : 'var(--line)'}`,
        background: `linear-gradient(135deg,${r.tint}0d,transparent)`,
        marginBottom: 10,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 11,
        background: `linear-gradient(135deg,${r.tint}88,${r.tint}22)`,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, isTonight && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.68rem',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: '#ff3c3c',
        marginBottom: 3
      }
    }, "\u25CF Tonight"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.95rem'
      }
    }, r.artist), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.75rem',
        color: 'var(--ink-3)',
        marginTop: 2
      }
    }, r.event, " \xB7 ", r.date.split(',')[0])), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.7rem',
        color: 'var(--ink-3)'
      }
    }, "\xD7", r.qty), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '1rem',
        color: 'var(--accent)'
      }
    }, "$", r.price))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => window.openIHYPETransfer && window.openIHYPETransfer(),
      style: {
        flex: 1,
        padding: '8px',
        borderRadius: 10,
        border: '1px solid var(--line)',
        background: 'transparent',
        color: 'var(--ink-2)',
        fontFamily: 'var(--f-m)',
        fontSize: '.75rem',
        cursor: 'pointer'
      }
    }, "Transfer \u2192"), /*#__PURE__*/React.createElement("button", {
      onClick: () => window.openIHYPEPostShow && window.openIHYPEPostShow({
        artist: r.artist,
        venue: r.event
      }),
      style: {
        flex: 1,
        padding: '8px',
        borderRadius: 10,
        border: '1px solid var(--line)',
        background: 'transparent',
        color: 'var(--ink-2)',
        fontFamily: 'var(--f-m)',
        fontSize: '.75rem',
        cursor: 'pointer'
      }
    }, "Rate show \u2605")));
  }));
}
function LocalEvents({
  onBuy,
  onFilterOpen,
  genreFilter
}) {
  const D = window.IHYPE_DATA;
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);
  const sorted = [...D.shows].sort((a, b) => a.date.localeCompare(b.date));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "Near Los Angeles", genreFilter !== 'All' ? ` · ${genreFilter}` : ''), /*#__PURE__*/React.createElement("button", {
    onClick: onFilterOpen,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 10px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "6",
    x2: "20",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "12",
    x2: "16",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "11",
    y1: "18",
    x2: "13",
    y2: "18"
  })), "Filter")), loading ? [0, 1, 2].map(i => /*#__PURE__*/React.createElement(Skeleton, {
    key: i,
    h: 160
  })) : sorted.map((s, i) => /*#__PURE__*/React.createElement(EventCard, {
    key: s.id,
    s: s,
    onBuy: onBuy,
    idx: i
  })));
}
function RecommendedEvents({
  onBuy
}) {
  const D = window.IHYPE_DATA;
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);
  const hypedArtists = new Set(D.seeds.map(s => s.artist));
  const prefs = (window.IHYPE_USER_PREFS || {}).genres || [];
  const allShows = D.shows.filter(s => !SOLD_OUT[s.id]);
  const rec = allShows.filter(s => hypedArtists.has(s.artist) || prefs.length > 0 && prefs.some(g => (s.genre || '').toLowerCase().includes(g.toLowerCase())));
  const rest = allShows.filter(s => !rec.includes(s));
  return /*#__PURE__*/React.createElement("div", null, loading ? [0, 1].map(i => /*#__PURE__*/React.createElement(Skeleton, {
    key: i,
    h: 160
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, rec.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--accent)',
      marginBottom: 12
    }
  }, "Artists you've hyped"), rec.map((s, i) => /*#__PURE__*/React.createElement(EventCard, {
    key: s.id,
    s: s,
    onBuy: onBuy,
    idx: i
  })), rest.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      margin: '16px 0 12px'
    }
  }, "You might also like"), rest.map((s, i) => /*#__PURE__*/React.createElement(EventCard, {
    key: s.id,
    s: s,
    onBuy: onBuy,
    idx: i + rec.length
  }))));
}
function EventSearch({
  onBuy
}) {
  const [q, setQ] = React.useState('');
  const D = window.IHYPE_DATA;
  const results = q ? D.shows.filter(s => (s.artist + s.venue + s.city).toLowerCase().includes(q.toLowerCase())) : D.shows;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search events, venues, artists\u2026",
    style: {
      width: '100%',
      padding: '10px 14px 10px 38px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem',
      outline: 'none',
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("svg", {
    style: {
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--ink-3)'
    },
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.35-4.35"
  }))), results.map(s => /*#__PURE__*/React.createElement(EventCard, {
    key: s.id,
    s: s,
    onBuy: onBuy
  })));
}
function EventsTab({
  onToast
}) {
  const [sub, setSub] = React.useState('local');
  const [checkout, setCheckout] = React.useState(null);
  const [ageGate, setAgeGate] = React.useState(null);
  const tryCheckout = s => s.ageReq ? setAgeGate(s) : setCheckout(s);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [genreFilter, setGenreFilter] = React.useState('All');
  const subs = [['tickets', 'Tickets'], ['local', 'Local'], ['foryou', 'For You'], ['search', 'Search']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      padding: '0 1.15rem',
      overflowX: 'auto',
      flexShrink: 0,
      borderBottom: '1px solid var(--line)'
    }
  }, subs.map(([id, label]) => {
    const on = sub === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => setSub(id),
      style: {
        flexShrink: 0,
        padding: '10px 14px 8px',
        borderRadius: 0,
        border: 'none',
        borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent',
        background: 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.75rem',
        letterSpacing: '.04em',
        fontWeight: on ? 700 : 500,
        cursor: 'pointer'
      }
    }, label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '1rem 1.15rem 1.5rem'
    }
  }, sub === 'tickets' && /*#__PURE__*/React.createElement(MyTickets, {
    onBrowse: () => setSub('local')
  }), sub === 'local' && /*#__PURE__*/React.createElement(LocalEvents, {
    onBuy: tryCheckout,
    onFilterOpen: () => setFilterOpen(true),
    genreFilter: genreFilter
  }), sub === 'foryou' && /*#__PURE__*/React.createElement(RecommendedEvents, {
    onBuy: tryCheckout
  }), sub === 'search' && /*#__PURE__*/React.createElement(EventSearch, {
    onBuy: tryCheckout
  })), /*#__PURE__*/React.createElement(CheckoutSheet, {
    show: checkout,
    onClose: () => setCheckout(null),
    onDone: () => {
      setCheckout(null);
      window.triggerPostPurchase ? window.triggerPostPurchase() : onToast && onToast('🎟 Ticket saved');
    }
  }), ageGate && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.7)',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.5rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 16px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      textAlign: 'center',
      marginBottom: 10
    }
  }, "\uD83D\uDD1E"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      textAlign: 'center',
      marginBottom: 8
    }
  }, "Age Verification Required"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      color: 'var(--ink-3)',
      textAlign: 'center',
      lineHeight: 1.6,
      marginBottom: 20
    }
  }, "This event requires attendees to be 21+. Please confirm your age to continue."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setCheckout(ageGate);
      setAgeGate(null);
    },
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: 'pointer',
      marginBottom: 10
    }
  }, "I confirm I am 21+ \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAgeGate(null),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Cancel"))), /*#__PURE__*/React.createElement(FilterSheet, {
    open: filterOpen,
    filter: genreFilter,
    onFilter: setGenreFilter,
    onClose: () => setFilterOpen(false)
  }));
}
Object.assign(window, {
  EventsTab
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/EventsTab.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/ListenTab.jsx
try { (() => {
// iHYPE Listen Tab — Search · Seeds · Radio · Charts · Playlists · Following

function ListenTab({
  onToast
}) {
  const [sub, setSub] = React.useState('seeds');
  const subs = ['Search', 'Seeds', 'Radio', 'Charts', 'Top', 'Playlists', 'Following'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      padding: '0',
      flexShrink: 0,
      borderBottom: '1px solid var(--line)'
    }
  }, subs.map(s => {
    const on = sub === s.toLowerCase();
    return /*#__PURE__*/React.createElement("button", {
      key: s,
      onClick: () => setSub(s.toLowerCase()),
      style: {
        flex: 1,
        minWidth: 0,
        padding: '10px 2px 8px',
        borderRadius: 0,
        border: 'none',
        borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent',
        background: 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.68rem',
        letterSpacing: '.02em',
        fontWeight: on ? 700 : 500,
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, s);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '1rem 1.15rem 1.5rem'
    }
  }, sub === 'search' && /*#__PURE__*/React.createElement(ListenSearch, {
    onToast: onToast
  }), sub === 'seeds' && /*#__PURE__*/React.createElement(SeedsWithPersist, null), sub === 'radio' && /*#__PURE__*/React.createElement(ListenRadio, null), sub === 'charts' && /*#__PURE__*/React.createElement(ListenCharts, null), sub === 'top' && /*#__PURE__*/React.createElement(ListenLeaderboard, null), sub === 'playlists' && /*#__PURE__*/React.createElement(ListenPlaylists, null), sub === 'following' && /*#__PURE__*/React.createElement(ListenFollowing, null)));
}
function SeedsWithPersist() {
  React.useEffect(() => {
    const saved = parseInt(localStorage.getItem('ihype_seeds_idx') || '0', 10);
    if (window._seedsSetIdx) window._seedsSetIdx(saved);
  }, []);
  const SC = window.SeedsScreen;
  if (!SC) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '2rem',
      textAlign: 'center',
      color: 'var(--ink-3)'
    }
  }, "Loading Seeds\u2026");
  return /*#__PURE__*/React.createElement(SC, {
    onIdxChange: i => localStorage.setItem('ihype_seeds_idx', i)
  });
}
const LS_HISTORY_KEY = 'ihype_search_history';
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]');
  } catch (e) {
    return [];
  }
}
function ListenSearch({
  onToast
}) {
  const [q, setQ] = React.useState('');
  const [history, setHistory] = React.useState(getHistory);
  const D = window.IHYPE_DATA;
  const pool = [...D.seeds.map(s => ({
    type: 'Artist',
    name: s.artist,
    sub: s.track,
    tint: s.tint
  })), ...D.shows.map(s => ({
    type: 'Artist',
    name: s.artist,
    sub: s.venue,
    tint: s.tint
  }))];
  const results = q ? pool.filter(r => (r.name + r.sub).toLowerCase().includes(q.toLowerCase())) : [];
  const commit = term => {
    const next = [term, ...history.filter(x => x !== term)].slice(0, 5);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
    setQ(term);
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--ink-3)'
    },
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.35-4.35"
  })), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && q.trim()) commit(q.trim());
    },
    placeholder: "Search artists, DJs, playlists\u2026",
    style: {
      width: '100%',
      padding: '10px 36px 10px 38px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem',
      outline: 'none',
      boxSizing: 'border-box'
    }
  }), q && /*#__PURE__*/React.createElement("button", {
    onClick: () => setQ(''),
    style: {
      position: 'absolute',
      right: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 16,
      padding: 0,
      lineHeight: 1
    }
  }, "\xD7")), !q && history.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "Recent"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      localStorage.removeItem(LS_HISTORY_KEY);
      setHistory([]);
    },
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      cursor: 'pointer'
    }
  }, "Clear")), history.map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    onClick: () => setQ(h),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '.55rem 0',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--ink-3)",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "1 4 1 10 7 10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.51 15a9 9 0 1 0 .49-4.5"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)'
    }
  }, h)))), !q && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 10
    }
  }, "Trending now"), D.seeds.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.artist,
    onClick: () => commit(s.artist),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '.65rem 0',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 9,
      background: `linear-gradient(135deg,${s.tint}88,${s.tint}22)`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontWeight: 700,
      fontSize: '.88rem'
    }
  }, s.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, s.tag))))), q && results.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '2rem 1rem',
      fontFamily: 'var(--f-m)',
      fontSize: '.85rem',
      color: 'var(--ink-3)'
    }
  }, "No results for \"", q, "\""), q && results.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => commit(r.name),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '.65rem 0',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 9,
      background: `linear-gradient(135deg,${r.tint}88,${r.tint}22)`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '.88rem'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, r.type, " \xB7 ", r.sub)))));
}
const VERIFIED = new Set(['Midnight Echo', 'Nyla', 'DJ Caro', 'Wax Tropic']);
function Verified() {
  return /*#__PURE__*/React.createElement("span", {
    title: "Verified artist",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: '#5b8cff',
      marginLeft: 4,
      flexShrink: 0,
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "8",
    viewBox: "0 0 10 10",
    fill: "none"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "2,5 4,7 8,3",
    stroke: "#fff",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
function ListenRadio() {
  const D = window.IHYPE_DATA;
  const prefs = (window.IHYPE_USER_PREFS || {}).genres || [];
  const [active, setActive] = React.useState(null);
  const sorted = prefs.length > 0 ? [...D.radioShows].sort((a, b) => {
    const am = prefs.some(g => (a.genre || '').toLowerCase().includes(g));
    const bm = prefs.some(g => (b.genre || '').toLowerCase().includes(g));
    return bm - am;
  }) : D.radioShows;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, sorted.map(s => {
    const on = active === s.id;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      onClick: () => {
        setActive(on ? null : s.id);
        if (!on && window.setIHYPENowPlaying) window.setIHYPENowPlaying({
          t: s.name,
          a: 'by ' + s.host,
          tint: s.tint
        });
      },
      style: {
        padding: 14,
        borderRadius: 16,
        border: `1px solid ${on ? s.tint + '55' : 'var(--line)'}`,
        background: on ? `${s.tint}0d` : 'var(--bg-2)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 48,
        height: 48,
        borderRadius: 12,
        background: `linear-gradient(135deg,${s.tint}cc,${s.tint}33)`,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        flexShrink: 0,
        fontSize: 18
      }
    }, on ? '⏸' : '▶'), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.9rem'
      }
    }, s.name, VERIFIED.has(s.host) && /*#__PURE__*/React.createElement(Verified, null)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.72rem',
        color: 'var(--ink-3)',
        marginTop: 2
      }
    }, "by ", s.host, " \xB7 ", s.genre), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.7rem',
        color: 'var(--ink-3)',
        marginTop: 2
      }
    }, s.listeners, " listening \xB7 ", s.day)), s.status === 'LIVE' && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#ff3c3c',
        flexShrink: 0
      }
    })), on && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        height: 3,
        borderRadius: 999,
        background: 'var(--bg-4)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        width: '38%',
        background: `linear-gradient(90deg,${s.tint},var(--accent))`,
        borderRadius: 999
      }
    })));
  }));
}
function ListenCharts() {
  const [period, setPeriod] = React.useState('week');
  const allTracks = {
    week: [{
      rank: 1,
      t: 'Carousel',
      a: 'Midnight Echo',
      plays: '48.1K',
      tint: '#ff5029'
    }, {
      rank: 2,
      t: 'Goldenrod',
      a: 'Nyla',
      plays: '38.4K',
      tint: '#22e5d4'
    }, {
      rank: 3,
      t: 'Heatwave',
      a: 'Wax Tropic',
      plays: '31.2K',
      tint: '#b983ff'
    }, {
      rank: 4,
      t: 'Paper Cup',
      a: 'Sunroom',
      plays: '28.7K',
      tint: '#ffb84a'
    }, {
      rank: 5,
      t: 'Halogen',
      a: 'Midnight Echo',
      plays: '18.9K',
      tint: '#ff5029'
    }],
    month: [{
      rank: 1,
      t: 'Goldenrod',
      a: 'Nyla',
      plays: '142K',
      tint: '#22e5d4'
    }, {
      rank: 2,
      t: 'Carousel',
      a: 'Midnight Echo',
      plays: '138K',
      tint: '#ff5029'
    }, {
      rank: 3,
      t: 'Paper Cup',
      a: 'Sunroom',
      plays: '91K',
      tint: '#ffb84a'
    }, {
      rank: 4,
      t: 'Slow Static',
      a: 'Midnight Echo',
      plays: '88K',
      tint: '#ff5029'
    }, {
      rank: 5,
      t: 'Heatwave',
      a: 'Wax Tropic',
      plays: '72K',
      tint: '#b983ff'
    }],
    alltime: [{
      rank: 1,
      t: 'Carousel',
      a: 'Midnight Echo',
      plays: '1.2M',
      tint: '#ff5029'
    }, {
      rank: 2,
      t: 'Goldenrod',
      a: 'Nyla',
      plays: '984K',
      tint: '#22e5d4'
    }, {
      rank: 3,
      t: 'Slow Static',
      a: 'Midnight Echo',
      plays: '812K',
      tint: '#ff5029'
    }, {
      rank: 4,
      t: 'Paper Cup',
      a: 'Sunroom',
      plays: '748K',
      tint: '#ffb84a'
    }, {
      rank: 5,
      t: 'Heatwave',
      a: 'Wax Tropic',
      plays: '621K',
      tint: '#b983ff'
    }]
  };
  const tracks = allTracks[period];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 14
    }
  }, [['week', 'This week'], ['month', 'This month'], ['alltime', 'All time']].map(([id, label]) => {
    const on = period === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => setPeriod(id),
      style: {
        padding: '5px 12px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.12)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.7rem',
        cursor: 'pointer',
        fontWeight: on ? 700 : 500
      }
    }, label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "Top hypes \xB7 LA"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEFriendActivity && window.openIHYPEFriendActivity(),
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      color: 'var(--accent)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      letterSpacing: '.06em'
    }
  }, "Friends \u2192")), /*#__PURE__*/React.createElement("style", null, '@keyframes growUp{from{transform:scaleY(0)}to{transform:scaleY(1)}}'), tracks.map((t, ri) => /*#__PURE__*/React.createElement("div", {
    key: t.rank,
    onClick: () => {
      const a = window.lookupArtist && window.lookupArtist(t.a, t.tint);
      if (a) window.openIHYPEArtistProfile && window.openIHYPEArtistProfile(a);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '.7rem 0',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer',
      animation: `fadeSlide .3s ${ri * .06}s both`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      color: 'var(--ink-3)',
      minWidth: 24,
      textAlign: 'center'
    }
  }, t.rank), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 9,
      background: `linear-gradient(135deg,${t.tint}88,${t.tint}22)`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '.88rem'
    }
  }, t.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, t.a)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, t.plays))));
}
function ListenPlaylists() {
  const D = window.IHYPE_DATA;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "Your playlists"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEPlaylistCreate && window.openIHYPEPlaylistCreate(),
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'rgba(255,80,41,.12)',
      border: '1px solid rgba(255,80,41,.25)',
      color: 'var(--accent)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
      lineHeight: 1
    }
  }, "+")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, D.playlists.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    onClick: () => {
      if (window.setIHYPENowPlaying) window.setIHYPENowPlaying({
        t: p.name,
        a: 'Playlist · ' + p.count + ' tracks',
        tint: p.tint
      });
    },
    style: {
      padding: '1rem',
      borderRadius: 16,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      cursor: 'pointer',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      aspectRatio: '1',
      borderRadius: 12,
      background: `linear-gradient(135deg,${p.tint}cc,${p.tint}22)`,
      marginBottom: 10,
      position: 'relative',
      overflow: 'hidden',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.4rem',
      letterSpacing: '-.04em',
      color: 'rgba(255,255,255,.85)'
    }
  }, p.name.split(' ').map(w => w[0]).join('').slice(0, 2))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      lineHeight: 1.2,
      marginBottom: 4
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, p.count, " tracks \xB7 ", p.by, p.auto ? ' · auto' : '')))));
}
function ListenFollowing() {
  const followed = [{
    name: 'Midnight Echo',
    role: 'Artist',
    action: 'Dropped tickets',
    detail: 'Live at The Echo · Fri Jun 20 · $18',
    time: '2m',
    tint: '#ff5029'
  }, {
    name: 'DJ Caro',
    role: 'DJ',
    action: 'Starting a live show',
    detail: 'Late Night Frequencies · 2.4K listening',
    time: '1h',
    tint: '#b983ff'
  }, {
    name: 'Nyla',
    role: 'Artist',
    action: 'Added track to Seeds',
    detail: 'Goldenrod · new preview available',
    time: '3h',
    tint: '#22e5d4'
  }, {
    name: 'Sunroom',
    role: 'Artist',
    action: 'Announced new event',
    detail: 'Album Release · Gold-Diggers · Sun Jun 22',
    time: '1d',
    tint: '#ffb84a'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "Activity from people you follow"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEFriendActivity && window.openIHYPEFriendActivity(),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 10px',
      borderRadius: 999,
      border: '1px solid rgba(185,131,255,.3)',
      background: 'rgba(185,131,255,.06)',
      color: '#b983ff',
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      cursor: 'pointer',
      fontWeight: 700
    }
  }, "\uD83D\uDC65 Friends")), followed.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12,
      padding: '.85rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => {
      const a = window.lookupArtist && window.lookupArtist(f.name, f.tint);
      if (a) window.openIHYPEArtistProfile && window.openIHYPEArtistProfile(a);
    },
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: `linear-gradient(135deg,${f.tint}88,${f.tint}22)`,
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      color: '#fff',
      cursor: 'pointer'
    }
  }, f.name[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-b)',
      fontWeight: 700,
      fontSize: '.85rem'
    }
  }, f.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      color: 'var(--ink-3)',
      padding: '1px 6px',
      borderRadius: 999,
      border: '1px solid var(--line-2)',
      background: 'var(--bg-3)'
    }
  }, f.role)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-2)',
      marginBottom: 2
    }
  }, f.action), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, f.detail)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)',
      flexShrink: 0,
      marginTop: 2
    }
  }, f.time))));
}
function ListenLeaderboard() {
  const ARTISTS = [{
    rank: 1,
    name: 'Midnight Echo',
    hypes: '24.1K',
    tint: '#ff5029',
    change: '+2'
  }, {
    rank: 2,
    name: 'Nyla',
    hypes: '19.8K',
    tint: '#22e5d4',
    change: '—'
  }, {
    rank: 3,
    name: 'Wax Tropic',
    hypes: '17.4K',
    tint: '#b983ff',
    change: '-2'
  }, {
    rank: 4,
    name: 'DJ Caro',
    hypes: '14.2K',
    tint: '#5b8cff',
    change: '+2'
  }, {
    rank: 5,
    name: 'Cold Harbor',
    hypes: '11.9K',
    tint: '#ffb84a',
    change: '-1'
  }, {
    rank: 6,
    name: 'Sunroom',
    hypes: '9.3K',
    tint: '#ff5029',
    change: '-1'
  }, {
    rank: 7,
    name: 'Robin Vega',
    hypes: '7.8K',
    tint: '#22e5d4',
    change: '+2'
  }, {
    rank: 8,
    name: 'Slow Harbor',
    hypes: '6.1K',
    tint: '#b983ff',
    change: '—'
  }];
  const cc = c => c.startsWith('+') ? '#22e5d4' : c.startsWith('-') ? '#ff5029' : 'var(--ink-3)';
  const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "HYPE Leaderboard \xB7 This Week"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#ff5029',
      boxShadow: '0 0 6px #ff5029',
      display: 'inline-block'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)'
    }
  }, "Live"))), ARTISTS.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.name,
    onClick: () => {
      const ar = window.lookupArtist && window.lookupArtist(a.name, a.tint);
      if (ar && window.openIHYPEArtistProfile) window.openIHYPEArtistProfile(ar);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,.05)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      textAlign: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: i < 3 ? '1.2rem' : '.9rem',
      color: i === 0 ? '#ffb84a' : i === 1 ? '#aaa' : i === 2 ? '#b983ff' : 'var(--ink-3)',
      flexShrink: 0
    }
  }, medal(i) || a.rank), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: 'linear-gradient(135deg,' + a.tint + '88,' + a.tint + '22)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, a.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, a.hypes, " hypes")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      fontWeight: 700,
      color: cc(a.change),
      flexShrink: 0,
      minWidth: 28,
      textAlign: 'right'
    }
  }, a.change))));
}
Object.assign(window, {
  ListenTab
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/ListenTab.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/MoreSheets.jsx
try { (() => {
// MoreSheets.jsx — LiveShowMode, GlobalSearch, EarningsSheet, PayoutSheet

// ── Shared pill sheet wrapper ────────────────────────────────────────────────
function Sheet({
  open,
  onClose,
  children,
  maxH = '88%'
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 82,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(8px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      maxHeight: maxH,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '12px auto 0',
      flexShrink: 0
    }
  }), children));
}
function SheetHead({
  title,
  sub,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '14px 18px 4px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem'
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, sub)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 22,
      lineHeight: 1,
      padding: '0 2px'
    }
  }, "\xD7"));
}

// ── 1. LIVE SHOW MODE OVERLAY ─────────────────────────────────────────────────
function LiveShowOverlay({
  event,
  onClose
}) {
  const [count, setCount] = React.useState(142);
  const [hyped, setHyped] = React.useState(false);
  const [pulse, setPulse] = React.useState(false);
  const [reactions, setReactions] = React.useState([]);
  const [reactionId, setReactionId] = React.useState(0);
  const tickRef = React.useRef(null);
  React.useEffect(() => {
    tickRef.current = setInterval(() => setCount(c => c + Math.floor(Math.random() * 3)), 4000);
    return () => clearInterval(tickRef.current);
  }, []);
  const addReaction = emoji => {
    const id = reactionId + 1;
    setReactionId(id);
    const x = 20 + Math.random() * 60;
    setReactions(r => [...r, {
      id,
      emoji,
      x
    }]);
    setTimeout(() => setReactions(r => r.filter(r2 => r2.id !== id)), 2200);
  };
  const doHype = () => {
    if (hyped) return;
    setHyped(true);
    setPulse(true);
    navigator.vibrate && navigator.vibrate([30, 20, 30]);
    addReaction('🔥');
    setTimeout(() => setPulse(false), 600);
  };
  if (!event) return null;
  const ev = event || {
    artist: 'Midnight Echo',
    venue: 'The Echo',
    city: 'Los Angeles',
    tint: '#ff5029'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 95,
      background: `linear-gradient(180deg,${ev.tint || '#ff5029'}22 0%,var(--bg) 55%)`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, reactions.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      position: 'absolute',
      bottom: '30%',
      left: `${r.x}%`,
      fontSize: 28,
      pointerEvents: 'none',
      animation: 'floatUp 2.2s ease-out forwards',
      zIndex: 96
    }
  }, r.emoji)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '14px 16px 0',
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 22
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 12px',
      borderRadius: 999,
      background: 'rgba(255,80,41,.12)',
      border: '1px solid rgba(255,80,41,.3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#ff5029',
      display: 'inline-block',
      boxShadow: '0 0 8px #ff5029',
      animation: 'blink 1s step-end infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: '#ff5029'
    }
  }, "Live"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 160,
      height: 160,
      borderRadius: 32,
      background: `linear-gradient(135deg,${ev.tint || '#ff5029'},${ev.tint || '#ff5029'}44)`,
      display: 'grid',
      placeItems: 'center',
      fontSize: 64,
      boxShadow: `0 0 60px ${ev.tint || '#ff5029'}55`,
      animation: pulse ? 'scaleUp .3s ease-out' : 'none'
    }
  }, "\uD83C\uDFB5"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 900,
      fontSize: '1.6rem',
      letterSpacing: '-.04em',
      lineHeight: 1.1
    }
  }, ev.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      color: 'var(--ink-3)',
      marginTop: 4
    }
  }, ev.venue, " \xB7 ", ev.city)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: 999,
      background: 'rgba(255,255,255,.06)',
      border: '1px solid rgba(255,255,255,.1)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 21v-2a4 4 0 0 0-3-3.87"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 0 1 0 7.75"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-2)'
    }
  }, count.toLocaleString(), " listening"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      padding: '0 1rem 12px',
      flexShrink: 0
    }
  }, ['🎵', '💜', '🎶', '✨', '👏'].map(e => /*#__PURE__*/React.createElement("button", {
    key: e,
    onClick: () => addReaction(e),
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      border: '1px solid rgba(255,255,255,.15)',
      background: 'rgba(255,255,255,.06)',
      fontSize: 22,
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
      transition: 'transform .1s',
      active: {
        transform: 'scale(.88)'
      }
    }
  }, e))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 1.5rem 2rem',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: doHype,
    style: {
      width: '100%',
      padding: '16px',
      borderRadius: 999,
      background: hyped ? 'rgba(255,80,41,.15)' : 'linear-gradient(90deg,#ff5029,#ff3e9a)',
      color: hyped ? '#ff5029' : '#fff',
      border: hyped ? '1px solid rgba(255,80,41,.35)' : 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      cursor: 'pointer',
      letterSpacing: '.02em',
      boxShadow: hyped ? 'none' : '0 4px 28px rgba(255,80,41,.4)',
      transition: 'all .3s'
    }
  }, hyped ? '🔥 Hyped!' : '🔥 Hype Now')), /*#__PURE__*/React.createElement("style", null, `
        @keyframes floatUp { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-220px) scale(1.4);opacity:0} }
        @keyframes scaleUp { 0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      `));
}

// ── 2. GLOBAL SEARCH ──────────────────────────────────────────────────────────
function GlobalSearch({
  open,
  onClose
}) {
  const [q, setQ] = React.useState('');
  const [history, setHistory] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ihype_search_hist') || '[]');
    } catch (e) {
      return [];
    }
  });
  const D = window.IHYPE_DATA || {};
  const pool = [...(D.shows || []).map(s => ({
    type: 'Event',
    name: s.artist,
    sub: `${s.venue} · ${s.city}`,
    tint: s.tint || '#ff5029',
    icon: '🎟'
  })), ...(D.freeUseLibrary || []).map(s => ({
    type: 'Track',
    name: s.t,
    sub: `${s.a} · ${s.genre}`,
    tint: s.tint || '#b983ff',
    icon: '🎵'
  })), ...(D.seeds || []).map(s => ({
    type: 'Artist',
    name: s.artist,
    sub: s.venue || '',
    tint: s.tint || '#22e5d4',
    icon: '👤'
  }))];
  const results = q.length > 1 ? pool.filter(r => (r.name + r.sub).toLowerCase().includes(q.toLowerCase())).slice(0, 12) : [];
  const addHistory = term => {
    const next = [term, ...history.filter(x => x !== term)].slice(0, 6);
    setHistory(next);
    localStorage.setItem('ihype_search_hist', JSON.stringify(next));
  };
  const clear = () => {
    setHistory([]);
    localStorage.removeItem('ihype_search_hist');
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 88,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 14px 10px',
      flexShrink: 0,
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 22,
      padding: 0,
      lineHeight: 1
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(255,255,255,.07)',
      borderRadius: 12,
      padding: '9px 12px',
      border: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.35-4.35"
  })), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Artists, events, tracks\u2026",
    style: {
      flex: 1,
      background: 'none',
      border: 'none',
      outline: 'none',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.9rem'
    }
  }), q && /*#__PURE__*/React.createElement("button", {
    onClick: () => setQ(''),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 16,
      padding: 0,
      lineHeight: 1
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 14px 20px'
    }
  }, !q && history.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "Recent"), /*#__PURE__*/React.createElement("button", {
    onClick: clear,
    style: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,80,41,.5)',
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      cursor: 'pointer'
    }
  }, "Clear")), history.map(h => /*#__PURE__*/React.createElement("button", {
    key: h,
    onClick: () => setQ(h),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '8px 0',
      background: 'none',
      border: 'none',
      borderBottom: '1px solid var(--line)',
      color: 'var(--ink)',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    style: {
      color: 'var(--ink-3)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 6 12 12 16 14"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem'
    }
  }, h)))), !q && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 10
    }
  }, "Trending"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7
    }
  }, ['dream-pop', 'lo-fi', 'midnight echo', 'shoegaze', 'dj caro', 'electronic'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setQ(t),
    style: {
      padding: '6px 13px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer'
    }
  }, t)))), q.length > 1 && results.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '3rem 1rem',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem'
    }
  }, "No results for \"", q, "\""), results.map((r, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => {
      addHistory(q);
      onClose();
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      padding: '10px 0',
      background: 'none',
      border: 'none',
      borderBottom: '1px solid rgba(255,255,255,.05)',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: `${r.tint}22`,
      border: `1px solid ${r.tint}44`,
      display: 'grid',
      placeItems: 'center',
      fontSize: 18,
      flexShrink: 0
    }
  }, r.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, r.type, " \xB7 ", r.sub)), /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    style: {
      color: 'var(--ink-3)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }))))));
}

// ── 3. EARNINGS DASHBOARD ─────────────────────────────────────────────────────
const EARNING_EVENTS = [{
  event: 'Midnight Echo @ The Echo',
  date: 'Jun 14',
  sold: 8,
  cut: 0.10,
  price: 22,
  status: 'cleared'
}, {
  event: 'Nyla @ Zebulon',
  date: 'Jun 8',
  sold: 3,
  cut: 0.08,
  price: 18,
  status: 'cleared'
}, {
  event: 'Wax Tropic @ Echoplex',
  date: 'Jun 20',
  sold: 5,
  cut: 0.10,
  price: 25,
  status: 'pending'
}, {
  event: 'DJ Caro @ 1720',
  date: 'Jun 22',
  sold: 2,
  cut: 0.07,
  price: 15,
  status: 'pending'
}];
function EarningsSheet({
  open,
  onClose,
  onPayout
}) {
  const cleared = EARNING_EVENTS.filter(e => e.status === 'cleared').reduce((a, e) => a + e.sold * e.price * e.cut, 0);
  const pending = EARNING_EVENTS.filter(e => e.status === 'pending').reduce((a, e) => a + e.sold * e.price * e.cut, 0);
  return /*#__PURE__*/React.createElement(Sheet, {
    open: open,
    onClose: onClose,
    maxH: "90%"
  }, /*#__PURE__*/React.createElement(SheetHead, {
    title: "Promoter Earnings",
    sub: "Your referral payout history",
    onClose: onClose
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, [['$' + cleared.toFixed(2), 'Available', '#22e5d4'], ['$' + pending.toFixed(2), 'Pending', '#ffb84a']].map(([v, l, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      padding: '14px',
      borderRadius: 16,
      background: `${c}11`,
      border: `1px solid ${c}33`,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 900,
      fontSize: '1.5rem',
      color: c
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: c,
      marginTop: 4,
      opacity: .8
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderRadius: 12,
      background: 'rgba(185,131,255,.07)',
      border: '1px solid rgba(185,131,255,.15)',
      fontFamily: 'var(--f-b)',
      fontSize: '.78rem',
      color: 'rgba(185,131,255,.85)',
      lineHeight: 1.6
    }
  }, "Earn up to ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: '#b983ff'
    }
  }, "10% per ticket"), " you refer. Rate scales with your share of the total gate \u2014 the more you drive, the more you earn."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "Breakdown"), EARNING_EVENTS.map((e, i) => {
    const amt = (e.sold * e.price * e.cut).toFixed(2);
    const pct = Math.round(e.cut * 100);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,.05)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.85rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, e.event), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.7rem',
        color: 'var(--ink-3)',
        marginTop: 2
      }
    }, e.date, " \xB7 ", e.sold, " tickets \xB7 ", pct, "% cut")), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.9rem',
        color: e.status === 'cleared' ? '#22e5d4' : '#ffb84a'
      }
    }, "$", amt), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.62rem',
        color: e.status === 'cleared' ? 'rgba(34,229,212,.6)' : 'rgba(255,184,74,.6)',
        textTransform: 'uppercase',
        letterSpacing: '.08em'
      }
    }, e.status)));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onPayout,
    disabled: cleared < 1,
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: cleared >= 1 ? 'linear-gradient(90deg,#22e5d4,#5b8cff)' : 'var(--bg-3)',
      color: cleared >= 1 ? '#000' : 'var(--ink-3)',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: cleared >= 1 ? 'pointer' : 'default'
    }
  }, "Request Payout \u2192 $", cleared.toFixed(2))));
}

// ── 4. PAYOUT SHEET ───────────────────────────────────────────────────────────
function PayoutSheet({
  open,
  onClose,
  amount,
  onToast
}) {
  const [step, setStep] = React.useState(0); // 0=method 1=confirm 2=done
  const [method, setMethod] = React.useState(null);
  const methods = [{
    id: 'bank',
    label: 'Bank Account',
    sub: '****1234 · Chase',
    icon: '🏦',
    time: '2–3 business days'
  }, {
    id: 'venmo',
    label: 'Venmo',
    sub: '@robinvega',
    icon: '💸',
    time: 'Instant'
  }, {
    id: 'paypal',
    label: 'PayPal',
    sub: 'robin@email.com',
    icon: '🅿',
    time: 'Instant'
  }];
  const reset = () => {
    setStep(0);
    setMethod(null);
    onClose();
  };
  return /*#__PURE__*/React.createElement(Sheet, {
    open: open,
    onClose: reset,
    maxH: "75%"
  }, /*#__PURE__*/React.createElement(SheetHead, {
    title: step === 2 ? 'Payout Sent!' : 'Request Payout',
    sub: step === 2 ? undefined : `$${(amount || 0).toFixed(2)} available`,
    onClose: reset
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px 32px'
    }
  }, step === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginBottom: 14
    }
  }, "Choose payout method"), methods.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => {
      setMethod(m);
      setStep(1);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      padding: '12px',
      borderRadius: 14,
      border: `1px solid ${method?.id === m.id ? 'var(--accent)' : 'var(--line)'}`,
      background: 'var(--bg-3)',
      marginBottom: 8,
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 24,
      flexShrink: 0
    }
  }, m.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem'
    }
  }, m.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, m.sub, " \xB7 ", m.time)), /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    style: {
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }))))), step === 1 && method && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px',
      borderRadius: 16,
      background: 'var(--bg-3)',
      border: '1px solid var(--line)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 900,
      fontSize: '2rem',
      color: '#22e5d4',
      marginBottom: 6
    }
  }, "$", (amount || 0).toFixed(2)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)'
    }
  }, "via ", method.label, " \xB7 ", method.time)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setStep(2);
      onToast && onToast('Payout requested ✓');
      navigator.vibrate && navigator.vibrate([20, 10, 20]);
      setTimeout(reset, 2200);
    },
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: 'linear-gradient(90deg,#22e5d4,#5b8cff)',
      color: '#000',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: 'pointer'
    }
  }, "Confirm Payout"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(0),
    style: {
      width: '100%',
      padding: '10px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "\u2190 Back")), step === 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '2rem 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 56,
      marginBottom: 12
    }
  }, "\u2705"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 6
    }
  }, "Payout requested!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      color: 'var(--ink-3)',
      lineHeight: 1.6
    }
  }, "Arrives ", method?.time?.toLowerCase(), " via ", method?.label, "."))));
}
Object.assign(window, {
  LiveShowOverlay,
  GlobalSearch,
  EarningsSheet,
  PayoutSheet
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/MoreSheets.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/PagesTab.jsx
try { (() => {
// iHYPE Pages Tab — My Page (role-aware) · Browse · Create

const PAGE_ROLES = ['Fan', 'DJ', 'Artist', 'Venue'];
function TimePeriodSelect({
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 12
    }
  }, ['Week', 'Month', 'All time'].map(t => {
    const on = value === t;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      onClick: () => onChange(t),
      style: {
        padding: '4px 11px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.1)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.68rem',
        fontWeight: on ? 700 : 500,
        cursor: 'pointer'
      }
    }, t);
  }));
}
const FAN_STATS_DATA = {
  Week: [{
    label: 'Hype earned',
    v: '$2.40',
    color: 'var(--accent)'
  }, {
    label: 'Hype given',
    v: '14',
    color: '#22e5d4'
  }, {
    label: 'Events attended',
    v: '1',
    color: '#b983ff'
  }, {
    label: 'Referrals',
    v: '0',
    color: '#ffb84a'
  }, {
    label: 'Seeds rated',
    v: '22',
    color: '#22e5d4'
  }, {
    label: 'Followers',
    v: '+3',
    color: 'var(--ink-2)'
  }, {
    label: 'Artists followed',
    v: '2',
    color: 'var(--ink-2)'
  }, {
    label: 'DJs followed',
    v: '1',
    color: 'var(--ink-2)'
  }],
  Month: [{
    label: 'Hype earned',
    v: '$16.20',
    color: 'var(--accent)'
  }, {
    label: 'Hype given',
    v: '84',
    color: '#22e5d4'
  }, {
    label: 'Events attended',
    v: '4',
    color: '#b983ff'
  }, {
    label: 'Referrals',
    v: '1',
    color: '#ffb84a'
  }, {
    label: 'Seeds rated',
    v: '58',
    color: '#22e5d4'
  }, {
    label: 'Followers',
    v: '+12',
    color: 'var(--ink-2)'
  }, {
    label: 'Artists followed',
    v: '6',
    color: 'var(--ink-2)'
  }, {
    label: 'DJs followed',
    v: '4',
    color: 'var(--ink-2)'
  }],
  'All time': [{
    label: 'Hype earned',
    v: '$82.40',
    color: 'var(--accent)'
  }, {
    label: 'Hype given',
    v: '284',
    color: '#22e5d4'
  }, {
    label: 'Events attended',
    v: '12',
    color: '#b983ff'
  }, {
    label: 'Referrals',
    v: '3',
    color: '#ffb84a'
  }, {
    label: 'Seeds rated',
    v: '142',
    color: '#22e5d4'
  }, {
    label: 'Followers',
    v: '48',
    color: 'var(--ink-2)'
  }, {
    label: 'Artists followed',
    v: '22',
    color: 'var(--ink-2)'
  }, {
    label: 'DJs followed',
    v: '11',
    color: 'var(--ink-2)'
  }]
};
const getFanStats = period => FAN_STATS_DATA[period] || FAN_STATS_DATA['All time'];
function StatGrid({
  stats
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginBottom: 16
    }
  }, stats.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      padding: '10px 12px',
      borderRadius: 13,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.25rem',
      color: s.color,
      lineHeight: 1
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginTop: 4
    }
  }, s.label))));
}
function PromoterLink({
  onToast
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1rem',
      borderRadius: 16,
      border: '1px solid rgba(185,131,255,.25)',
      background: 'rgba(185,131,255,.06)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: '#b983ff',
      marginBottom: 6
    }
  }, "Your promoter link \xB7 10% pool"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginBottom: 10
    }
  }, [['$16.20', 'Earned', 'var(--accent)'], ['47', 'Clicks', '#22e5d4'], ['3', 'Purchases', '#b983ff']].map(([v, l, c]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      color: c,
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.75rem',
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      marginBottom: 10
    }
  }, "Each purchase through your link earns your proportional share of the 10% promoter pool."), /*#__PURE__*/React.createElement("button", {
    onClick: () => onToast && onToast('Link copied!'),
    style: {
      width: '100%',
      padding: '10px',
      borderRadius: 12,
      border: '1px solid rgba(185,131,255,.3)',
      background: 'rgba(185,131,255,.1)',
      color: '#b983ff',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.85rem',
      cursor: 'pointer'
    }
  }, "Copy my referral link"));
}
function BarChart() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const vals = [22, 35, 28, 44, 38, 52];
  const max = Math.max(...vals);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1rem',
      borderRadius: 16,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 12
    }
  }, "Events attended by month"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 6,
      height: 80
    }
  }, vals.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      background: 'var(--accent)',
      borderRadius: '4px 4px 0 0',
      height: Math.round(v / max * 72) + 4 + 'px',
      opacity: .85
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.58rem',
      color: 'var(--ink-3)'
    }
  }, months[i])))));
}
function FanPage({
  onToast
}) {
  const [period, setPeriod] = React.useState('Month');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TimePeriodSelect, {
    value: period,
    onChange: setPeriod
  }), /*#__PURE__*/React.createElement(StatGrid, {
    stats: getFanStats(period)
  }), /*#__PURE__*/React.createElement(BarChart, null), /*#__PURE__*/React.createElement(PromoterLink, {
    onToast: onToast
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEFriendActivity && window.openIHYPEFriendActivity(),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid rgba(185,131,255,.3)',
      background: 'rgba(185,131,255,.06)',
      color: '#b983ff',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer',
      marginBottom: 8
    }
  }, "\uD83D\uDC65 Friend activity"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer',
      marginBottom: 8
    }
  }, "Edit page"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPESettings && window.openIHYPESettings(),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Settings"));
}
function DJPage({
  onToast
}) {
  const [period, setPeriod] = React.useState('Month');
  const [crate, setCrate] = React.useState([{
    id: 'fu1',
    t: 'Carousel',
    a: 'Midnight Echo',
    len: '3:42',
    tint: '#ff5029'
  }, {
    id: 'fu2',
    t: 'Goldenrod',
    a: 'Nyla',
    len: '3:21',
    tint: '#22e5d4'
  }, {
    id: 'fu3',
    t: 'Heatwave',
    a: 'Wax Tropic',
    len: '4:10',
    tint: '#b983ff'
  }]);
  const moveUp = i => {
    if (i === 0) return;
    const c = [...crate];
    [c[i - 1], c[i]] = [c[i], c[i - 1]];
    setCrate(c);
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TimePeriodSelect, {
    value: period,
    onChange: setPeriod
  }), /*#__PURE__*/React.createElement(StatGrid, {
    stats: [...getFanStats(period), {
      label: 'Radio shows',
      v: '14',
      color: '#b983ff'
    }, {
      label: 'Total listeners',
      v: '12.4K',
      color: '#22e5d4'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: '1rem',
      borderRadius: 16,
      border: '1px solid rgba(185,131,255,.25)',
      background: 'rgba(185,131,255,.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: '#b983ff'
    }
  }, "My Crate"), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '4px 10px',
      borderRadius: 999,
      border: '1px solid rgba(185,131,255,.3)',
      background: 'transparent',
      color: '#b983ff',
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      cursor: 'pointer'
    }
  }, "+ Add track")), crate.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.t,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '.6rem 0',
      borderBottom: i < crate.length - 1 ? '1px solid var(--line-2)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => moveUp(i),
    disabled: i === 0,
    style: {
      background: 'none',
      border: 'none',
      color: i === 0 ? 'var(--bg-4)' : 'var(--ink-3)',
      cursor: i === 0 ? 'default' : 'pointer',
      padding: '0 2px',
      lineHeight: 1,
      fontSize: 12
    }
  }, "\u25B2"), /*#__PURE__*/React.createElement("button", {
    onClick: () => moveUp(i + 1),
    disabled: i === crate.length - 1,
    style: {
      background: 'none',
      border: 'none',
      color: i === crate.length - 1 ? 'var(--bg-4)' : 'var(--ink-3)',
      cursor: i === crate.length - 1 ? 'default' : 'pointer',
      padding: '0 2px',
      lineHeight: 1,
      fontSize: 12
    }
  }, "\u25BC")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)',
      minWidth: 16,
      textAlign: 'center'
    }
  }, i + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '.85rem'
    }
  }, t.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, t.a)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, t.len))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPERadioCreator && window.openIHYPERadioCreator(crate),
    style: {
      flex: 1,
      padding: '9px',
      borderRadius: 10,
      border: '1px solid rgba(185,131,255,.4)',
      background: 'rgba(185,131,255,.1)',
      color: '#b983ff',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "\uD83C\uDF99 Radio Studio \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEEarnings && window.openIHYPEEarnings(),
    style: {
      padding: '9px 12px',
      borderRadius: 10,
      border: '1px solid rgba(34,229,212,.25)',
      background: 'rgba(34,229,212,.07)',
      color: '#22e5d4',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer'
    }
  }, "\uD83D\uDCB0 Earnings"))), /*#__PURE__*/React.createElement(BarChart, null), /*#__PURE__*/React.createElement(PromoterLink, {
    onToast: onToast
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPESettings && window.openIHYPESettings(),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Settings"));
}
function TrackUploadBlock({
  onToast
}) {
  const [tracks, setTracks] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ihype_my_tracks') || '[]');
    } catch {
      return [];
    }
  });
  const [dragging, setDragging] = React.useState(false);
  const save = t => {
    localStorage.setItem('ihype_my_tracks', JSON.stringify(t));
    setTracks(t);
  };
  const addMock = () => {
    const titles = ['Neon Cascade', 'Glass Heart', 'Low Tide', 'Ember Drift', 'Static Rain'];
    const t = [...tracks, {
      id: 't_' + Date.now(),
      title: titles[tracks.length % titles.length],
      license: 'all_rights',
      duration: '3:' + Math.floor(Math.random() * 59).toString().padStart(2, '0'),
      uploaded: Date.now()
    }];
    save(t);
    onToast && onToast('Track uploaded (simulated)');
  };
  const toggle = id => {
    save(tracks.map(t => t.id === id ? {
      ...t,
      license: t.license === 'free_use_limited' ? 'all_rights' : 'free_use_limited'
    } : t));
  };
  const remove = id => {
    save(tracks.filter(t => t.id !== id));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1rem',
      borderRadius: 16,
      border: `1px solid ${dragging ? 'var(--accent)' : 'var(--line)'}`,
      background: dragging ? 'rgba(255,80,41,.05)' : 'var(--bg-2)',
      marginBottom: 12,
      transition: 'border-color .15s'
    },
    onDragOver: e => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: e => {
      e.preventDefault();
      setDragging(false);
      addMock();
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: tracks.length ? 10 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, "My tracks \xB7 ", tracks.length), /*#__PURE__*/React.createElement("button", {
    onClick: addMock,
    style: {
      padding: '4px 12px',
      borderRadius: 999,
      border: '1px solid rgba(255,80,41,.3)',
      background: 'rgba(255,80,41,.08)',
      color: 'var(--accent)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.78rem',
      cursor: 'pointer'
    }
  }, "+ Upload")), tracks.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '18px 0',
      fontFamily: 'var(--f-m)',
      fontSize: '.8rem',
      color: 'var(--ink-3)'
    }
  }, "Drag an audio file here or tap Upload"), tracks.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '.5rem 0',
      borderTop: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '.84rem'
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, t.duration, " \xB7 ", t.license === 'free_use_limited' ? '🔓 free-use' : '🔒 all rights')), /*#__PURE__*/React.createElement("button", {
    onClick: () => toggle(t.id),
    style: {
      padding: '3px 9px',
      borderRadius: 999,
      border: '1px solid rgba(185,131,255,.3)',
      background: 'transparent',
      color: '#b983ff',
      fontFamily: 'var(--f-m)',
      fontSize: '.64rem',
      cursor: 'pointer'
    }
  }, t.license === 'free_use_limited' ? 'Make private' : 'Free-use'), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(t.id),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: '.9rem'
    }
  }, "\xD7"))));
}
function ArtistPage({
  onToast
}) {
  const [period, setPeriod] = React.useState('Month');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TimePeriodSelect, {
    value: period,
    onChange: setPeriod
  }), /*#__PURE__*/React.createElement(StatGrid, {
    stats: [...getFanStats(period), {
      label: 'Monthly listeners',
      v: '12.4K',
      color: '#22e5d4'
    }, {
      label: 'Tickets sold',
      v: '218',
      color: '#ff5029'
    }, {
      label: 'Artist split',
      v: '$2,747',
      color: '#ff5029'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: '1rem',
      borderRadius: 16,
      border: '1px solid rgba(255,80,41,.2)',
      background: 'rgba(255,80,41,.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '3rem',
      letterSpacing: '-.04em',
      color: 'var(--accent)',
      lineHeight: 1
    }
  }, "70%"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      marginTop: 6
    }
  }, "of every ticket, automatically. iHYPE takes nothing.")), /*#__PURE__*/React.createElement(TrackUploadBlock, {
    onToast: onToast
  }), /*#__PURE__*/React.createElement(BarChart, null), /*#__PURE__*/React.createElement(PromoterLink, {
    onToast: onToast
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPETourCreator && window.openIHYPETourCreator(),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid rgba(255,80,41,.25)',
      background: 'rgba(255,80,41,.06)',
      color: '#ff5029',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer',
      marginBottom: 8
    }
  }, "Tour Creator \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEAnalytics && window.openIHYPEAnalytics(),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid rgba(255,80,41,.2)',
      background: 'rgba(255,80,41,.05)',
      color: 'var(--accent)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer',
      marginBottom: 8
    }
  }, "Analytics \u2192"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer',
      marginBottom: 8
    }
  }, "Edit page"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPESettings && window.openIHYPESettings(),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Settings"));
}
function VenuePage({
  onToast
}) {
  const [period, setPeriod] = React.useState('Month');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(TimePeriodSelect, {
    value: period,
    onChange: setPeriod
  }), /*#__PURE__*/React.createElement(StatGrid, {
    stats: [...getFanStats(period).slice(0, 6), {
      label: 'Events hosted',
      v: '24',
      color: '#22e5d4'
    }, {
      label: 'Venue split',
      v: '$18.4K',
      color: '#22e5d4'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: '1rem',
      borderRadius: 16,
      border: '1px solid rgba(34,229,212,.2)',
      background: 'rgba(34,229,212,.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '3rem',
      letterSpacing: '-.04em',
      color: '#22e5d4',
      lineHeight: 1
    }
  }, "20%"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      marginTop: 6
    }
  }, "of every ticket sold at your venue. Direct. No middleman.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: '1rem',
      borderRadius: 16,
      border: '1px solid rgba(34,229,212,.2)',
      background: 'rgba(34,229,212,.04)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: '#22e5d4'
    }
  }, "Upcoming events"), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '3px 10px',
      borderRadius: 999,
      border: '1px solid rgba(34,229,212,.3)',
      background: 'transparent',
      color: '#22e5d4',
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      cursor: 'pointer'
    }
  }, "+ Create")), [{
    name: 'Midnight Echo',
    date: 'Fri Jun 20 · 9PM',
    sold: 218,
    cap: 300,
    tint: '#ff5029'
  }, {
    name: 'Wax Tropic',
    date: 'Sat Jun 21 · 8PM',
    sold: 142,
    cap: 250,
    tint: '#b983ff'
  }].map((ev, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '.6rem 0',
      borderBottom: i < 1 ? '1px solid rgba(34,229,212,.1)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 9,
      background: `linear-gradient(135deg,${ev.tint}88,${ev.tint}22)`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '.82rem'
    }
  }, ev.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, ev.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      color: '#22e5d4'
    }
  }, ev.sold), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)'
    }
  }, "/", ev.cap, " sold"))))), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPESettings && window.openIHYPESettings(),
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Settings"));
}
function CreatePageFlow({
  onToast,
  onDone
}) {
  const ROLES = [{
    id: 'Fan',
    icon: '🎶',
    tint: '#b983ff',
    desc: 'Stats, referral link, listening history.'
  }, {
    id: 'DJ',
    icon: '📻',
    tint: '#ff3e9a',
    desc: 'Crate, Radio Studio, promoter tools.'
  }, {
    id: 'Artist',
    icon: '🎤',
    tint: '#ff5029',
    desc: '70% of every ticket, Tour Creator, media.'
  }, {
    id: 'Venue',
    icon: '🏛️',
    tint: '#22e5d4',
    desc: 'Event Creator, door management, gate split.'
  }];
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState(null);
  const [form, setForm] = React.useState({
    name: '',
    handle: '',
    bio: '',
    city: '',
    genre: '',
    capacity: ''
  });
  const set = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));
  const rf = ROLES.find(r => r.id === role) || {};
  const inp = (placeholder, key, type = 'text') => /*#__PURE__*/React.createElement("input", {
    type: type,
    value: form[key],
    onChange: e => set(key, e.target.value),
    placeholder: placeholder,
    style: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: 12,
      border: '1px solid var(--line-2)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.9rem',
      outline: 'none',
      marginBottom: 10,
      boxSizing: 'border-box'
    }
  });
  const publish = () => {
    onToast && onToast(`${role} page created!`);
    window.track && window.track('page_create', {
      role,
      handle: form.handle
    });
    onDone && onDone(role);
  };
  return /*#__PURE__*/React.createElement("div", null, step === 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      letterSpacing: '-.03em',
      marginBottom: 6
    }
  }, "Create a page."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.84rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      marginBottom: 16
    }
  }, "Your public presence on iHYPE. Pick a type."), ROLES.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    onClick: () => setRole(r.id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 14,
      border: `1px solid ${role === r.id ? r.tint + '66' : 'var(--line)'}`,
      background: role === r.id ? r.tint + '12' : 'transparent',
      marginBottom: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22
    }
  }, r.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.92rem',
      color: role === r.id ? r.tint : 'var(--ink)'
    }
  }, r.id), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, r.desc)), role === r.id && /*#__PURE__*/React.createElement("span", {
    style: {
      color: r.tint
    }
  }, "\u2713"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => role && setStep(1),
    disabled: !role,
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      border: 'none',
      background: role ? rf.tint : 'var(--bg-3)',
      color: role ? '#fff' : 'var(--ink-3)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: role ? 'pointer' : 'default',
      marginTop: 6
    }
  }, "Continue \u2192")), step === 1 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(0),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer',
      marginBottom: 14,
      letterSpacing: '.04em',
      padding: 0
    }
  }, "\u2190 Back"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 14,
      color: rf.tint
    }
  }, rf.icon, " ", role, " page"), inp('Display name', 'name'), inp('@handle', 'handle'), inp('Bio (one line)', 'bio'), inp('City', 'city'), role === 'Artist' && inp('Genre / style', 'genre'), role === 'Venue' && inp('Capacity (e.g. 300)', 'capacity', 'number'), /*#__PURE__*/React.createElement("button", {
    onClick: () => form.name && form.handle && setStep(2),
    disabled: !form.name || !form.handle,
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      border: 'none',
      background: form.name && form.handle ? rf.tint : 'var(--bg-3)',
      color: form.name && form.handle ? '#fff' : 'var(--ink-3)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: form.name && form.handle ? 'pointer' : 'default'
    }
  }, "Preview \u2192")), step === 2 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(1),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer',
      marginBottom: 14,
      letterSpacing: '.04em',
      padding: 0
    }
  }, "\u2190 Edit"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 16,
      border: `1px solid ${rf.tint}44`,
      background: `${rf.tint}08`,
      padding: '18px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 13,
      background: `linear-gradient(135deg,${rf.tint}88,${rf.tint}22)`,
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      color: '#fff',
      flexShrink: 0
    }
  }, form.name[0] || rf.icon), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem'
    }
  }, form.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "@", form.handle, " \xB7 ", role, form.city ? ' · ' + form.city : ''))), form.bio && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.84rem',
      color: 'var(--ink-2)',
      lineHeight: 1.5
    }
  }, form.bio)), (role === 'Artist' || role === 'Venue') && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '13px 16px',
      borderRadius: 14,
      border: `1px solid ${rf.tint}33`,
      background: `${rf.tint}06`,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '2rem',
      color: rf.tint,
      lineHeight: 1
    }
  }, role === 'Artist' ? '70%' : '20%'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.74rem',
      color: 'var(--ink-2)',
      marginTop: 5,
      lineHeight: 1.5
    }
  }, "of every ticket, locked in charter. iHYPE takes nothing from your split.")), /*#__PURE__*/React.createElement("button", {
    onClick: publish,
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      border: 'none',
      background: rf.tint,
      color: '#fff',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.96rem',
      cursor: 'pointer',
      boxShadow: `0 6px 22px ${rf.tint}44`
    }
  }, "Publish ", role, " page \u2192"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)',
      marginTop: 10,
      textAlign: 'center',
      lineHeight: 1.5
    }
  }, "Beta: this is a simulated publish. Real pages go live after verification.")));
}
function DJPublicProfile({
  dj,
  onBack
}) {
  const shows = [{
    id: 'rs1',
    title: 'Late Coast — Ep. 04',
    duration: '30:20',
    listeners: 1240,
    date: 'Jun 20'
  }, {
    id: 'rs2',
    title: 'Late Coast — Ep. 03',
    duration: '28:14',
    listeners: 980,
    date: 'Jun 13'
  }, {
    id: 'rs3',
    title: 'Late Coast — Ep. 02',
    duration: '31:05',
    listeners: 740,
    date: 'Jun 6'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer',
      padding: '0 0 14px',
      letterSpacing: '.04em'
    }
  }, "\u2190 Browse"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 16,
      background: `linear-gradient(135deg,${dj.tint}88,${dj.tint}22)`,
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.4rem',
      color: '#fff',
      flexShrink: 0
    }
  }, dj.name[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem'
    }
  }, dj.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, dj.handle, " \xB7 DJ \xB7 ", dj.stat)), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '7px 16px',
      borderRadius: 999,
      border: `1px solid ${dj.tint}55`,
      background: `${dj.tint}12`,
      color: dj.tint,
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.8rem',
      cursor: 'pointer'
    }
  }, "Follow")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 12
    }
  }, "Radio shows"), shows.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '.8rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 11,
      background: `linear-gradient(135deg,${dj.tint}66,${dj.tint}22)`,
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: dj.tint,
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "10,8 16,12 10,16",
    fill: dj.tint,
    stroke: "none"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '.86rem'
    }
  }, s.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, s.duration, " \xB7 ", s.listeners.toLocaleString(), " plays \xB7 ", s.date)))));
}
function BrowsePages() {
  const pages = [{
    name: 'Midnight Echo',
    role: 'Artist',
    handle: '@midnightecho',
    tint: '#ff5029',
    stat: '4,821 hypes'
  }, {
    name: 'DJ Caro',
    role: 'DJ',
    handle: '@djcaro',
    tint: '#ff3e9a',
    stat: '2.4K listeners'
  }, {
    name: 'The Echo',
    role: 'Venue',
    handle: '@theecho',
    tint: '#22e5d4',
    stat: '24 events hosted'
  }, {
    name: 'Nyla',
    role: 'Artist',
    handle: '@nyla',
    tint: '#22e5d4',
    stat: '1,320 hypes'
  }, {
    name: 'Robin Vega',
    role: 'Fan',
    handle: '@robinv',
    tint: '#b983ff',
    stat: '$82.40 earned'
  }];
  const [q, setQ] = React.useState('');
  const [viewing, setViewing] = React.useState(null);
  const results = q ? pages.filter(p => (p.name + p.role + p.handle).toLowerCase().includes(q.toLowerCase())) : pages;
  if (viewing) return /*#__PURE__*/React.createElement(DJPublicProfile, {
    dj: viewing,
    onBack: () => setViewing(null)
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search fans, DJs, artists, venues\u2026",
    style: {
      width: '100%',
      padding: '10px 14px 10px 38px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem',
      outline: 'none',
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("svg", {
    style: {
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--ink-3)'
    },
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.35-4.35"
  }))), results.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.handle,
    onClick: () => p.role === 'DJ' && setViewing(p),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '.75rem 0',
      borderBottom: '1px solid var(--line-2)',
      cursor: p.role === 'DJ' ? 'pointer' : 'default'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 11,
      background: `linear-gradient(135deg,${p.tint}88,${p.tint}22)`,
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      color: '#fff'
    }
  }, p.name[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem'
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, p.role, " \xB7 ", p.stat, p.role === 'DJ' ? ' · tap to view shows' : '')), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
    },
    style: {
      padding: '6px 14px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-m)',
      fontSize: '.75rem',
      cursor: 'pointer'
    }
  }, "Follow"))));
}
function ProfileHeader({
  pageRole,
  onSwitchRole
}) {
  const prefs = window.IHYPE_USER_PREFS || {};
  const roleColors = {
    Fan: '#b983ff',
    DJ: '#ff3e9a',
    Artist: '#ff5029',
    Venue: '#22e5d4'
  };
  const roleIcons = {
    Fan: '🎶',
    DJ: '📻',
    Artist: '🎤',
    Venue: '🏛️'
  };
  const tint = roleColors[pageRole] || '#b983ff';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0 16px',
      marginBottom: 8,
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      background: `linear-gradient(135deg,${tint}88,${tint}22)`,
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.3rem',
      color: '#fff'
    }
  }, (prefs.displayName || 'R')[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      letterSpacing: '-.01em'
    }
  }, prefs.displayName || 'Robin Vega'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, "@", prefs.handle || 'robinv', " \xB7 ", prefs.city || 'Los Angeles')), /*#__PURE__*/React.createElement("button", {
    onClick: onSwitchRole,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 12px',
      borderRadius: 999,
      border: `1px solid ${tint}44`,
      background: `${tint}12`,
      color: tint,
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", null, roleIcons[pageRole]), " ", pageRole, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .6,
      fontSize: '.8rem'
    }
  }, "\u2304")));
}
function RoleSwitcherSheet({
  open,
  currentRole,
  onClose,
  onSwitch
}) {
  if (!open) return null;
  const roles = [{
    id: 'Fan',
    icon: '🎶',
    color: '#b983ff',
    desc: 'Discover, hype, earn referrals'
  }, {
    id: 'DJ',
    icon: '📻',
    color: '#ff3e9a',
    desc: 'Radio studio + promoter tools'
  }, {
    id: 'Artist',
    icon: '🎤',
    color: '#ff5029',
    desc: '70% split + tour creator'
  }, {
    id: 'Venue',
    icon: '🏛️',
    color: '#22e5d4',
    desc: 'Event creator + door mgmt'
  }];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--bg-2)',
      borderRadius: '20px 20px 0 0',
      padding: '20px 16px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line-2)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 14
    }
  }, "Switch role"), roles.map(r => {
    const on = r.id === currentRole;
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      onClick: () => {
        onSwitch(r.id);
        onClose();
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '12px 14px',
        borderRadius: 14,
        border: `1px solid ${on ? r.color + '66' : 'var(--line)'}`,
        background: on ? r.color + '14' : 'transparent',
        marginBottom: 8,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22,
        flexShrink: 0
      }
    }, r.icon), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.92rem',
        color: on ? r.color : 'var(--ink)'
      }
    }, r.id), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.72rem',
        color: 'var(--ink-3)',
        marginTop: 2
      }
    }, r.desc)), on && /*#__PURE__*/React.createElement("span", {
      style: {
        color: r.color,
        fontSize: '.9rem'
      }
    }, "\u2713"));
  })));
}
function PagesTab({
  onToast
}) {
  const [sub, setSub] = React.useState('mypage');
  const prefs = window.IHYPE_USER_PREFS || {};
  const [userPages] = React.useState(['Fan', 'Artist']);
  const [pageRole, setPageRole] = React.useState(prefs.role ? prefs.role.charAt(0).toUpperCase() + prefs.role.slice(1) : 'Fan');
  const [roleSwitcher, setRoleSwitcher] = React.useState(false);
  const handleSwitchRole = newRole => {
    setPageRole(newRole);
    const updated = {
      ...(window.IHYPE_USER_PREFS || {}),
      role: newRole.toLowerCase()
    };
    window.IHYPE_USER_PREFS = updated;
    try {
      localStorage.setItem('ihype_onboarded_v2', JSON.stringify(updated));
    } catch (e) {}
    onToast && onToast(`Switched to ${newRole} view`);
  };
  const roleComponents = {
    Fan: FanPage,
    DJ: DJPage,
    Artist: ArtistPage,
    Venue: VenuePage
  };
  const MyPageComp = roleComponents[pageRole] || FanPage;
  const subs = [['mypage', 'My Page'], ['browse', 'Browse'], ['create', 'Create']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(RoleSwitcherSheet, {
    open: roleSwitcher,
    currentRole: pageRole,
    onClose: () => setRoleSwitcher(false),
    onSwitch: handleSwitchRole
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      padding: '0 1.15rem',
      overflowX: 'auto',
      flexShrink: 0,
      borderBottom: '1px solid var(--line)'
    }
  }, subs.map(([id, label]) => {
    const on = sub === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => setSub(id),
      style: {
        flexShrink: 0,
        padding: '10px 14px 8px',
        borderRadius: 0,
        border: 'none',
        borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent',
        background: 'transparent',
        color: on ? 'var(--ink)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.75rem',
        letterSpacing: '.04em',
        fontWeight: on ? 700 : 500,
        cursor: 'pointer'
      }
    }, label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '1rem 1.15rem 1.5rem'
    }
  }, sub === 'mypage' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ProfileHeader, {
    pageRole: pageRole,
    onSwitchRole: () => setRoleSwitcher(true)
  }), /*#__PURE__*/React.createElement(MyPageComp, {
    onToast: onToast
  })), sub === 'browse' && /*#__PURE__*/React.createElement(BrowsePages, null), sub === 'create' && /*#__PURE__*/React.createElement(CreatePageFlow, {
    onToast: onToast,
    onDone: r => {
      handleSwitchRole(r);
      setSub('mypage');
    }
  })));
}
Object.assign(window, {
  PagesTab
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/PagesTab.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/RadioShowCreator.jsx
try { (() => {
// RadioShowCreator.jsx — DJ Radio Show Studio
// Screens: Library → Crate → Studio

const SFX_PADS = [{
  id: 'scratch',
  label: 'Scratch',
  tint: '#b983ff'
}, {
  id: 'horn',
  label: 'Air Horn',
  tint: '#ff5029'
}, {
  id: 'drop',
  label: 'Bass Drop',
  tint: '#22e5d4'
}, {
  id: 'crowd',
  label: 'Crowd',
  tint: '#ffb84a'
}, {
  id: 'laser',
  label: 'Laser',
  tint: '#5b8cff'
}, {
  id: 'snare',
  label: 'Snare',
  tint: '#ff3e9a'
}, {
  id: 'sweep',
  label: 'Sweep',
  tint: '#22e5d4'
}, {
  id: 'bell',
  label: 'Bell',
  tint: '#ffb84a'
}, {
  id: 'kick',
  label: 'Kick',
  tint: '#ff5029'
}, {
  id: 'rewind',
  label: 'Rewind',
  tint: '#b983ff'
}, {
  id: 'foghorn',
  label: 'Foghorn',
  tint: '#5b8cff'
}, {
  id: 'static',
  label: 'Static',
  tint: '#888'
}];
const GENRES = ['All', 'Dream-Pop', 'Electronic', 'R&B', 'Ambient', 'Hip-Hop', 'Indie', 'Lo-Fi', 'Shoegaze'];

// ── Web Audio SFX ────────────────────────────────────────────────────────────
let _actx = null;
function getACtx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}
function playSFX(id) {
  try {
    const ctx = getACtx(),
      now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.7;
    out.connect(ctx.destination);
    const osc = (type, freq) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      return o;
    };
    const noise = dur => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      return s;
    };
    const env = (g, peak, dur, delay = 0) => {
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(peak, now + delay + 0.02);
      g.gain.linearRampToValueAtTime(0, now + delay + dur);
    };
    switch (id) {
      case 'scratch':
        {
          const o = osc('sawtooth', 600),
            g = ctx.createGain();
          o.frequency.linearRampToValueAtTime(200, now + .15);
          o.frequency.linearRampToValueAtTime(900, now + .28);
          o.frequency.linearRampToValueAtTime(200, now + .4);
          env(g, .8, .42);
          o.connect(g);
          g.connect(out);
          o.start(now);
          o.stop(now + .45);
          break;
        }
      case 'horn':
        {
          const o = osc('sawtooth', 233),
            o2 = osc('sawtooth', 350),
            g = ctx.createGain();
          env(g, .55, .8);
          [o, o2].forEach(x => {
            x.connect(g);
            x.start(now);
            x.stop(now + .85);
          });
          g.connect(out);
          break;
        }
      case 'drop':
        {
          const o = osc('sine', 80),
            g = ctx.createGain();
          o.frequency.exponentialRampToValueAtTime(35, now + .5);
          env(g, 1, .55);
          o.connect(g);
          g.connect(out);
          o.start(now);
          o.stop(now + .6);
          break;
        }
      case 'crowd':
        {
          const n = noise(1.5),
            g = ctx.createGain(),
            f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 3500;
          env(g, .7, 1.5);
          n.connect(f);
          f.connect(g);
          g.connect(out);
          n.start(now);
          break;
        }
      case 'laser':
        {
          const o = osc('sine', 1400),
            g = ctx.createGain();
          o.frequency.exponentialRampToValueAtTime(80, now + .4);
          env(g, .8, .42);
          o.connect(g);
          g.connect(out);
          o.start(now);
          o.stop(now + .45);
          break;
        }
      case 'snare':
        {
          const n = noise(.15),
            g = ctx.createGain(),
            f = ctx.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 1500;
          env(g, .9, .18);
          n.connect(f);
          f.connect(g);
          g.connect(out);
          n.start(now);
          break;
        }
      case 'sweep':
        {
          const o = osc('sawtooth', 80),
            g = ctx.createGain();
          o.frequency.exponentialRampToValueAtTime(2200, now + .8);
          env(g, .5, .82);
          o.connect(g);
          g.connect(out);
          o.start(now);
          o.stop(now + .85);
          break;
        }
      case 'bell':
        {
          const o = osc('sine', 880),
            g = ctx.createGain();
          g.gain.setValueAtTime(.8, now);
          g.gain.exponentialRampToValueAtTime(.001, now + 1.5);
          o.connect(g);
          g.connect(out);
          o.start(now);
          o.stop(now + 1.6);
          break;
        }
      case 'kick':
        {
          const o = osc('sine', 200),
            g = ctx.createGain();
          o.frequency.exponentialRampToValueAtTime(30, now + .3);
          g.gain.setValueAtTime(1, now);
          g.gain.exponentialRampToValueAtTime(.001, now + .32);
          o.connect(g);
          g.connect(out);
          o.start(now);
          o.stop(now + .35);
          break;
        }
      case 'rewind':
        {
          const o = osc('sawtooth', 500),
            g = ctx.createGain();
          o.frequency.linearRampToValueAtTime(40, now + .55);
          env(g, .6, .58);
          o.connect(g);
          g.connect(out);
          o.start(now);
          o.stop(now + .6);
          break;
        }
      case 'foghorn':
        {
          const o = osc('sine', 98),
            o2 = osc('sine', 73),
            g = ctx.createGain();
          env(g, .7, 1.0);
          [o, o2].forEach(x => {
            x.connect(g);
            x.start(now);
            x.stop(now + 1.05);
          });
          g.connect(out);
          break;
        }
      case 'static':
        {
          const n = noise(.25),
            g = ctx.createGain();
          env(g, .45, .28);
          n.connect(g);
          g.connect(out);
          n.start(now);
          break;
        }
    }
  } catch (e) {
    console.warn('SFX error', e);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function lenToSecs(len) {
  const [m, s] = (len || '3:00').split(':');
  return +m * 60 + +s;
}
function secsToMin(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
function totalDur(blocks) {
  return blocks.reduce((a, b) => a + (b.secs || lenToSecs(b.len || '3:00')), 0);
}
let _blockId = 1;
function mkBlock(type, label, secs, tint, meta = {}) {
  return {
    _id: _blockId++,
    type,
    label,
    secs,
    tint,
    ...meta
  };
}

// ── Library Screen ───────────────────────────────────────────────────────────
function LibraryScreen({
  crate,
  onAddToCrate,
  onRemoveFromCrate
}) {
  const [q, setQ] = React.useState('');
  const [genre, setGenre] = React.useState('All');
  const lib = window.IHYPE_DATA.freeUseLibrary || [];
  const crateIds = crate.map(c => c.id);
  const filtered = lib.filter(s => (genre === 'All' || s.genre === genre) && (!q || s.t.toLowerCase().includes(q.toLowerCase()) || s.a.toLowerCase().includes(q.toLowerCase())));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px 10px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(255,255,255,.06)',
      borderRadius: 12,
      padding: '9px 12px',
      border: '1px solid rgba(185,131,255,.15)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)',
      fontSize: 14
    }
  }, "\uD83D\uDD0D"), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search free-use tracks\u2026",
    style: {
      flex: 1,
      background: 'none',
      border: 'none',
      outline: 'none',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem'
    }
  }), q && /*#__PURE__*/React.createElement("button", {
    onClick: () => setQ(''),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 14
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: '0 14px 10px',
      overflowX: 'auto',
      flexShrink: 0,
      scrollbarWidth: 'none'
    }
  }, GENRES.map(g => /*#__PURE__*/React.createElement("button", {
    key: g,
    onClick: () => setGenre(g),
    style: {
      flexShrink: 0,
      padding: '5px 12px',
      borderRadius: 999,
      border: `1px solid ${genre === g ? '#b983ff' : 'rgba(255,255,255,.1)'}`,
      background: genre === g ? 'rgba(185,131,255,.15)' : 'transparent',
      color: genre === g ? '#b983ff' : 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      cursor: 'pointer',
      letterSpacing: '.06em',
      fontWeight: genre === g ? 700 : 400
    }
  }, g))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 14px 10px',
      padding: '7px 12px',
      borderRadius: 10,
      background: 'rgba(185,131,255,.07)',
      border: '1px solid rgba(185,131,255,.15)',
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      color: 'rgba(185,131,255,.8)',
      letterSpacing: '.04em'
    }
  }, "\u2713 All tracks below are licensed for free use by artists on iHYPE."), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 14px 14px'
    }
  }, filtered.map(s => {
    const inCrate = crateIds.includes(s.id);
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,.05)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 42,
        height: 42,
        borderRadius: 10,
        background: `linear-gradient(135deg,${s.tint}88,${s.tint}22)`,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '1rem',
        color: 'rgba(255,255,255,.7)'
      }
    }, s.bpm), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.9rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, s.t), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.72rem',
        color: 'var(--ink-3)'
      }
    }, s.a, " \xB7 ", s.genre, " \xB7 ", s.len)), /*#__PURE__*/React.createElement("button", {
      onClick: () => inCrate ? onRemoveFromCrate(s.id) : onAddToCrate(s),
      style: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: `1px solid ${inCrate ? 'rgba(34,229,212,.4)' : 'rgba(185,131,255,.35)'}`,
        background: inCrate ? 'rgba(34,229,212,.1)' : 'rgba(185,131,255,.1)',
        color: inCrate ? '#22e5d4' : '#b983ff',
        fontSize: 16,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        flexShrink: 0,
        transition: 'all .15s'
      }
    }, inCrate ? '✓' : '+'));
  }), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '2rem',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem'
    }
  }, "No tracks match your search.")));
}

// ── Crate Screen ─────────────────────────────────────────────────────────────
function CrateScreen({
  crate,
  setCrate,
  onGoStudio
}) {
  const move = (i, dir) => setCrate(c => {
    const a = [...c];
    const t = a[i];
    a[i] = a[i + dir];
    a[i + dir] = t;
    return a;
  });
  const remove = id => setCrate(c => c.filter(s => s.id !== id));
  const total = crate.reduce((a, s) => a + lenToSecs(s.len || s.length || '3:00'), 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px 10px',
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      letterSpacing: '.08em',
      textTransform: 'uppercase'
    }
  }, crate.length, " tracks \xB7 ", Math.floor(total / 60), "m total"), /*#__PURE__*/React.createElement("button", {
    onClick: onGoStudio,
    disabled: crate.length === 0,
    style: {
      padding: '7px 16px',
      borderRadius: 999,
      background: crate.length ? '#b983ff' : 'var(--bg-3)',
      color: crate.length ? '#fff' : 'var(--ink-3)',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.82rem',
      cursor: crate.length ? 'pointer' : 'default'
    }
  }, "Open Studio \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 14px 14px'
    }
  }, crate.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '3rem 1rem',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      lineHeight: 1.6
    }
  }, "Your crate is empty.", /*#__PURE__*/React.createElement("br", null), "Browse the library and add tracks."), crate.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 0',
      borderBottom: '1px solid rgba(255,255,255,.05)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => i > 0 && move(i, -1),
    disabled: i === 0,
    style: {
      background: 'none',
      border: 'none',
      color: i === 0 ? 'rgba(255,255,255,.1)' : 'var(--ink-3)',
      cursor: i === 0 ? 'default' : 'pointer',
      fontSize: 11,
      padding: 0,
      lineHeight: 1
    }
  }, "\u25B2"), /*#__PURE__*/React.createElement("button", {
    onClick: () => i < crate.length - 1 && move(i, 1),
    disabled: i === crate.length - 1,
    style: {
      background: 'none',
      border: 'none',
      color: i === crate.length - 1 ? 'rgba(255,255,255,.1)' : 'var(--ink-3)',
      cursor: i === crate.length - 1 ? 'default' : 'pointer',
      fontSize: 11,
      padding: 0,
      lineHeight: 1
    }
  }, "\u25BC")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 9,
      background: `linear-gradient(135deg,${s.tint || '#b983ff'}88,${s.tint || '#b983ff'}22)`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, s.a, " \xB7 ", s.len)), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(s.id),
    style: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,80,41,.5)',
      cursor: 'pointer',
      fontSize: 18,
      flexShrink: 0,
      lineHeight: 1
    }
  }, "\xD7")))));
}

// ── Studio Screen ────────────────────────────────────────────────────────────
function StudioScreen({
  crate,
  showTitle,
  setShowTitle,
  onPublish
}) {
  const [timeline, setTimeline] = React.useState([]);
  const [recording, setRecording] = React.useState(false);
  const [recSecs, setRecSecs] = React.useState(0);
  const [activePad, setActivePad] = React.useState(null);
  const [playing, setPlaying] = React.useState(false);
  const [waveVals, setWaveVals] = React.useState(() => Array(20).fill(0.2));
  const [micDenied, setMicDenied] = React.useState(false);
  const timerRef = React.useRef(null);
  const waveRef = React.useRef(null);
  const recorderRef = React.useRef(null);
  const timelineRef = React.useRef(null);
  const addBlock = block => {
    setTimeline(t => [...t, block]);
    setTimeout(() => {
      if (timelineRef.current) timelineRef.current.scrollLeft = 99999;
    }, 50);
  };
  const removeBlock = id => setTimeline(t => t.filter(b => b._id !== id));

  // Voice recording
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const mr = new MediaRecorder(stream);
      recorderRef.current = {
        mr,
        stream
      };
      mr.start();
      setRecording(true);
      setRecSecs(0);
      timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
      waveRef.current = setInterval(() => setWaveVals(Array.from({
        length: 20
      }, () => 0.15 + Math.random() * 0.85)), 80);
    } catch (e) {
      setMicDenied(true);
      setTimeout(() => setMicDenied(false), 4000);
    }
  };
  const stopRec = () => {
    const {
      mr,
      stream
    } = recorderRef.current || {};
    if (mr && mr.state !== 'inactive') {
      mr.stop();
      stream.getTracks().forEach(t => t.stop());
    }
    clearInterval(timerRef.current);
    clearInterval(waveRef.current);
    const dur = recSecs || 5;
    addBlock(mkBlock('voice', `Voice (${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')})`, dur, '#ff5029'));
    setRecording(false);
    setWaveVals(Array(20).fill(0.2));
  };

  // Total show duration
  const showDur = totalDur(timeline);
  const TARGET_MINS = showDur < 1800 ? 30 : showDur < 3600 ? 60 : 90;
  const durPct = Math.min(100, showDur / (TARGET_MINS * 60) * 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px 8px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: showTitle,
    onChange: e => setShowTitle(e.target.value),
    style: {
      width: '100%',
      background: 'none',
      border: 'none',
      outline: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.3rem',
      letterSpacing: '-.03em',
      color: 'var(--ink)',
      boxSizing: 'border-box'
    },
    placeholder: "Untitled Show"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      background: 'rgba(255,255,255,.08)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: durPct + '%',
      borderRadius: 999,
      background: `linear-gradient(90deg,#b983ff,${durPct >= 100 ? '#22e5d4' : '#5b8cff'})`,
      transition: 'width .4s ease'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)',
      letterSpacing: '.04em',
      flexShrink: 0
    }
  }, Math.floor(showDur / 60), "m / ", TARGET_MINS, "m target"))), /*#__PURE__*/React.createElement("div", {
    ref: timelineRef,
    style: {
      display: 'flex',
      gap: 4,
      padding: '8px 14px',
      overflowX: 'auto',
      flexShrink: 0,
      scrollbarWidth: 'none',
      minHeight: 58,
      alignItems: 'center',
      background: 'rgba(0,0,0,.25)',
      borderTop: '1px solid rgba(255,255,255,.06)',
      borderBottom: '1px solid rgba(255,255,255,.06)'
    }
  }, timeline.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'rgba(255,255,255,.18)',
      letterSpacing: '.08em',
      whiteSpace: 'nowrap'
    }
  }, "Add songs, record your voice, or hit a pad \u2192"), timeline.map(b => {
    const w = Math.max(40, Math.min(140, b.secs / totalDur(timeline) * 320));
    return /*#__PURE__*/React.createElement("div", {
      key: b._id,
      onClick: () => removeBlock(b._id),
      title: "Tap to remove",
      style: {
        flexShrink: 0,
        width: w,
        height: 42,
        borderRadius: 8,
        background: `linear-gradient(135deg,${b.tint}cc,${b.tint}55)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '4px 6px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        opacity: .15,
        backgroundImage: `repeating-linear-gradient(90deg,rgba(255,255,255,.3) 0px,rgba(255,255,255,.3) 1px,transparent 1px,transparent ${b.type === 'sfx' ? 8 : 20}px)`
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.55rem',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,.9)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'relative'
      }
    }, b.label));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 14px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16,
      padding: '14px',
      borderRadius: 16,
      background: 'rgba(255,80,41,.06)',
      border: '1px solid rgba(255,80,41,.15)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'rgba(255,80,41,.7)'
    }
  }, "Voice Track"), micDenied && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.72rem',
      color: '#ffb84a',
      textAlign: 'center',
      lineHeight: 1.5,
      padding: '4px 8px'
    }
  }, "Microphone blocked. Enable mic access in your browser settings to record a voice intro \u2014 you can still build a show with songs + SFX."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      height: 40,
      width: '100%',
      justifyContent: 'center'
    }
  }, waveVals.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 4,
      borderRadius: 999,
      background: recording ? '#ff5029' : 'rgba(255,80,41,.25)',
      height: v * 40,
      transition: recording ? 'height .08s' : 'height .3s'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, recording && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.88rem',
      color: '#ff5029',
      letterSpacing: '.06em'
    }
  }, "\u25CF ", Math.floor(recSecs / 60), ":", String(recSecs % 60).padStart(2, '0')), /*#__PURE__*/React.createElement("button", {
    onClick: recording ? stopRec : startRec,
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      border: `3px solid ${recording ? '#ff5029' : 'rgba(255,80,41,.4)'}`,
      background: recording ? 'rgba(255,80,41,.15)' : 'rgba(255,80,41,.08)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
      boxShadow: recording ? '0 0 24px rgba(255,80,41,.4)' : 'none',
      transition: 'all .2s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: recording ? 20 : 24,
      height: recording ? 20 : 24,
      borderRadius: recording ? 4 : '50%',
      background: '#ff5029',
      transition: 'all .2s'
    }
  })), recording && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, "Tap to stop"))), crate.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14,
      padding: '16px',
      borderRadius: 16,
      background: 'rgba(185,131,255,.06)',
      border: '1px dashed rgba(185,131,255,.25)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      marginBottom: 6
    }
  }, "Your crate is empty"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.78rem',
      color: 'var(--ink-3)',
      marginBottom: 12,
      lineHeight: 1.5
    }
  }, "Browse free-use tracks and add them to your crate first."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setTab('library'),
    style: {
      padding: '8px 20px',
      borderRadius: 999,
      background: 'rgba(185,131,255,.15)',
      border: '1px solid rgba(185,131,255,.35)',
      color: '#b983ff',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Browse Library \u2192")), crate.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Add from Crate"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      scrollbarWidth: 'none',
      paddingBottom: 4
    }
  }, crate.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    onClick: () => addBlock(mkBlock('song', s.t, lenToSecs(s.len || '3:00'), s.tint || '#b983ff', {
      artist: s.a
    })),
    style: {
      flexShrink: 0,
      padding: '7px 12px',
      borderRadius: 10,
      border: `1px solid ${s.tint || '#b983ff'}44`,
      background: `${s.tint || '#b983ff'}11`,
      color: 'var(--ink)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: s.tint || '#b983ff',
      marginBottom: 2
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '.65rem',
      color: 'var(--ink-3)'
    }
  }, s.len))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Sound Effects"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 7
    }
  }, SFX_PADS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onPointerDown: () => {
      playSFX(p.id);
      setActivePad(p.id);
      addBlock(mkBlock('sfx', p.label, 2, p.tint));
      setTimeout(() => setActivePad(null), 200);
    },
    style: {
      aspectRatio: '1',
      borderRadius: 12,
      border: `1px solid ${p.tint}44`,
      background: activePad === p.id ? `${p.tint}44` : `${p.tint}11`,
      color: p.tint,
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.04em',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      fontWeight: 700,
      boxShadow: activePad === p.id ? `0 0 14px ${p.tint}66` : 'none',
      transition: 'all .1s',
      transform: activePad === p.id ? 'scale(.94)' : 'scale(1)',
      lineHeight: 1.3
    }
  }, p.label)))), timeline.length >= 2 && /*#__PURE__*/React.createElement("button", {
    onClick: () => onPublish(timeline),
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: 'linear-gradient(90deg,#b983ff,#5b8cff)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      cursor: 'pointer',
      letterSpacing: '.02em',
      boxShadow: '0 4px 24px rgba(185,131,255,.35)'
    }
  }, "Publish Radio Show \u2192")));
}

// ── Root component ────────────────────────────────────────────────────────────
function RadioShowCreator({
  initialCrate,
  onClose,
  onToast
}) {
  const [tab, setTab] = React.useState('library');
  const [crate, setCrate] = React.useState(initialCrate || []);
  const [showTitle, setShowTitle] = React.useState('My Radio Show');
  const [published, setPublished] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(null);
  const addToCrate = s => setCrate(c => c.find(x => x.id === s.id) ? c : [...c, s]);
  const removeFromCrate = id => setCrate(c => c.filter(x => x.id !== id));
  const publish = timeline => {
    const songs = timeline.filter(b => b.type === 'song');
    const voices = timeline.filter(b => b.type === 'voice');
    const sfx = timeline.filter(b => b.type === 'sfx');
    const dur = totalDur(timeline);
    setAnalytics({
      songs: songs.length,
      voices: voices.length,
      sfx: sfx.length,
      dur,
      reach: Math.round(dur / 60 * 340 + Math.random() * 200)
    });
    setPublished(true);
    onToast && onToast('Radio show published! 🎙️');
  };
  const TABS = [{
    id: 'library',
    label: 'Library',
    icon: '🎵'
  }, {
    id: 'crate',
    label: `Crate (${crate.length})`,
    icon: '📦'
  }, {
    id: 'studio',
    label: 'Studio',
    icon: '🎙'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 90,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 14px 8px',
      flexShrink: 0,
      borderBottom: '1px solid rgba(255,255,255,.06)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 22,
      lineHeight: 1,
      padding: '0 4px'
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      letterSpacing: '-.02em'
    }
  }, "Radio Show Creator"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: '#b983ff'
    }
  }, "DJ Studio")), published && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 12px',
      borderRadius: 999,
      background: 'rgba(185,131,255,.15)',
      border: '1px solid rgba(185,131,255,.3)',
      color: '#b983ff',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem'
    }
  }, "Published \u2713")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderBottom: '1px solid rgba(255,255,255,.06)',
      flexShrink: 0
    }
  }, TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => setTab(t.id),
    style: {
      flex: 1,
      padding: '10px 4px',
      border: 'none',
      background: 'none',
      color: tab === t.id ? '#b983ff' : 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      cursor: 'pointer',
      borderBottom: `2px solid ${tab === t.id ? '#b983ff' : 'transparent'}`,
      transition: 'all .15s',
      letterSpacing: '.04em'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 2
    }
  }, t.icon), t.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, tab === 'library' && /*#__PURE__*/React.createElement(LibraryScreen, {
    crate: crate,
    onAddToCrate: addToCrate,
    onRemoveFromCrate: removeFromCrate
  }), tab === 'crate' && /*#__PURE__*/React.createElement(CrateScreen, {
    crate: crate,
    setCrate: setCrate,
    onGoStudio: () => setTab('studio')
  }), analytics && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 91,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      gap: 16,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 52
    }
  }, "\uD83D\uDCFB"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 900,
      fontSize: '1.4rem',
      letterSpacing: '-.03em'
    }
  }, showTitle || 'Your Show', " is live!"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      width: '100%',
      maxWidth: 280
    }
  }, [['🎵', 'Songs', analytics.songs], ['🎙', 'Voices', analytics.voices], ['🥁', 'SFX', analytics.sfx], ['👥', 'Est. Reach', analytics.reach]].map(([ic, lb, v]) => /*#__PURE__*/React.createElement("div", {
    key: lb,
    style: {
      padding: '12px',
      borderRadius: 14,
      background: 'rgba(185,131,255,.08)',
      border: '1px solid rgba(185,131,255,.18)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      marginBottom: 4
    }
  }, ic), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      color: '#b983ff'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)',
      letterSpacing: '.08em',
      textTransform: 'uppercase'
    }
  }, lb)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      lineHeight: 1.6
    }
  }, "Total runtime: ", Math.floor(analytics.dur / 60), "m ", analytics.dur % 60, "s"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      padding: '12px 28px',
      borderRadius: 999,
      background: 'linear-gradient(90deg,#b983ff,#5b8cff)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: 'pointer'
    }
  }, "Done \u2713")), tab === 'studio' && /*#__PURE__*/React.createElement(StudioScreen, {
    crate: crate,
    showTitle: showTitle,
    setShowTitle: setShowTitle,
    onPublish: publish
  })));
}
Object.assign(window, {
  RadioShowCreator
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/RadioShowCreator.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/Seeds.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// iHYPE Seeds — swipe discovery
// Swipe right = hype · left = skip · up = save
const HeartIcon = () => /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
}));
const SEEDS = [{
  artist: 'Nyla',
  track: 'Goldenrod',
  tags: ['r&b', 'neo-soul'],
  hype: 318,
  city: 'Los Angeles',
  g: ['#22e5d4', '#7c5cff'],
  show: {
    artist: 'Nyla',
    event: 'Basement Tapes: Late Set',
    date: 'Sat Jun 21 · 11:00 PM',
    price: 15,
    tint: '#22e5d4',
    id: 's3'
  }
}, {
  artist: 'Wax Tropic',
  track: 'Heatwave',
  tags: ['synth-pop', 'disco'],
  hype: 642,
  city: 'Oakland',
  g: ['#b983ff', '#ff3e9a'],
  show: {
    artist: 'Wax Tropic',
    event: 'Zebulon',
    date: 'Sat Jun 21 · 8:30 PM',
    price: 22,
    tint: '#b983ff',
    id: 's2'
  }
}, {
  artist: 'Midnight Echo',
  track: 'Carousel',
  tags: ['dream-pop', 'shoegaze'],
  hype: 1284,
  city: 'Los Angeles',
  g: ['#ff5029', '#ff3e9a'],
  show: {
    artist: 'Midnight Echo',
    event: 'Live at The Echo',
    date: 'Fri Jun 20 · 9:00 PM',
    price: 18,
    tint: '#ff5029',
    id: 's1'
  }
}, {
  artist: 'Sunroom',
  track: 'Paper Cup',
  tags: ['indie', 'lo-fi'],
  hype: 877,
  city: 'San Diego',
  g: ['#ffb84a', '#ff5029'],
  show: {
    artist: 'Sunroom',
    event: 'Album Release',
    date: 'Sun Jun 22 · 7:00 PM',
    price: 20,
    tint: '#ffb84a',
    id: 's4'
  }
}, {
  artist: 'Cold Harbor',
  track: 'Tidewater',
  tags: ['post-punk'],
  hype: 205,
  city: 'Long Beach',
  g: ['#39d8df', '#22e5d4']
}];
function SeedsScreen({
  onIdxChange
}) {
  const ordered = React.useMemo(() => {
    const g = (() => {
      try {
        return JSON.parse(localStorage.getItem('ihype_onboarded_v2') || '{}').genres || [];
      } catch (e) {
        return [];
      }
    })();
    if (!g.length) return SEEDS;
    return [...SEEDS].sort((a, b) => (b.tags || []).some(t => g.includes(t)) - (a.tags || []).some(t => g.includes(t)));
  }, []);
  const [idx, setIdx] = React.useState(() => parseInt(localStorage.getItem('ihype_seeds_idx') || '0', 10));
  const [drag, setDrag] = React.useState({
    x: 0,
    y: 0,
    active: false
  });
  const [flash, setFlash] = React.useState(null);
  const [saved, setSaved] = React.useState(0);
  const [hyped, setHyped] = React.useState(0);
  const [burst, setBurst] = React.useState(0);
  const start = React.useRef(null);
  React.useEffect(() => {
    if (!document.getElementById('ihype-burst-css')) {
      const s = document.createElement('style');
      s.id = 'ihype-burst-css';
      s.textContent = '@keyframes ihype-ring{0%{transform:translate(-50%,-50%) scale(.35);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}} @keyframes cardShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(s);
    }
  }, []);

  // Expose for persistence
  React.useEffect(() => {
    window._seedsSetIdx = setIdx;
  }, []);
  React.useEffect(() => {
    onIdxChange && onIdxChange(idx);
  }, [idx]);
  const card = ordered[idx % ordered.length];
  const next = ordered[(idx + 1) % ordered.length];
  function decideLabel(x, y) {
    if (y < -90) return 'save';
    if (x > 90) return 'hype';
    if (x < -90) return 'skip';
    return null;
  }
  function onDown(e) {
    start.current = {
      x: e.clientX,
      y: e.clientY
    };
    setDrag({
      x: 0,
      y: 0,
      active: true
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    setDrag({
      x,
      y,
      active: true
    });
    setFlash(decideLabel(x, y));
  }
  function onUp() {
    if (!start.current) return;
    const decision = decideLabel(drag.x, drag.y);
    start.current = null;
    if (decision) commit(decision);else {
      setDrag({
        x: 0,
        y: 0,
        active: false
      });
      setFlash(null);
    }
  }
  function commit(decision) {
    if (decision === 'hype') {
      const bridge = window.IHYPE_HYPE_BRIDGE;
      if (bridge && !bridge.canSpend()) {
        bridge.onEmpty && bridge.onEmpty();
        setDrag({
          x: 0,
          y: 0,
          active: false
        });
        setFlash(null);
        return;
      }
    }
    const off = decision === 'hype' ? {
      x: 600,
      y: 40
    } : decision === 'skip' ? {
      x: -600,
      y: 40
    } : {
      x: 0,
      y: -700
    };
    setDrag({
      ...off,
      active: false
    });
    if (decision === 'hype') {
      setHyped(h => h + 1);
      setBurst(b => b + 1);
      window.mHaptic && window.mHaptic();
      navigator.vibrate && navigator.vibrate([30, 10, 20]);
      window.IHYPE_HYPE_BRIDGE && window.IHYPE_HYPE_BRIDGE.spend && window.IHYPE_HYPE_BRIDGE.spend();
      if (card.show) {
        const m = card.show;
        setTimeout(() => window.dispatchEvent(new CustomEvent('ihype-seed-match', {
          detail: m
        })), 360);
      }
    }
    if (decision === 'save') {
      setSaved(s => s + 1);
      navigator.vibrate && navigator.vibrate(15);
    }
    setTimeout(() => {
      setIdx(i => i + 1);
      setDrag({
        x: 0,
        y: 0,
        active: false
      });
      setFlash(null);
    }, 240);
  }
  const rot = drag.x / 18;
  const [hinted, setHinted] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setHinted(true), 1800);
    return () => clearTimeout(t);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.5rem 1.1rem 0.75rem'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 900,
      letterSpacing: '-.04em',
      fontSize: '1rem',
      color: 'var(--ink)'
    }
  }, "iHYPE"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: 'var(--f-m)',
      fontSize: 10,
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#22e5d4",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 20h10M10 20c0-7 4-9 6-11M10 20c0-6-2-8-4-10"
  })), " Seeds"), /*#__PURE__*/React.createElement("button", {
    "aria-label": "Saved",
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: '1px solid var(--line-2)',
      background: 'transparent',
      color: 'var(--ink)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(HeartIcon, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      margin: '0 1.1rem'
    }
  }, /*#__PURE__*/React.createElement(SeedCard, {
    card: next,
    style: {
      transform: 'scale(0.94) translateY(10px)',
      opacity: 0.6
    }
  }), burst > 0 && /*#__PURE__*/React.createElement("div", {
    key: burst,
    style: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 180,
      height: 180,
      borderRadius: '50%',
      border: '2.5px solid var(--accent)',
      pointerEvents: 'none',
      zIndex: 20,
      animation: 'ihype-ring .6s cubic-bezier(.2,.8,.3,1) forwards',
      boxShadow: '0 0 24px rgba(255,80,41,.35)'
    }
  }), !hinted && !drag.active && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 0 32px',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28,
      background: 'rgba(10,8,5,.72)',
      backdropFilter: 'blur(8px)',
      borderRadius: 999,
      padding: '10px 20px',
      border: '1px solid rgba(255,255,255,.1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: 11,
      letterSpacing: '.04em',
      color: 'var(--ink-3)'
    }
  }, "\u2190 skip"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: 11,
      letterSpacing: '.04em',
      color: '#22e5d4'
    }
  }, "\u2191 save"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: 11,
      letterSpacing: '.04em',
      color: 'var(--accent)'
    }
  }, "hype \u2192"))), /*#__PURE__*/React.createElement(SeedCard, {
    card: card,
    flash: flash,
    shimmer: !hinted && !drag.active,
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    style: {
      transform: `translate(${drag.x}px,${drag.y}px) rotate(${rot}deg)`,
      transition: drag.active ? 'none' : 'transform .24s cubic-bezier(.4,0,.2,1)',
      cursor: 'grab',
      touchAction: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      marginBottom: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      fontFamily: 'var(--f-m)',
      fontSize: 10,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      whiteSpace: 'nowrap',
      animation: 'marquee 18s linear infinite'
    }
  }, [...Array(2)].map((_, ri) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: ri
  }, ['🔥 MIDNIGHT ECHO', '↑ GOLDENROD — NYLA', '● LIVE AT THE ECHO TONIGHT', '🎟 WAX TROPIC SAT', '↑ CAROUSEL #1 LA'].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      marginRight: 32
    }
  }, t)))), /*#__PURE__*/React.createElement("style", null, '@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 18,
      padding: '1rem 0 0.5rem'
    }
  }, /*#__PURE__*/React.createElement(CircleBtn, {
    icon: "x",
    sub: "skip",
    color: "var(--ink-3)",
    onClick: () => commit('skip')
  }), /*#__PURE__*/React.createElement(CircleBtn, {
    icon: "arrowUp",
    sub: "save",
    color: "#22e5d4",
    onClick: () => commit('save')
  }), /*#__PURE__*/React.createElement(CircleBtn, {
    icon: "flame",
    sub: "hype",
    color: "var(--accent)",
    big: true,
    onClick: () => commit('hype')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      padding: '0.25rem 0 0.9rem',
      fontFamily: 'var(--f-m)',
      fontSize: 11,
      color: 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--accent)'
    }
  }, hyped), " hyped"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#22e5d4'
    }
  }, saved), " saved")));
}
function SeedCard({
  card,
  flash,
  style,
  shimmer,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 24,
      overflow: 'hidden',
      border: '1px solid var(--line-2)',
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      background: `linear-gradient(160deg,${card.g[0]},${card.g[1]})`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      userSelect: 'none',
      ...style
    }
  }), shimmer && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,.18) 50%,transparent 60%)',
      backgroundSize: '200% 100%',
      animation: 'cardShimmer 1.6s ease-in-out infinite',
      zIndex: 5,
      pointerEvents: 'none',
      borderRadius: 24
    }
  }), flash && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 24,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      padding: '0.4rem 1rem',
      borderRadius: 12,
      color: '#fff',
      border: '2px solid #fff',
      background: flash === 'hype' ? 'rgba(255,80,41,.35)' : flash === 'save' ? 'rgba(34,229,212,.35)' : 'rgba(0,0,0,.35)'
    }
  }, flash === 'hype' ? 'Hype' : flash === 'save' ? 'Save' : 'Skip')), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '40%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: 'rgba(0,0,0,.32)',
      backdropFilter: 'blur(4px)',
      display: 'grid',
      placeItems: 'center',
      color: '#fff',
      border: '1px solid rgba(255,255,255,.4)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "#fff"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "6,3 20,12 6,21"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1.25rem',
      background: 'linear-gradient(to top,rgba(0,0,0,.55),transparent)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 8,
      flexWrap: 'wrap'
    }
  }, card.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '.08em',
      color: '#fff',
      background: 'rgba(0,0,0,.3)',
      border: '1px solid rgba(255,255,255,.3)',
      borderRadius: 999,
      padding: '3px 9px'
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: 28,
      letterSpacing: '-.03em',
      color: '#fff',
      lineHeight: 1
    }
  }, card.track), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: 15,
      color: 'rgba(255,255,255,.92)',
      marginTop: 4
    }
  }, card.artist, " \xB7 ", card.city), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: 'var(--f-m)',
      fontSize: 11,
      color: 'rgba(255,255,255,.8)',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "#fff"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2c1 3-1 5-3 6 1-3.5 0-5.5-1-6.5C8 5 7 7 8 9 6 7.5 6 5 7 4 5 6 4 10 6.5 12.5 7 13 7 15 8 16a4 4 0 1 0 8 0c0-4-2-6-4-14z"
  })), " ", card.hype.toLocaleString(), " hype \xB7 0:30 preview")));
}
function CircleBtn({
  icon,
  sub,
  color,
  big,
  onClick
}) {
  const s = big ? 64 : 52;
  const [pr, setPr] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onPointerDown: () => setPr(true),
    onPointerUp: () => {
      setPr(false);
      onClick && onClick();
    },
    onPointerLeave: () => setPr(false),
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 5,
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: s,
      height: s,
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      color: big ? '#fff' : color,
      background: big ? 'var(--accent)' : 'var(--bg-3)',
      border: `1px solid ${big ? 'transparent' : 'var(--line-2)'}`,
      boxShadow: big ? `0 4px ${pr ? '30px' : '20px'} rgba(255,80,41,${pr ? .55 : .35})` : 'none',
      transform: pr ? 'scale(.88)' : 'scale(1)',
      transition: 'transform .1s ease, box-shadow .1s ease'
    }
  }, icon === 'flame' && /*#__PURE__*/React.createElement("svg", {
    width: big ? 26 : 20,
    height: big ? 26 : 20,
    viewBox: "0 0 24 24",
    fill: big ? '#fff' : color
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2c1 3-1 5-3 6 1-3.5 0-5.5-1-6.5C8 5 7 7 8 9 6 7.5 6 5 7 4 5 6 4 10 6.5 12.5 7 13 7 15 8 16a4 4 0 1 0 8 0c0-4-2-6-4-14z"
  })), icon === 'x' && /*#__PURE__*/React.createElement("svg", {
    width: big ? 26 : 20,
    height: big ? 26 : 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: big ? '#fff' : color,
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })), icon === 'arrowUp' && /*#__PURE__*/React.createElement("svg", {
    width: big ? 26 : 20,
    height: big ? 26 : 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: big ? '#fff' : color,
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "19",
    x2: "12",
    y2: "5"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "5,12 12,5 19,12"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: 10,
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, sub));
}
window.SeedsScreen = SeedsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/Seeds.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/Sheets.jsx
try { (() => {
// iHYPE Sheets — all modal overlays, exported to window

function TourCreatorSheet({
  open,
  onClose
}) {
  const [shows, setShows] = React.useState([{
    venue: '',
    date: '',
    price: 18
  }]);
  const add = () => setShows(s => [...s, {
    venue: '',
    date: '',
    price: 18
  }]);
  const update = (i, k, v) => setShows(s => s.map((x, j) => j === i ? {
    ...x,
    [k]: v
  } : x));
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem',
      maxHeight: '85%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 16px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 4
    }
  }, "Tour Creator"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)',
      marginBottom: 18
    }
  }, "Add shows. Each becomes an event with 70% split \u2014 automatic."), shows.map((sh, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '1rem',
      borderRadius: 14,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Show ", i + 1), /*#__PURE__*/React.createElement("input", {
    value: sh.venue,
    onChange: e => update(i, 'venue', e.target.value),
    placeholder: "Venue name",
    style: {
      width: '100%',
      padding: '9px 12px',
      borderRadius: 9,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: sh.date,
    onChange: e => update(i, 'date', e.target.value),
    placeholder: "Date (e.g. Fri Jun 28)",
    style: {
      width: '100%',
      padding: '9px 12px',
      borderRadius: 9,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)'
    }
  }, "Price $"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: sh.price,
    onChange: e => update(i, 'price', +e.target.value),
    min: 5,
    max: 200,
    style: {
      width: 70,
      padding: '9px 12px',
      borderRadius: 9,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: '#22e5d4'
    }
  }, "\u2192 $", (sh.price * .70).toFixed(2), " artist")))), /*#__PURE__*/React.createElement("button", {
    onClick: add,
    style: {
      width: '100%',
      padding: '10px',
      borderRadius: 12,
      border: '1px dashed var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer',
      marginBottom: 14
    }
  }, "+ Add show"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: 'pointer'
    }
  }, "Create tour \u2192")));
}
function RadioSchedulerSheet({
  open,
  onClose
}) {
  const [name, setName] = React.useState('');
  const [day, setDay] = React.useState('Friday');
  const [genre, setGenre] = React.useState('lo-fi');
  if (!open) return null;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const GENRES = ['lo-fi', 'r&b', 'electronic', 'hip-hop', 'jazz', 'dream-pop', 'folk', 'punk'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 16px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 4
    }
  }, "Schedule a show"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)',
      marginBottom: 16
    }
  }, "Set a recurring slot. Listeners get notified before each broadcast."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 6
    }
  }, "Show name"), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Late Night Frequencies",
    style: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: 10,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem',
      outline: 'none',
      boxSizing: 'border-box'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Day"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 14
    }
  }, DAYS.map(d => {
    const on = day === d;
    return /*#__PURE__*/React.createElement("button", {
      key: d,
      onClick: () => setDay(d),
      style: {
        flex: 1,
        padding: '6px 2px',
        borderRadius: 8,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.1)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.7rem',
        cursor: 'pointer',
        fontWeight: on ? 700 : 500
      }
    }, d);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Genre"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 16
    }
  }, GENRES.map(g => {
    const on = genre === g;
    return /*#__PURE__*/React.createElement("button", {
      key: g,
      onClick: () => setGenre(g),
      style: {
        padding: '5px 12px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.1)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--ink-3)',
        fontFamily: 'var(--f-m)',
        fontSize: '.72rem',
        cursor: 'pointer',
        fontWeight: on ? 700 : 500
      }
    }, g);
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => name && onClose(),
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: name ? 'var(--accent)' : 'var(--bg-3)',
      color: name ? '#fff' : 'var(--ink-3)',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: name ? 'pointer' : 'default'
    }
  }, "Schedule show \u2192")));
}
function LiveEventOverlay({
  event,
  onClose
}) {
  const [hyped, setHyped] = React.useState(0);
  const [checkedIn, setCheckedIn] = React.useState(false);
  const [pulse, setPulse] = React.useState(1284);
  React.useEffect(() => {
    if (!event) return;
    const t = setInterval(() => setPulse(p => p + Math.floor(Math.random() * 3)), 3000);
    return () => clearInterval(t);
  }, [event]);
  if (!event) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.25rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      background: 'linear-gradient(90deg,#ff5029,#ff3e9a,#b983ff,#22e5d4)',
      borderRadius: 999,
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#ff3c3c',
      display: 'inline-block'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: '#ff3c3c'
    }
  }, "Live now")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 22,
      padding: 0,
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.8rem',
      letterSpacing: '-.04em',
      lineHeight: .95,
      marginBottom: 6
    }
  }, event.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      color: 'var(--ink-3)',
      marginBottom: 20
    }
  }, event.venue, " \xB7 doors open"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '1rem',
      borderRadius: 14,
      border: '1px solid rgba(255,60,60,.2)',
      background: 'rgba(255,60,60,.06)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.5rem',
      color: '#ff3c3c'
    }
  }, pulse.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, "Live hypes")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '1rem',
      borderRadius: 14,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.5rem',
      color: 'var(--accent)'
    }
  }, "218"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, "Tickets"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: 14,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 8
    }
  }, "Live hype feed"), ['@robinv hyped this show 🔥', '@jaysmith just bought a ticket', '@nocturnalwave shared your link', '@mx.lo hyped this show 🔥', '@dana.k just checked in'].map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.78rem',
      color: 'var(--ink-2)',
      padding: '.4rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, item))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setHyped(h => h + 1),
    style: {
      flex: 1,
      padding: '11px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "\uD83D\uDD25 Hype \xB7 ", (1284 + hyped).toLocaleString()), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCheckedIn(true),
    style: {
      flex: 1,
      padding: '11px',
      borderRadius: 999,
      background: checkedIn ? 'rgba(34,229,212,.15)' : 'transparent',
      color: checkedIn ? '#22e5d4' : 'var(--ink-2)',
      border: `1px solid ${checkedIn ? 'rgba(34,229,212,.3)' : 'var(--line)'}`,
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, checkedIn ? '✓ Here' : "I'm here")));
}
function PostPurchaseMoment({
  show,
  onClose
}) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (!show) return;
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 900);
    const t3 = setTimeout(() => setStep(3), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [show]);
  const [sparks] = React.useState(() => Array.from({
    length: 18
  }, (_, i) => ({
    x: 30 + Math.random() * 40,
    delay: i * 60,
    rot: Math.random() * 360,
    color: ['#ff5029', '#b983ff', '#22e5d4', '#ffb84a'][i % 4]
  })));
  if (!show) return null;
  const cells = [{
    amt: '$12.60',
    pct: '70%',
    who: 'Artist',
    color: '#ff5029',
    show: step >= 1
  }, {
    amt: '$3.60',
    pct: '20%',
    who: 'Venue',
    color: '#22e5d4',
    show: step >= 2
  }, {
    amt: '$1.80',
    pct: '10%',
    who: 'Promoters',
    color: '#b983ff',
    show: step >= 3
  }, {
    amt: '$0.00',
    pct: '0%',
    who: 'iHYPE',
    color: '#22e5d4',
    show: step >= 3
  }, {
    amt: '+$0.82',
    pct: 'card fee',
    who: 'Stripe (at cost)',
    color: '#5a5048',
    show: step >= 3
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 95,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      overflow: 'hidden'
    }
  }, sparks.map((sp, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      top: '-5%',
      left: sp.x + '%',
      width: 8,
      height: 8,
      borderRadius: sp.x % 3 === 0 ? '50%' : 2,
      background: sp.color,
      animation: `confettiFall 1.4s ease-in ${sp.delay}ms both`,
      pointerEvents: 'none'
    }
  })), /*#__PURE__*/React.createElement("style", null, '@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(120vh) rotate(720deg);opacity:0}}'), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 16,
      background: 'rgba(34,229,212,.12)',
      border: '2px solid #22e5d4',
      display: 'grid',
      placeItems: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#22e5d4",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.6rem',
      letterSpacing: '-.03em',
      marginBottom: 6
    }
  }, "You're in."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      marginBottom: 28,
      textAlign: 'center'
    }
  }, "Here's where your $18 went."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
      gap: 2,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 45,
      background: '#ff5029',
      borderRadius: '999px 0 0 999px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 45,
      background: '#22e5d4'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 10,
      background: '#b983ff',
      borderRadius: '0 999px 999px 0'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, cells.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.who,
    style: {
      padding: '10px 12px',
      borderRadius: 13,
      border: `1px solid ${c.color}33`,
      background: `${c.color}0d`,
      transition: 'opacity .3s, transform .3s',
      opacity: c.show ? 1 : 0,
      transform: c.show ? 'translateY(0)' : 'translateY(10px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.3rem',
      color: c.color,
      lineHeight: 1
    }
  }, c.amt), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, c.pct, " \xB7 ", c.who))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: '#22e5d4',
      marginBottom: 20
    }
  }, "iHYPE takes nothing \xB7 locked in charter"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: 'pointer'
    }
  }, "View my ticket \u2192"));
}
function NotifPrimer({
  show,
  onAllow,
  onSkip
}) {
  if (!show) return null;
  const handleAllow = () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(p => {
        onAllow && onAllow(p);
      });
    } else {
      onAllow && onAllow('granted');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 90,
      background: 'rgba(0,0,0,.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.5rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 50,
      height: 50,
      borderRadius: 14,
      background: 'rgba(255,80,41,.12)',
      border: '1px solid rgba(255,80,41,.25)',
      display: 'grid',
      placeItems: 'center',
      margin: '0 auto 16px',
      fontSize: 24
    }
  }, "\uD83D\uDD14"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      letterSpacing: '-.03em',
      textAlign: 'center',
      marginBottom: 8
    }
  }, "Know first."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      textAlign: 'center',
      marginBottom: 24,
      maxWidth: '34ch',
      margin: '0 auto 24px'
    }
  }, "Get notified when artists you've hyped drop tickets \u2014 before anyone else."), /*#__PURE__*/React.createElement("button", {
    onClick: onAllow,
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: 'pointer',
      marginBottom: 10
    }
  }, "Allow notifications"), /*#__PURE__*/React.createElement("button", {
    onClick: onSkip,
    style: {
      width: '100%',
      padding: '11px',
      borderRadius: 999,
      background: 'transparent',
      color: 'var(--ink-3)',
      border: 'none',
      fontFamily: 'var(--f-m)',
      fontSize: '.85rem',
      cursor: 'pointer'
    }
  }, "Not now")));
}
function PostShowRating({
  show,
  onClose
}) {
  const [rating, setRating] = React.useState(0);
  const [done, setDone] = React.useState(false);
  if (!show) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 85,
      background: 'rgba(0,0,0,.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.5rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), !done ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      marginBottom: 4
    }
  }, "How was the show?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)'
    }
  }, show.artist, " \xB7 ", show.venue)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 24
    }
  }, [1, 2, 3, 4, 5].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    onClick: () => setRating(n),
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      border: `2px solid ${rating >= n ? 'var(--accent)' : 'var(--line)'}`,
      background: rating >= n ? 'rgba(255,80,41,.12)' : 'transparent',
      fontSize: 20,
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    }
  }, rating >= n ? '🔥' : '☆'))), /*#__PURE__*/React.createElement("button", {
    onClick: () => rating && setDone(true),
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: rating ? 'var(--accent)' : 'var(--bg-3)',
      color: rating ? '#fff' : 'var(--ink-3)',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: rating ? 'pointer' : 'default'
    }
  }, "Submit rating"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 8,
      padding: '10px',
      borderRadius: 999,
      border: 'none',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Skip")) : /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '1rem 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 12
    }
  }, "\uD83D\uDD25"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 8
    }
  }, "Thanks."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      marginBottom: 16
    }
  }, "Your rating helps ", show.artist, " show up on the demand radar."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      window.openIHYPEMemoryCard && window.openIHYPEMemoryCard(show);
      onClose();
    },
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: 'pointer',
      marginBottom: 8
    }
  }, "Get your memory card \uD83C\uDFAB"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      padding: '10px',
      borderRadius: 999,
      border: 'none',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Skip"))));
}
function TicketTransferSheet({
  open,
  onClose
}) {
  const [val, setVal] = React.useState('');
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 16px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 6
    }
  }, "Transfer ticket"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)',
      marginBottom: 18
    }
  }, "Midnight Echo \xB7 The Echo \xB7 Fri Jun 20"), /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => setVal(e.target.value),
    placeholder: "Phone number or email",
    style: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem',
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => val && onClose(),
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: 'pointer'
    }
  }, "Send transfer"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 8,
      padding: '10px',
      borderRadius: 999,
      border: 'none',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Cancel")));
}
function RequestSheet({
  open,
  onClose
}) {
  const [artist, setArtist] = React.useState('');
  const [venue, setVenue] = React.useState('');
  const [sent, setSent] = React.useState(false);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 16px'
    }
  }), !sent ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 6
    }
  }, "Request an artist"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      marginBottom: 18
    }
  }, "Enough requests unlock a booking offer from the venue to the artist via the demand radar."), [['Artist', artist, setArtist, 'Midnight Echo'], ['Venue', venue, setVenue, 'The Echo, Zebulon…']].map(([lbl, val, set, ph]) => /*#__PURE__*/React.createElement("div", {
    key: lbl,
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 6
    }
  }, lbl), /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => set(e.target.value),
    placeholder: ph,
    style: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem',
      outline: 'none',
      boxSizing: 'border-box'
    }
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => artist && venue && setSent(true),
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: artist && venue ? 'var(--accent)' : 'var(--bg-3)',
      color: artist && venue ? '#fff' : 'var(--ink-3)',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: artist && venue ? 'pointer' : 'default'
    }
  }, "Send request \u2192")) : /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '1rem 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 14
    }
  }, "\uD83D\uDD25"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      marginBottom: 8
    }
  }, "Request sent."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      marginBottom: 20
    }
  }, artist, " at ", venue, ". When enough fans request this show, the venue gets notified."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setSent(false);
      onClose();
    },
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: 'pointer'
    }
  }, "Done"))));
}
function ArtistAnalyticsSheet({
  open,
  onClose
}) {
  if (!open) return null;
  const plays = [8400, 12100, 9800, 14200];
  const maxP = Math.max(...plays);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem',
      maxHeight: '85%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 18
    }
  }, "Analytics \xB7 Midnight Echo"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1rem',
      borderRadius: 14,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 10
    }
  }, "Seeds performance"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8
    }
  }, [['68%', 'Swipe right', 'var(--accent)'], ['18%', 'Swipe up', '#22e5d4'], ['14%', 'Swipe left', 'var(--ink-3)']].map(([v, l, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.3rem',
      color: c,
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1rem',
      borderRadius: 14,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 12
    }
  }, "Plays \xB7 last 4 weeks"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      height: 80
    }
  }, plays.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.6rem',
      color: 'var(--ink-3)'
    }
  }, (v / 1000).toFixed(1), "K"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      background: 'var(--accent)',
      borderRadius: '4px 4px 0 0',
      height: Math.round(v / maxP * 60) + 'px',
      opacity: .85
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.62rem',
      color: 'var(--ink-3)'
    }
  }, "W", i + 1))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1rem',
      borderRadius: 14,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 10
    }
  }, "Top cities"), [['Los Angeles', '62%'], ['New York', '18%'], ['Chicago', '8%'], ['Austin', '7%']].map(([city, pct]) => /*#__PURE__*/React.createElement("div", {
    key: city,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem'
    }
  }, city), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 5,
      borderRadius: 999,
      background: 'var(--bg-2)',
      overflow: 'hidden',
      marginRight: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: pct,
      background: 'var(--accent)',
      borderRadius: 999
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      minWidth: 28,
      textAlign: 'right'
    }
  }, pct)))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 14,
      padding: '11px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Done")));
}
function InviteSheet({
  open,
  onClose,
  onToast
}) {
  const [copied, setCopied] = React.useState(false);
  const link = 'https://ihype.app/join?ref=me';
  const share = async () => {
    const text = 'Join iHYPE — music, events, and zero fees. Early access:';
    const url = link;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'iHYPE',
          text,
          url
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {}
    } else {
      navigator.clipboard && navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast && onToast('Invite link copied!');
    }
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.5rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 20px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 10
    }
  }, "\uD83C\uDFB6"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.2rem',
      letterSpacing: '-.03em',
      marginBottom: 8
    }
  }, "Invite a friend."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      maxWidth: '34ch',
      margin: '0 auto'
    }
  }, "They get early access. If they buy a ticket, you both earn from the 10% promoter pool.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      borderRadius: 14,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)',
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, link), /*#__PURE__*/React.createElement("button", {
    onClick: copy,
    style: {
      padding: '6px 14px',
      borderRadius: 999,
      background: copied ? 'rgba(34,229,212,.15)' : 'rgba(255,80,41,.1)',
      border: `1px solid ${copied ? 'rgba(34,229,212,.3)' : 'rgba(255,80,41,.25)'}`,
      color: copied ? '#22e5d4' : 'var(--accent)',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      cursor: 'pointer',
      flexShrink: 0,
      fontWeight: 700
    }
  }, copied ? '✓ Copied' : 'Copy')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: share,
    style: {
      flex: 1,
      padding: '12px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Share invite"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      flex: 1,
      padding: '12px',
      borderRadius: 999,
      background: 'transparent',
      color: 'var(--ink-2)',
      border: '1px solid var(--line)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Done"))));
}
const FAQ = [{
  q: 'Why is iHYPE free?',
  a: "Our founding charter prohibits iHYPE from taking a cut of ticket sales. It's structural — not a marketing choice."
}, {
  q: 'How does the 70/20/10 split work?',
  a: "Every ticket: 70% to the artist, 20% to the venue, 10% to the promoter pool — split among everyone whose referral link drove a purchase. iHYPE takes 0% — the only extra charge is the unavoidable card-processing fee (2.9% + $0.30; AMEX 3.5% + $0.30), passed through at cost."
}, {
  q: 'How do I earn from referrals?',
  a: "Share any event link via the share button on an event card. When someone buys through your link, you earn your proportional share of the 10% promoter pool."
}, {
  q: 'How does artist verification work?',
  a: "Create an Artist, DJ, or Venue page in Pages → Create. Submit proof of identity — the iHYPE team reviews within 48 hours."
}, {
  q: 'When do artists get paid?',
  a: 'Payouts are processed same night as the show, automatically. Artists see the full breakdown in Pages → My Page → Artist.'
}];
function HelpSheet({
  open,
  onClose
}) {
  const [expanded, setExpanded] = React.useState(null);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem',
      maxHeight: '85%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 18
    }
  }, "Help & FAQ"), FAQ.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setExpanded(expanded === i ? null : i),
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      padding: '.85rem 0',
      background: 'none',
      border: 'none',
      color: 'var(--ink)',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-b)',
      fontWeight: 700,
      fontSize: '.88rem',
      flex: 1,
      paddingRight: 12
    }
  }, f.q), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)',
      fontSize: 16,
      flexShrink: 0
    }
  }, expanded === i ? '−' : '+')), expanded === i && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      color: 'var(--ink-2)',
      lineHeight: 1.65,
      paddingBottom: '1rem'
    }
  }, f.a))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 16,
      padding: '11px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Done")));
}
function ChangelogSheet({
  open,
  onClose
}) {
  if (!open) return null;
  const entries = [{
    v: '0.1.0-beta.5',
    d: 'Jun 22, 2026',
    items: ['Closed-beta invite gate + skip-to-demo fast path', 'Settings: reset app data', 'Feedback widget captures screen + bug severity', 'Graceful mic-permission fallback in Radio Studio', 'Guided live demo walkthrough']
  }, {
    v: '0.1.0-beta.4',
    d: 'Jun 20, 2026',
    items: ['3-tab architecture: Listen · Events · Pages', 'Seeds swipe deck with gesture hint', 'Checkout with TM price comparison', 'Post-purchase 70/20/10 payout reveal', 'Notification primer after first ticket purchase']
  }, {
    v: '0.1.0-beta.3',
    d: 'Jun 13, 2026',
    items: ['Media player mini-bar (top) with play/pause', 'Onboarding: role → city → genres', 'Notification center with bell icon', 'Charts with period filter']
  }, {
    v: '0.1.0-beta.2',
    d: 'Jun 6, 2026',
    items: ['4-platform preview: Desktop · Mobile · iOS · Android', 'Distance chips on event cards', 'Referral link share + clipboard', 'Beta feedback widget']
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem',
      maxHeight: '80%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem'
    }
  }, "What's new"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      padding: '3px 10px',
      borderRadius: 999,
      background: 'rgba(255,184,74,.1)',
      border: '1px solid rgba(255,184,74,.25)',
      color: '#ffb84a'
    }
  }, "Beta")), entries.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.v,
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem'
    }
  }, e.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, e.d)), e.items.map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 8,
      padding: '.45rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'var(--accent)',
      flexShrink: 0,
      marginTop: 8
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      color: 'var(--ink-2)',
      lineHeight: 1.5
    }
  }, item))))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 8,
      padding: '11px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Done")));
}
function SettingsSheet({
  open,
  onClose
}) {
  const [notifs, setNotifs] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('ihype_theme') !== 'light');
  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (window.toggleIHYPETheme) window.toggleIHYPETheme();
  };
  if (!open) return null;
  const rows = [{
    label: 'Notifications',
    sub: 'Ticket drops, referrals, live shows',
    ctrl: 'toggle',
    val: notifs,
    set: setNotifs
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem',
      maxHeight: '80%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 18
    }
  }, "Settings"), rows.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '.85rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: '.9rem'
    }
  }, r.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, r.sub)), /*#__PURE__*/React.createElement("button", {
    onClick: () => r.set(v => !v),
    style: {
      width: 42,
      height: 25,
      borderRadius: 999,
      background: r.val ? 'var(--accent)' : 'var(--bg-3)',
      border: r.val ? 'none' : '1px solid var(--line)',
      cursor: 'pointer',
      position: 'relative',
      flexShrink: 0,
      transition: 'background .2s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: r.val ? 19 : 2,
      width: 21,
      height: 21,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left .2s',
      boxShadow: '0 1px 4px rgba(0,0,0,.3)'
    }
  })))), [['Invite a friend', () => {
    onClose();
    setTimeout(() => window.openIHYPEInvite && window.openIHYPEInvite(), 200);
  }], ["What's new", () => {
    onClose();
    setTimeout(() => window.openIHYPEChangelog && window.openIHYPEChangelog(), 200);
  }], ['Help & FAQ', () => {
    onClose();
    setTimeout(() => window.openIHYPEHelp && window.openIHYPEHelp(), 200);
  }], ['Linked payment', null, 'Apple Pay ✓'], ['Terms of Service', () => window.open('https://ihype.app/terms', '_blank')], ['Privacy Policy', () => window.open('https://ihype.app/privacy', '_blank')]].map(([label, action, note]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '.85rem 0',
      borderBottom: '1px solid var(--line-2)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.9rem'
    }
  }, label), action ? /*#__PURE__*/React.createElement("button", {
    onClick: action,
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.8rem',
      color: 'var(--accent)',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  }, "Open \u2192") : /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.8rem',
      color: 'var(--ink-3)'
    }
  }, note))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '.85rem 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, "iHYPE 0.1.0-beta.5 \xB7 Jun 2026"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: '#ffb84a',
      padding: '2px 8px',
      borderRadius: 999,
      background: 'rgba(255,184,74,.1)',
      border: '1px solid rgba(255,184,74,.2)'
    }
  }, "Beta")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (confirm('Reset all local data and restart the app? This clears your onboarding, tickets, and preferences.')) {
        const plat = localStorage.getItem('ihype_platform');
        localStorage.clear();
        if (plat) localStorage.setItem('ihype_platform', plat);
        location.reload();
      }
    },
    style: {
      width: '100%',
      marginTop: 8,
      padding: '11px',
      borderRadius: 999,
      border: '1px solid rgba(255,80,41,.3)',
      background: 'rgba(255,80,41,.06)',
      color: '#ff5029',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.84rem',
      cursor: 'pointer'
    }
  }, "Reset app data"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 8,
      padding: '11px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Done")));
}
function FeedbackWidget({
  onToast
}) {
  const [open, setOpen] = React.useState(false);
  const [cat, setCat] = React.useState('idea');
  const [sev, setSev] = React.useState('medium');
  const [msg, setMsg] = React.useState('');
  const screen = () => {
    const plat = localStorage.getItem('ihype_platform') || 'ios';
    return plat;
  };
  const submit = () => {
    if (!msg.trim()) return;
    window.track && window.track('beta_feedback', {
      cat,
      sev,
      screen: screen(),
      len: msg.length
    });
    setOpen(false);
    setMsg('');
    onToast && onToast('Thanks — feedback received 🙏');
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, !open && /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(true),
    style: {
      position: 'absolute',
      bottom: 72,
      right: 12,
      zIndex: 50,
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'rgba(255,184,74,.15)',
      border: '1px solid rgba(255,184,74,.35)',
      color: '#ffb84a',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  }))), open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 72,
      right: 12,
      left: 12,
      zIndex: 60,
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      borderRadius: 18,
      padding: '1rem',
      boxShadow: '0 20px 40px rgba(0,0,0,.5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem'
    }
  }, "Beta feedback"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(false),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 18,
      padding: 0,
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 10
    }
  }, [['bug', 'Bug'], ['idea', 'Idea'], ['confusing', 'Unclear']].map(([id, lbl]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setCat(id),
    style: {
      flex: 1,
      padding: '5px',
      borderRadius: 8,
      border: `1px solid ${cat === id ? 'var(--accent)' : 'var(--line)'}`,
      background: cat === id ? 'rgba(255,80,41,.1)' : 'transparent',
      color: cat === id ? 'var(--accent)' : 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      cursor: 'pointer'
    }
  }, lbl))), /*#__PURE__*/React.createElement("textarea", {
    value: msg,
    onChange: e => setMsg(e.target.value),
    placeholder: "What's on your mind?",
    rows: 3,
    style: {
      width: '100%',
      padding: '9px 12px',
      borderRadius: 10,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.82rem',
      outline: 'none',
      resize: 'none',
      boxSizing: 'border-box'
    }
  }), cat === 'bug' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 8
    }
  }, [['low', 'Minor'], ['medium', 'Annoying'], ['high', 'Blocking']].map(([id, lbl]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setSev(id),
    style: {
      flex: 1,
      padding: '5px',
      borderRadius: 8,
      border: `1px solid ${sev === id ? '#ffb84a' : 'var(--line)'}`,
      background: sev === id ? 'rgba(255,184,74,.1)' : 'transparent',
      color: sev === id ? '#ffb84a' : 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      cursor: 'pointer'
    }
  }, lbl))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.6rem',
      color: 'var(--ink-3)',
      marginTop: 8,
      letterSpacing: '.04em'
    }
  }, "Attached: ", screen(), " screen \xB7 v0.1.0-beta.5"), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: {
      width: '100%',
      marginTop: 8,
      padding: '9px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Send feedback")));
}
const VERIFIED_APS = new Set(['Midnight Echo', 'Nyla', 'DJ Caro', 'Wax Tropic', 'Cold Harbor']);

// Animated HYPE counter (odometer-style)
function HypeCounter({
  val,
  color,
  label
}) {
  const [disp, setDisp] = React.useState(val - 120);
  React.useEffect(() => {
    let v = val - 120;
    const t = setInterval(() => {
      v = Math.min(val, v + Math.ceil((val - v) / 8) + 1);
      setDisp(v);
      if (v >= val) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [val]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      color,
      lineHeight: 1.1
    }
  }, disp.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      marginTop: 2
    }
  }, label));
}

// Artist ··· report/block menu
function ArtistMenu({
  artist
}) {
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      border: '1px solid rgba(255,255,255,.12)',
      background: 'rgba(255,255,255,.06)',
      color: 'var(--ink-2)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem'
    }
  }, "\xB7\xB7\xB7"), open && /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 40,
      right: 0,
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      borderRadius: 14,
      padding: '6px 0',
      minWidth: 160,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      zIndex: 201
    }
  }, done ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      fontFamily: 'var(--f-m)',
      fontSize: '.8rem',
      color: '#22e5d4'
    }
  }, done, " \u2713") : [['🔗 Share profile', () => {
    if (navigator.share) navigator.share({
      title: artist?.name,
      url: 'https://ihype.app/a/' + encodeURIComponent(artist?.name || '')
    });
    setOpen(false);
  }], ['🚩 Report', () => {
    setDone('Reported');
    setTimeout(() => setOpen(false), 1200);
  }], ['🚫 Block', () => {
    setDone('Blocked');
    setTimeout(() => setOpen(false), 1200);
  }]].map(([lbl, fn]) => /*#__PURE__*/React.createElement("button", {
    key: lbl,
    onClick: fn,
    style: {
      display: 'block',
      width: '100%',
      padding: '10px 14px',
      background: 'none',
      border: 'none',
      color: lbl.includes('Block') ? '#ff5029' : 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.84rem',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, lbl)))));
}
function VArtistBadge() {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: '#5b8cff',
      marginLeft: 5,
      flexShrink: 0,
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 10 10",
    fill: "none"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "2,5 4,7 8,3",
    stroke: "#fff",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
function ArtistProfileSheet({
  artist,
  onClose,
  onBuy
}) {
  const [followed, setFollowed] = React.useState(false);
  const [hyped, setHyped] = React.useState(false);
  // Swipe-back: track pointer from left edge
  const swipeRef = React.useRef(null);
  const onPD = e => {
    if (e.clientX < 28) swipeRef.current = e.clientX;
  };
  const onPU = e => {
    if (swipeRef.current !== null && e.clientX - swipeRef.current > 60) {
      swipeRef.current = null;
      onClose();
    } else swipeRef.current = null;
  };
  if (!artist) return null;
  const D = window.IHYPE_DATA;
  const shows = (D.shows || []).filter(s => s.artist === artist.name);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 75,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    onPointerDown: onPD,
    onPointerUp: onPU
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 150,
      background: `linear-gradient(160deg,${artist.tint}88,${artist.tint}18)`,
      position: 'relative',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at 30% 60%,${artist.tint}55,transparent 65%)`
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      position: 'absolute',
      top: 14,
      left: 14,
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'rgba(0,0,0,.45)',
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
      fontSize: 20,
      lineHeight: 1,
      zIndex: 2
    }
  }, "\u2039"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -24,
      left: 16,
      width: 52,
      height: 52,
      borderRadius: 14,
      background: `linear-gradient(135deg,${artist.tint},${artist.tint}88)`,
      border: '3px solid var(--bg)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.3rem',
      color: '#fff',
      zIndex: 2
    }
  }, artist.name[0])), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '34px 16px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.25rem',
      letterSpacing: '-.03em',
      display: 'flex',
      alignItems: 'center'
    }
  }, artist.name, VERIFIED_APS.has(artist.name) && /*#__PURE__*/React.createElement(VArtistBadge, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, artist.handle, " \xB7 ", artist.city)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(ArtistMenu, {
    artist: artist,
    onToast: onClose
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setHyped(h => !h);
      window.IHYPE_HYPE_BRIDGE && window.IHYPE_HYPE_BRIDGE.canSpend() && window.IHYPE_HYPE_BRIDGE.spend();
    },
    style: {
      padding: '7px 13px',
      borderRadius: 999,
      border: `1px solid ${hyped ? 'var(--accent)' : 'var(--line)'}`,
      background: hyped ? 'rgba(255,80,41,.12)' : 'transparent',
      color: hyped ? 'var(--accent)' : 'var(--ink-2)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer',
      fontWeight: 700
    }
  }, "\uD83D\uDD25 ", hyped ? 'Hyped' : 'Hype'), /*#__PURE__*/React.createElement("button", {
    onClick: () => setFollowed(f => !f),
    style: {
      padding: '7px 13px',
      borderRadius: 999,
      border: `1px solid ${followed ? 'var(--accent)' : 'var(--line)'}`,
      background: followed ? 'rgba(255,80,41,.08)' : 'transparent',
      color: followed ? 'var(--accent)' : 'var(--ink-2)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer',
      fontWeight: followed ? 700 : 500
    }
  }, followed ? 'Following' : 'Follow'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      marginBottom: 14
    }
  }, [['hypes', 'var(--accent)', true], ['listeners/mo', '#22e5d4', false], ['upcoming', 'var(--ink-2)', false]].map(([l, c, animated], ki) => {
    const vals = ['4,821', '12.4K', String(shows.length) || '1'];
    return animated ? /*#__PURE__*/React.createElement(HypeCounter, {
      key: ki,
      val: 4821,
      color: c,
      label: l
    }) : /*#__PURE__*/React.createElement("div", {
      key: ki
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '1.1rem',
        color: c,
        lineHeight: 1.1
      }
    }, vals[ki]), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.65rem',
        color: 'var(--ink-3)',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        marginTop: 2
      }
    }, l));
  }), false && [['DEAD_CODE_REMOVEDcoming', '#b983ff']].map(([v, l, c]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      color: c,
      lineHeight: 1
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.62rem',
      letterSpacing: '.07em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, l)))), artist.tags && artist.tags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 14
    }
  }, artist.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      padding: '4px 10px',
      borderRadius: 999,
      border: '1px solid var(--line-2)',
      background: 'var(--bg-2)',
      color: 'var(--ink-3)'
    }
  }, t))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      lineHeight: 1.7,
      marginBottom: 22
    }
  }, artist.bio || 'Independent artist on iHYPE.'), artist.tracks && artist.tracks.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 10
    }
  }, "Top tracks"), artist.tracks.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.t,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '.65rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      color: 'var(--ink-3)',
      minWidth: 20,
      textAlign: 'center'
    }
  }, i + 1), /*#__PURE__*/React.createElement("div", {
    onClick: () => window.setIHYPENowPlaying && window.setIHYPENowPlaying({
      t: t.t,
      a: artist.name,
      tint: artist.tint
    }),
    style: {
      width: 36,
      height: 36,
      borderRadius: 9,
      background: `linear-gradient(135deg,${artist.tint}88,${artist.tint}22)`,
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "#fff"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "5,3 19,12 5,21"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontWeight: 700,
      fontSize: '.88rem'
    }
  }, t.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, t.plays, " plays")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)'
    }
  }, t.len)))), shows.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      margin: '22px 0 10px'
    }
  }, "Upcoming shows"), shows.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '.75rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 11,
      background: `linear-gradient(135deg,${s.tint}88,${s.tint}22)`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '.88rem'
    }
  }, s.venue), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 2
    }
  }, s.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      color: 'var(--accent)'
    }
  }, "$", s.price), /*#__PURE__*/React.createElement("button", {
    onClick: () => onBuy && onBuy(s),
    style: {
      marginTop: 5,
      padding: '5px 12px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      cursor: 'pointer',
      fontWeight: 700
    }
  }, "Get ticket")))))));
}
function SeedMatchSheet({
  match,
  onClose,
  onBuy
}) {
  if (!match) return null;
  const tint = match.tint || '#ff5029';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 82,
      background: 'rgba(0,0,0,.72)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.5rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 22px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: tint,
      display: 'inline-block'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: tint
    }
  }, "Playing near you")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.5rem',
      letterSpacing: '-.04em',
      lineHeight: .95,
      marginBottom: 6
    }
  }, match.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      color: 'var(--ink-2)',
      marginBottom: 22
    }
  }, match.event, " \xB7 ", match.date), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 14px',
      borderRadius: 14,
      border: `1px solid ${tint}33`,
      background: `${tint}0d`,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginBottom: 2
    }
  }, "You hyped them \u2014 early access"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      color: tint
    }
  }, "$", match.price, " \xB7 +$0 fees")), /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: tint,
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onClose();
      onBuy && onBuy(match);
    },
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: 'pointer',
      marginBottom: 8
    }
  }, "Get ticket \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      padding: '10px',
      borderRadius: 999,
      border: 'none',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Dismiss")));
}

// ── Ticket QR Flip ──────────────────────────────────────────────────────────
function TicketQRSheet({
  ticket,
  onClose
}) {
  const [flipped, setFlipped] = React.useState(false);
  if (!ticket) return null;
  const tint = ticket.tint || '#ff5029';
  // Fake QR grid (9×9)
  const qr = React.useMemo(() => {
    const s = 81;
    const out = [];
    const corners = [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0], [0, 6], [0, 7], [0, 8], [1, 8], [2, 8], [6, 0], [7, 0], [8, 0], [8, 1], [8, 2], [6, 8], [7, 8], [8, 8], [8, 7], [8, 6]];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const isCorner = corners.some(([cr, cc]) => cr === r && cc === c);
      out.push(isCorner || Math.random() > 0.45);
    }
    return out;
  }, [ticket]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 88,
      background: 'rgba(0,0,0,.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      position: 'absolute',
      top: 20,
      right: 20,
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      fontSize: 26,
      cursor: 'pointer',
      lineHeight: 1
    }
  }, "\xD7"), /*#__PURE__*/React.createElement("div", {
    onClick: () => setFlipped(f => !f),
    style: {
      width: 280,
      height: 380,
      perspective: 1000,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      position: 'relative',
      transformStyle: 'preserve-3d',
      transition: 'transform .55s cubic-bezier(.4,0,.2,1)',
      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backfaceVisibility: 'hidden',
      borderRadius: 22,
      background: `linear-gradient(160deg,${tint}44,${tint}11)`,
      border: `1px solid ${tint}44`,
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: tint,
      marginBottom: 10
    }
  }, "\uD83C\uDF9F Your ticket"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.4rem',
      letterSpacing: '-.03em',
      lineHeight: 1,
      marginBottom: 6
    }
  }, ticket.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      marginBottom: 4
    }
  }, ticket.event), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      color: 'var(--ink-3)'
    }
  }, ticket.date), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 3,
      borderRadius: 999,
      overflow: 'hidden',
      gap: 2,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 45,
      background: '#ff5029',
      borderRadius: '999px 0 0 999px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 45,
      background: '#22e5d4'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 10,
      background: '#b983ff',
      borderRadius: '0 999px 999px 0'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)',
      opacity: .7
    }
  }, "Tap to reveal QR")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backfaceVisibility: 'hidden',
      transform: 'rotateY(180deg)',
      borderRadius: 22,
      background: '#fff',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(9,1fr)',
      gap: 3,
      marginBottom: 16
    }
  }, qr.map((on, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 24,
      height: 24,
      borderRadius: 3,
      background: on ? '#111' : 'transparent'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1rem',
      color: '#111',
      marginBottom: 4
    }
  }, ticket.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: '#666'
    }
  }, ticket.date)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      letterSpacing: '.06em'
    }
  }, "Tap ticket to flip"));
}

// ── Post-show memory card ────────────────────────────────────────────────────
function PostShowMemoryCard({
  show,
  onClose
}) {
  const [shared, setShared] = React.useState(false);
  if (!show) return null;
  const tint = show.tint || '#ff5029';
  const share = async () => {
    const text = `I was there 🔥 ${show.artist} at ${show.venue || 'the show'}. Powered by iHYPE.`;
    if (navigator.share) {
      try {
        await navigator.share({
          text,
          url: 'https://ihype.app'
        });
        setShared(true);
      } catch (e) {}
    } else {
      navigator.clipboard && navigator.clipboard.writeText(text);
      setShared(true);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 88,
      background: 'rgba(0,0,0,.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 320
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 24,
      background: `linear-gradient(160deg,${tint}55,${tint}11)`,
      border: `1px solid ${tint}33`,
      padding: '2rem 1.5rem',
      textAlign: 'center',
      marginBottom: 18,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: '50%',
      background: `${tint}18`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.18em',
      textTransform: 'uppercase',
      color: tint,
      marginBottom: 14
    }
  }, "You were there."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '2rem',
      letterSpacing: '-.04em',
      lineHeight: .95,
      marginBottom: 8
    }
  }, show.artist), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.88rem',
      color: 'var(--ink-2)',
      marginBottom: 6
    }
  }, show.venue || 'Live'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.75rem',
      color: 'var(--ink-3)',
      marginBottom: 20
    }
  }, show.date || 'Jun 20, 2026'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 18
    }
  }, [['🔥', '4,821 hypes'], ['🎟', '218 tickets'], ['💸', '$0 fees']].map(([ic, lbl]) => /*#__PURE__*/React.createElement("div", {
    key: lbl,
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      marginBottom: 4
    }
  }, ic), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.6rem',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: 'var(--ink-3)'
    }
  }, lbl)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.08em',
      color: 'rgba(255,255,255,.3)'
    }
  }, "iHYPE \xB7 powered by fans")), /*#__PURE__*/React.createElement("button", {
    onClick: share,
    style: {
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: shared ? 'rgba(34,229,212,.15)' : 'var(--accent)',
      color: shared ? '#22e5d4' : '#fff',
      border: shared ? '1px solid rgba(34,229,212,.3)' : 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      cursor: 'pointer',
      marginBottom: 10
    }
  }, shared ? '✓ Shared' : 'Share this moment'), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      padding: '10px',
      borderRadius: 999,
      border: 'none',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Done")));
}

// ── Playlist create ──────────────────────────────────────────────────────────
const TINTS = ['#ff5029', '#22e5d4', '#b983ff', '#ffb84a', '#5b8cff', '#ff3e9a'];
function PlaylistCreateSheet({
  open,
  onClose,
  onCreated
}) {
  const [name, setName] = React.useState('');
  const [tint, setTint] = React.useState(TINTS[0]);
  if (!open) return null;
  const create = () => {
    if (!name.trim()) return;
    onCreated && onCreated({
      name,
      tint
    });
    onClose();
    setName('');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 18
    }
  }, "New playlist"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 16,
      justifyContent: 'center'
    }
  }, TINTS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTint(t),
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: t,
      border: tint === t ? '3px solid #fff' : '3px solid transparent',
      cursor: 'pointer',
      boxShadow: tint === t ? `0 0 10px ${t}` : 'none',
      transition: 'all .15s'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: 16,
      background: `linear-gradient(135deg,${tint}cc,${tint}33)`,
      margin: '0 auto 18px',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.6rem',
      color: 'rgba(255,255,255,.8)'
    }
  }, name ? name[0].toUpperCase() : '+'), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && create(),
    placeholder: "Playlist name",
    style: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-b)',
      fontSize: '.9rem',
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: 16,
      textAlign: 'center'
    },
    autoFocus: true
  }), /*#__PURE__*/React.createElement("button", {
    onClick: create,
    disabled: !name.trim(),
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 999,
      background: name.trim() ? 'var(--accent)' : 'var(--bg-3)',
      color: name.trim() ? '#fff' : 'var(--ink-3)',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      cursor: name.trim() ? 'pointer' : 'default'
    }
  }, "Create playlist")));
}

// ── Friend activity feed ─────────────────────────────────────────────────────
function FriendActivitySheet({
  open,
  onClose
}) {
  if (!open) return null;
  const D = window.IHYPE_DATA;
  const activities = [{
    friend: 'Dev R',
    tint: '#b983ff',
    action: 'hyped',
    target: 'Midnight Echo',
    detail: 'Carousel',
    time: '4m',
    type: 'hype'
  }, {
    friend: 'Mara K',
    tint: '#22e5d4',
    action: 'bought a ticket to',
    target: 'Nyla',
    detail: 'Basement Tapes · Jun 21',
    time: '22m',
    type: 'ticket'
  }, {
    friend: 'Theo P',
    tint: '#ffb84a',
    action: 'shared',
    target: 'Sunroom',
    detail: 'Album Release · $20',
    time: '1h',
    type: 'share'
  }, {
    friend: 'Sun L',
    tint: '#ff5029',
    action: 'hyped',
    target: 'Wax Tropic',
    detail: 'Heatwave',
    time: '2h',
    type: 'hype'
  }, {
    friend: 'Dev R',
    tint: '#b983ff',
    action: 'saved',
    target: 'Cold Harbor',
    detail: 'Tidewater',
    time: '3h',
    type: 'save'
  }, {
    friend: 'Mara K',
    tint: '#22e5d4',
    action: 'bought a ticket to',
    target: 'Midnight Echo',
    detail: 'Live at The Echo · Jun 20',
    time: '5h',
    type: 'ticket'
  }];
  const icons = {
    hype: '🔥',
    ticket: '🎟',
    share: '↗',
    save: '♡'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 72,
      background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '22px 22px 0 0',
      padding: '1.25rem 1.25rem 2.5rem',
      maxHeight: '80%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 18px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem',
      marginBottom: 18
    }
  }, "Friend activity"), activities.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '.85rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: `linear-gradient(135deg,${a.tint}88,${a.tint}22)`,
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      color: '#fff'
    }
  }, a.friend[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '.85rem',
      lineHeight: 1.4
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800
    }
  }, a.friend), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-b)',
      color: 'var(--ink-2)'
    }
  }, " ", a.action, " "), /*#__PURE__*/React.createElement("b", {
    style: {
      color: a.tint
    }
  }, a.target)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 3
    }
  }, a.detail)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 5,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)'
    }
  }, a.time), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, icons[a.type])))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 14,
      padding: '11px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.88rem',
      cursor: 'pointer'
    }
  }, "Done")));
}
Object.assign(window, {
  TourCreatorSheet,
  RadioSchedulerSheet,
  LiveEventOverlay,
  PostPurchaseMoment,
  NotifPrimer,
  PostShowRating,
  TicketTransferSheet,
  RequestSheet,
  ArtistAnalyticsSheet,
  InviteSheet,
  HelpSheet,
  ChangelogSheet,
  SettingsSheet,
  FeedbackWidget,
  ArtistProfileSheet,
  SeedMatchSheet,
  TicketQRSheet,
  PostShowMemoryCard,
  PlaylistCreateSheet,
  FriendActivitySheet
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/Sheets.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/Shell.jsx
try { (() => {
// iHYPE Shell — Onboarding · Media Player · Bottom Tabs · Mobile Shell · Desktop Shell

const OB_KEY = 'ihype_onboarded_v2';
const OB_CITIES = ['Los Angeles', 'New York', 'Chicago', 'Austin', 'Nashville', 'Portland', 'Seattle'];
const OB_GENRES = ['dream-pop', 'shoegaze', 'lo-fi', 'r&b', 'jazz', 'hip-hop', 'punk', 'electronic', 'folk', 'indie-rock'];
const OB_ROLES = [{
  id: 'fan',
  label: 'Fan',
  icon: '🎶',
  desc: 'Discover events, hype artists, earn on referrals.'
}, {
  id: 'dj',
  label: 'DJ',
  icon: '📻',
  desc: 'Build your crate, host radio shows, earn promoter cuts.'
}, {
  id: 'artist',
  label: 'Artist',
  icon: '🎸',
  desc: 'Sell tickets direct. Keep 70%. No agents, no fees.'
}, {
  id: 'venue',
  label: 'Venue',
  icon: '🏟',
  desc: 'Book from the demand radar. 20% guaranteed.'
}];
function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem(OB_KEY));
  } catch (e) {
    return null;
  }
}
function BetaGate({
  onPass
}) {
  const [code, setCode] = React.useState('');
  const [err, setErr] = React.useState(false);
  const CODES = ['IHYPE', 'HYPE2026', 'BETA', 'LISTEN'];
  const submit = () => {
    if (CODES.includes(code.trim().toUpperCase())) {
      localStorage.setItem('ihype_beta_ok', '1');
      window.track && window.track('beta_gate_pass');
      onPass();
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 1600);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 28px',
      textAlign: 'center',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 900,
      fontSize: '2.4rem',
      letterSpacing: '-.04em',
      color: 'var(--accent)'
    }
  }, "iHYPE"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.66rem',
      letterSpacing: '.22em',
      textTransform: 'uppercase',
      color: '#ffb84a',
      marginTop: 6
    }
  }, "Closed Beta \xB7 Invite Only"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.86rem',
      color: 'var(--ink-2)',
      marginTop: 18,
      lineHeight: 1.5,
      maxWidth: 280
    }
  }, "Enter your invite code to get early access to live shows, ticketing, and the radio studio."), /*#__PURE__*/React.createElement("input", {
    value: code,
    onChange: e => setCode(e.target.value),
    onKeyDown: e => e.key === 'Enter' && submit(),
    placeholder: "INVITE CODE",
    style: {
      marginTop: 22,
      width: '100%',
      maxWidth: 260,
      padding: '13px 16px',
      borderRadius: 12,
      border: `1px solid ${err ? '#ff5029' : 'var(--line)'}`,
      background: 'var(--bg-3)',
      color: 'var(--ink)',
      fontFamily: 'var(--f-m)',
      fontSize: '.95rem',
      letterSpacing: '.14em',
      textAlign: 'center',
      textTransform: 'uppercase',
      outline: 'none',
      boxSizing: 'border-box'
    }
  }), err && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: '#ff5029',
      marginTop: 8
    }
  }, "Invalid code \u2014 try IHYPE"), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: {
      marginTop: 14,
      width: '100%',
      maxWidth: 260,
      padding: '13px',
      borderRadius: 999,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.92rem',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(255,80,41,.3)'
    }
  }, "Enter iHYPE"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.66rem',
      color: 'var(--ink-3)',
      marginTop: 18
    }
  }, "No code? ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#ffb84a',
      cursor: 'pointer'
    },
    onClick: () => {
      setCode('IHYPE');
    }
  }, "Use demo code")));
}
function MeshBlob({
  x,
  y,
  color,
  size,
  dur
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      filter: 'blur(60px)',
      opacity: .35,
      animation: `meshMove ${dur} ease-in-out infinite alternate`,
      pointerEvents: 'none'
    }
  });
}
function Onboarding({
  onDone
}) {
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState(null);
  const [city, setCity] = React.useState('');
  const [genres, setGenres] = React.useState([]);
  const next = () => setStep(s => s + 1);
  const quickStart = () => {
    const data = {
      role: 'fan',
      city: 'Los Angeles',
      genres: ['dream-pop', 'lo-fi', 'electronic']
    };
    localStorage.setItem(OB_KEY, JSON.stringify(data));
    window.IHYPE_USER_PREFS = data;
    window.track && window.track('onboarding_skip');
    onDone();
  };
  const finish = () => {
    const data = {
      role,
      city,
      genres
    };
    localStorage.setItem(OB_KEY, JSON.stringify(data));
    window.IHYPE_USER_PREFS = data;
    onDone();
  };
  const prog = [0.25, 0.5, 0.75, 1][step];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
      padding: '1.5rem 1.25rem 1.25rem',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes meshMove{0%{transform:translate(0,0) scale(1)}100%{transform:translate(30px,20px) scale(1.15)}}'), /*#__PURE__*/React.createElement(MeshBlob, {
    x: "-10%",
    y: "-5%",
    color: "#ff5029",
    size: "55%",
    dur: "4s"
  }), /*#__PURE__*/React.createElement(MeshBlob, {
    x: "60%",
    y: "20%",
    color: "#b983ff",
    size: "45%",
    dur: "5.5s"
  }), /*#__PURE__*/React.createElement(MeshBlob, {
    x: "10%",
    y: "65%",
    color: "#22e5d4",
    size: "40%",
    dur: "3.8s"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      borderRadius: 999,
      background: 'var(--bg-3)',
      marginBottom: 24,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: prog * 100 + '%',
      background: 'var(--accent)',
      borderRadius: 999,
      transition: 'width .4s ease'
    }
  })), step === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.6rem',
      letterSpacing: '-.03em',
      marginBottom: 6
    }
  }, "Who are you?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      marginBottom: 20
    }
  }, "Pick your role. You can add more later."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flex: 1
    }
  }, OB_ROLES.map(r => {
    const on = role === r.id;
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      onClick: () => setRole(r.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 16,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.08)' : 'var(--bg-2)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 24,
        flexShrink: 0
      }
    }, r.icon), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.95rem'
      }
    }, r.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-b)',
        fontSize: '.78rem',
        color: 'var(--ink-3)',
        marginTop: 2
      }
    }, r.desc)), on && /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'var(--accent)',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "10",
      height: "10",
      viewBox: "0 0 12 12",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "2.5",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "1.5,6 4.5,9.5 10.5,2.5"
    }))));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: next,
    disabled: !role,
    style: {
      marginTop: 20,
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: role ? 'var(--accent)' : 'var(--bg-3)',
      color: role ? '#fff' : 'var(--ink-3)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      border: 'none',
      cursor: role ? 'pointer' : 'default'
    }
  }, "Continue \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: quickStart,
    style: {
      marginTop: 10,
      width: '100%',
      padding: '9px',
      borderRadius: 999,
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      border: 'none',
      cursor: 'pointer',
      letterSpacing: '.04em'
    }
  }, "Skip \u2014 explore the demo \u2192")), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.6rem',
      letterSpacing: '-.03em',
      marginBottom: 16
    }
  }, "Your scene?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      flex: 1,
      alignContent: 'start'
    }
  }, OB_CITIES.map(c => {
    const on = city === c;
    return /*#__PURE__*/React.createElement("button", {
      key: c,
      onClick: () => setCity(c),
      style: {
        padding: '11px 10px',
        borderRadius: 12,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.08)' : 'var(--bg-2)',
        color: on ? 'var(--accent)' : 'var(--ink)',
        fontFamily: 'var(--f-b)',
        fontWeight: on ? 700 : 500,
        fontSize: '.85rem',
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, c);
  })), /*#__PURE__*/React.createElement("button", {
    onClick: next,
    disabled: !city,
    style: {
      marginTop: 16,
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: city ? 'var(--accent)' : 'var(--bg-3)',
      color: city ? '#fff' : 'var(--ink-3)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      border: 'none',
      cursor: city ? 'pointer' : 'default'
    }
  }, "Continue \u2192")), step === 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.6rem',
      letterSpacing: '-.03em',
      marginBottom: 6
    }
  }, "What moves you?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.85rem',
      color: 'var(--ink-2)',
      lineHeight: 1.6,
      marginBottom: 16
    }
  }, "Pick 3+ to personalize Seeds and events."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      flex: 1,
      alignContent: 'start'
    }
  }, OB_GENRES.map(g => {
    const on = genres.includes(g);
    return /*#__PURE__*/React.createElement("button", {
      key: g,
      onClick: () => setGenres(gs => on ? gs.filter(x => x !== g) : [...gs, g]),
      style: {
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'rgba(255,80,41,.1)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--ink-2)',
        fontFamily: 'var(--f-m)',
        fontSize: '.8rem',
        fontWeight: on ? 700 : 500,
        cursor: 'pointer'
      }
    }, g);
  })), /*#__PURE__*/React.createElement("button", {
    onClick: finish,
    disabled: genres.length < 3,
    style: {
      marginTop: 16,
      width: '100%',
      padding: '13px',
      borderRadius: 999,
      background: genres.length >= 3 ? 'var(--accent)' : 'var(--bg-3)',
      color: genres.length >= 3 ? '#fff' : 'var(--ink-3)',
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.95rem',
      border: 'none',
      cursor: genres.length >= 3 ? 'pointer' : 'default'
    }
  }, genres.length < 3 ? `Pick ${3 - genres.length} more` : "Let's go →"), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontFamily: 'var(--f-m)',
      fontSize: '.62rem',
      color: 'var(--ink-3)',
      lineHeight: 1.6,
      marginTop: 10
    }
  }, "By continuing you agree to our ", /*#__PURE__*/React.createElement("a", {
    href: "https://ihype.app/terms",
    target: "_blank",
    style: {
      color: 'var(--ink-2)'
    }
  }, "Terms"), " & ", /*#__PURE__*/React.createElement("a", {
    href: "https://ihype.app/privacy",
    target: "_blank",
    style: {
      color: 'var(--ink-2)'
    }
  }, "Privacy Policy"), ".")));
}
function NotifCenter({
  open,
  onClose,
  role
}) {
  if (!open) return null;
  const D = window.IHYPE_DATA;
  const notifs = D.notifications[role] || D.notifications.fan;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 60,
      background: 'rgba(0,0,0,.5)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-2)',
      borderRadius: '0 0 24px 24px',
      padding: '1rem 1.15rem 1.25rem',
      boxShadow: '0 20px 40px rgba(0,0,0,.5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)',
      margin: '0 auto 16px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.1rem'
    }
  }, "Notifications"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 20,
      padding: 0,
      lineHeight: 1
    }
  }, "\xD7")), notifs.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    style: {
      display: 'flex',
      gap: 12,
      padding: '.85rem 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      flexShrink: 0,
      background: n.unread ? 'rgba(255,80,41,.12)' : 'var(--bg-3)',
      display: 'grid',
      placeItems: 'center',
      fontSize: 16
    }
  }, {
    ticket: '🎟',
    dollar: '💸',
    flame: '🔥',
    sprout: '🌱',
    radio: '📻',
    arrowUp: '📈',
    check: '✓',
    user: '👤'
  }[n.icon] || '•'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-b)',
      fontWeight: 700,
      fontSize: '.85rem',
      lineHeight: 1.3
    }
  }, n.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: 'var(--ink-3)',
      marginTop: 3,
      lineHeight: 1.4
    }
  }, n.body)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      color: 'var(--ink-3)'
    }
  }, n.when), n.unread && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--accent)'
    }
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: '100%',
      marginTop: 12,
      padding: '11px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      cursor: 'pointer'
    }
  }, "Mark all as read")));
}
function Waveform({
  playing,
  tint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      height: 20,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes wv{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}'), ['.4s', '.2s', '.55s', '.3s', '.45s'].map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 3,
      height: '100%',
      borderRadius: 2,
      background: tint || 'var(--accent)',
      transformOrigin: 'bottom',
      transform: playing ? undefined : 'scaleY(.25)',
      animation: playing ? `wv ${[.7, .5, .8, .6, .75][i]}s ${d} ease-in-out infinite` : undefined,
      transition: 'transform .3s'
    }
  })));
}
function MediaPlayerBar({
  track,
  playing,
  onToggle,
  onExpand
}) {
  if (!track) return null;
  const tint = track.tint || 'var(--accent)';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onExpand,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 14px',
      background: `linear-gradient(90deg,${tint}18,rgba(14,11,8,.92))`,
      backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${tint}22`,
      cursor: 'pointer',
      flexShrink: 0,
      boxShadow: `0 2px 20px ${tint}18`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      background: `linear-gradient(135deg,${track.tint}cc,${track.tint}33)`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.8rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, track.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      color: 'var(--ink-3)'
    }
  }, track.a)), /*#__PURE__*/React.createElement(Waveform, {
    playing: playing,
    tint: tint
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
    },
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      padding: 0,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "19,20 9,12 19,4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "4",
    x2: "5",
    y2: "20"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onToggle();
    },
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'var(--accent)',
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    }
  }, playing ? /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "white"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "4",
    width: "4",
    height: "16"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "4",
    width: "4",
    height: "16"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "white"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "5,3 19,12 5,21"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
    },
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      padding: 0,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "5,4 15,12 5,20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "19",
    y1: "4",
    x2: "19",
    y2: "20"
  })))));
}
function ExpandedPlayer({
  track,
  playing,
  onToggle,
  onClose
}) {
  const [progress, setProgress] = React.useState(38);
  if (!track) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      padding: '2rem 1.5rem 1.5rem'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      fontSize: 22,
      alignSelf: 'center',
      marginBottom: 24
    }
  }, "\u2304"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      aspectRatio: '1',
      borderRadius: 24,
      background: `linear-gradient(135deg,${track.tint}cc,${track.tint}22)`,
      marginBottom: 28
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '1.5rem',
      letterSpacing: '-.03em'
    }
  }, track.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.88rem',
      color: 'var(--ink-3)',
      marginTop: 4
    }
  }, track.a)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 6,
      position: 'relative',
      height: 36,
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      width: '100%',
      height: 3,
      borderRadius: 999,
      background: 'var(--bg-4)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: progress + '%',
      background: 'var(--accent)',
      borderRadius: 999
    }
  })), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 100,
    value: progress,
    onChange: e => setProgress(+e.target.value),
    style: {
      position: 'absolute',
      width: '100%',
      opacity: 0,
      cursor: 'pointer',
      height: 36
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: progress + '%',
      transform: 'translateX(-50%)',
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: 'var(--accent)',
      border: '2px solid var(--bg)',
      pointerEvents: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, "1:", String(Math.round(progress * .42)).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, "3:42")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 28
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-2)',
      cursor: 'pointer',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "19,20 9,12 19,4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "4",
    x2: "5",
    y2: "20"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--accent)',
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    }
  }, playing ? /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "white"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "4",
    width: "4",
    height: "16"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "4",
    width: "4",
    height: "16"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "white"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "5,3 19,12 5,21"
  }))), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-2)',
      cursor: 'pointer',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "5,4 15,12 5,20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "19",
    y1: "4",
    x2: "19",
    y2: "20"
  })))));
}

// Beta advisory banner
const BETA_KEY = 'ihype_beta_dismissed_v1';
function BetaBanner() {
  const [dismissed, setDismissed] = React.useState(() => !!localStorage.getItem(BETA_KEY));
  const [expanded, setExpanded] = React.useState(false);
  if (dismissed) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0,
      padding: '6px 12px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 12,
      background: 'rgba(255,184,74,.08)',
      border: '1px solid rgba(255,184,74,.22)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setExpanded(e => !e),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 10px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#ffb84a',
      flexShrink: 0,
      boxShadow: '0 0 6px #ffb84a'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.65rem',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: '#ffb84a',
      flex: 1
    }
  }, "Beta 0.1.0-beta.5 \xB7 Work in progress"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'rgba(255,184,74,.5)',
      marginRight: 4
    }
  }, expanded ? '▲' : '▼'), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      localStorage.setItem(BETA_KEY, '1');
      setDismissed(true);
    },
    style: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,184,74,.5)',
      cursor: 'pointer',
      fontSize: 16,
      lineHeight: 1,
      padding: '0 2px'
    }
  }, "\xD7")), expanded && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 10px 10px',
      borderTop: '1px solid rgba(255,184,74,.12)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--f-b)',
      fontSize: '.78rem',
      color: 'rgba(240,235,229,.65)',
      lineHeight: 1.6,
      margin: '8px 0 10px'
    }
  }, "This is a beta build. Features may be incomplete or change. Ticket purchases are simulated \u2014 no real money moves."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEChangelog && window.openIHYPEChangelog(),
    style: {
      flex: 1,
      padding: '6px',
      borderRadius: 8,
      border: '1px solid rgba(255,184,74,.2)',
      background: 'transparent',
      color: '#ffb84a',
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      cursor: 'pointer',
      letterSpacing: '.06em'
    }
  }, "What's new"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPEHelp && window.openIHYPEHelp(),
    style: {
      flex: 1,
      padding: '6px',
      borderRadius: 8,
      border: '1px solid rgba(255,184,74,.2)',
      background: 'transparent',
      color: '#ffb84a',
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      cursor: 'pointer',
      letterSpacing: '.06em'
    }
  }, "Help & FAQ"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      localStorage.setItem(BETA_KEY, '1');
      setDismissed(true);
    },
    style: {
      flex: 1,
      padding: '6px',
      borderRadius: 8,
      border: 'none',
      background: 'rgba(255,184,74,.12)',
      color: '#ffb84a',
      fontFamily: 'var(--f-m)',
      fontSize: '.68rem',
      cursor: 'pointer',
      letterSpacing: '.06em',
      fontWeight: 700
    }
  }, "Got it \u2713")))));
}

// Error boundary
class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = {
      err: null
    };
  }
  render() {
    if (this.state.err) return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 32
      }
    }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '1rem'
      }
    }, "Something went wrong"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--f-b)',
        fontSize: '.82rem',
        color: 'var(--ink-3)',
        maxWidth: '28ch',
        lineHeight: 1.6
      }
    }, String(this.state.err.message || this.state.err)), /*#__PURE__*/React.createElement("button", {
      onClick: () => this.setState({
        err: null
      }),
      style: {
        padding: '9px 22px',
        borderRadius: 999,
        background: 'var(--accent)',
        color: '#fff',
        border: 'none',
        fontFamily: 'var(--f-d)',
        fontWeight: 800,
        fontSize: '.85rem',
        cursor: 'pointer'
      }
    }, "Retry"));
    return this.props.children;
  }
}
ErrorBoundary.getDerivedStateFromError = e => ({
  err: e
});
function BottomTabs({
  active,
  onTab,
  playing
}) {
  const [pressed, setPressed] = React.useState(null);
  const tabs = [{
    id: 'listen',
    label: 'Listen',
    icon: (c, sz) => /*#__PURE__*/React.createElement("svg", {
      width: sz,
      height: sz,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: c,
      strokeWidth: "1.75",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9 18V5l12-2v13"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "18",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "16",
      r: "3"
    }))
  }, {
    id: 'events',
    label: 'Events',
    icon: (c, sz) => /*#__PURE__*/React.createElement("svg", {
      width: sz,
      height: sz,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: c,
      strokeWidth: "1.75",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"
    }))
  }, {
    id: 'pages',
    label: 'Pages',
    icon: (c, sz) => /*#__PURE__*/React.createElement("svg", {
      width: sz,
      height: sz,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: c,
      strokeWidth: "1.75",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "8",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 20c0-4 3.6-7 8-7s8 3 8 7"
    }))
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderTop: '1px solid var(--line)',
      background: 'var(--bg-2)',
      paddingBottom: 22,
      paddingTop: 6,
      flexShrink: 0
    }
  }, tabs.map(t => {
    const on = t.id === active;
    const isPressed = pressed === t.id;
    const color = on ? 'var(--accent)' : isPressed ? 'var(--accent)' : 'var(--ink-3)';
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onPointerDown: () => setPressed(t.id),
      onPointerUp: () => {
        setPressed(null);
        onTab(t.id);
      },
      onPointerLeave: () => setPressed(null),
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        padding: '10px 0 5px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color,
        position: 'relative',
        transform: isPressed ? 'scale(.92)' : 'scale(1)',
        transition: 'transform .1s ease'
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 36,
        height: 3,
        borderRadius: 999,
        background: 'var(--accent)',
        boxShadow: '0 0 10px 2px var(--accent)',
        opacity: .9
      }
    }), isPressed && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: 14,
        background: 'rgba(255,80,41,.1)',
        pointerEvents: 'none'
      }
    }), t.id === 'listen' && playing && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 8,
        right: 'calc(50% - 16px)',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: 'var(--accent)',
        border: '2px solid var(--bg-2)',
        boxShadow: '0 0 6px var(--accent)'
      }
    }), t.icon(color, 26), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--f-m)',
        fontSize: '.68rem',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        fontWeight: on ? 700 : 500
      }
    }, t.label));
  }));
}

// Register window globals; returns cleanup fn
const regGlobals = map => {
  Object.entries(map).forEach(([k, v]) => {
    window[k] = v;
  });
  return () => Object.keys(map).forEach(k => delete window[k]);
};
const WEEK_KEY = () => {
  const d = new Date();
  const s = new Date(d.getFullYear(), 0, 1);
  return d.getFullYear() + '-W' + Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7);
};
const getHypesLeft = () => {
  try {
    const b = JSON.parse(localStorage.getItem('ihype_hype_budget') || '{}');
    return b.week === WEEK_KEY() ? typeof b.left === 'number' ? b.left : 3 : 3;
  } catch (e) {
    return 3;
  }
};
function MobileShellV2() {
  const prefs = getPrefs();
  const [betaOk, setBetaOk] = React.useState(!!localStorage.getItem('ihype_beta_ok'));
  const [onboarded, setOnboarded] = React.useState(!!prefs);
  const [tab, setTab] = React.useState('listen');
  const [playerExpanded, setPlayerExpanded] = React.useState(false);
  const [playing, setPlaying] = React.useState(true);
  const [nowPlaying, setNowPlaying] = React.useState({
    t: 'Carousel',
    a: 'Midnight Echo',
    tint: '#ff5029'
  });
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifsRead, setNotifsRead] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [changelogOpen, setChangelogOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [radioOpen, setRadioOpen] = React.useState(false);
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [liveEvent, setLiveEvent] = React.useState(null);
  const [postShowRating, setPostShowRating] = React.useState(null);
  const [postPurchase, setPostPurchase] = React.useState(false);
  const [notifPrimer, setNotifPrimer] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [hypesLeft, setHypesLeft] = React.useState(getHypesLeft);
  const hypesLeftRef = React.useRef(3);
  React.useEffect(() => {
    hypesLeftRef.current = hypesLeft;
  }, [hypesLeft]);
  const [seedMatch, setSeedMatch] = React.useState(null);
  const [artistProfile, setArtistProfile] = React.useState(null);
  const openArtist = a => {
    setArtistProfile(a);
    history.pushState({
      ihype: 'artist'
    }, '');
  };
  const closeArtist = () => setArtistProfile(null);
  React.useEffect(() => {
    const onPop = () => {
      setArtistProfile(p => p ? null : p);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [ticketQR, setTicketQR] = React.useState(null);
  const [memoryCard, setMemoryCard] = React.useState(null);
  const [playlistCreate, setPlaylistCreate] = React.useState(false);
  const [friendActivity, setFriendActivity] = React.useState(false);
  const [radioCreatorOpen, setRadioCreatorOpen] = React.useState(false);
  const [radioCreatorCrate, setRadioCreatorCrate] = React.useState([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [earningsOpen, setEarningsOpen] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('ihype_theme') !== 'light');
  const [offline, setOffline] = React.useState(!navigator.onLine);
  React.useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  React.useEffect(() => {
    const r = document.documentElement;
    if (darkMode) {
      r.classList.remove('light-mode');
      localStorage.setItem('ihype_theme', 'dark');
    } else {
      r.classList.add('light-mode');
      localStorage.setItem('ihype_theme', 'light');
    }
  }, [darkMode]);
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };
  const role = (prefs || {}).role || 'fan';
  React.useEffect(() => {
    const _smHandler = e => setSeedMatch(e.detail);
    window.addEventListener('ihype-seed-match', _smHandler);
    const cleanup = regGlobals({
      setIHYPENowPlaying: t => {
        setNowPlaying(t);
        setPlaying(true);
      },
      openIHYPESettings: () => setSettingsOpen(true),
      openIHYPEChangelog: () => setChangelogOpen(true),
      openIHYPEHelp: () => setHelpOpen(true),
      openIHYPETransfer: () => setTransferOpen(true),
      openIHYPERequest: () => setRequestOpen(true),
      openIHYPEPostShow: s => setPostShowRating(s),
      openIHYPETourCreator: () => setTourOpen(true),
      openIHYPERadioScheduler: () => setRadioOpen(true),
      openIHYPERadioCreator: crate => {
        setRadioCreatorCrate(crate || []);
        setRadioCreatorOpen(true);
      },
      openIHYPEAnalytics: () => setAnalyticsOpen(true),
      openIHYPEInvite: () => setInviteOpen(true),
      openIHYPELiveEvent: ev => setLiveEvent(ev),
      triggerPostPurchase: () => {
        setPostPurchase(true);
        if (!localStorage.getItem('ihype_notif_primer_seen')) setTimeout(() => setNotifPrimer(true), 3200);
      },
      IHYPE_HYPE_BRIDGE: {
        canSpend: () => hypesLeftRef.current > 0,
        spend: () => {
          const n = Math.max(0, hypesLeftRef.current - 1);
          setHypesLeft(n);
          localStorage.setItem('ihype_hype_budget', JSON.stringify({
            week: WEEK_KEY(),
            left: n
          }));
        },
        onEmpty: () => showToast('0 hypes left — resets Monday')
      },
      openIHYPEArtistProfile: a => openArtist(a),
      openIHYPETicketQR: t => setTicketQR(t),
      openIHYPEMemoryCard: s => setMemoryCard(s),
      openIHYPEPlaylistCreate: () => setPlaylistCreate(true),
      openIHYPEFriendActivity: () => setFriendActivity(true),
      openIHYPESearch: () => setSearchOpen(true),
      openIHYPEEarnings: () => setEarningsOpen(true),
      openIHYPELiveShow: ev => setLiveEvent(ev),
      haptic: pattern => navigator.vibrate && navigator.vibrate(pattern || 15),
      toggleIHYPETheme: () => setDarkMode(d => !d),
      setIHYPETab: t => setTab(t),
      closeIHYPESheets: () => {
        setSettingsOpen(false);
        setChangelogOpen(false);
        setHelpOpen(false);
        setInviteOpen(false);
        setAnalyticsOpen(false);
        setTourOpen(false);
        setRadioOpen(false);
        setRequestOpen(false);
        setLiveEvent(null);
        setPostShowRating(null);
        setPostPurchase(false);
        setTransferOpen(false);
        setArtistProfile(null);
        setTicketQR(null);
        setMemoryCard(null);
        setPlaylistCreate(false);
        setFriendActivity(false);
        setRadioCreatorOpen(false);
        setSearchOpen(false);
        setEarningsOpen(false);
        setPayoutOpen(false);
        setSeedMatch(null);
      }
    });
    return () => {
      cleanup();
      window.removeEventListener('ihype-seed-match', _smHandler);
    };
  }, []);
  if (!betaOk) return /*#__PURE__*/React.createElement(BetaGate, {
    onPass: () => setBetaOk(true)
  });
  if (!onboarded) return /*#__PURE__*/React.createElement(Onboarding, {
    onDone: () => setOnboarded(true)
  });

  // Resolve sheet components from window (set by Sheets.jsx)
  const SS = window.SettingsSheet;
  const CS = window.ChangelogSheet;
  const HS = window.HelpSheet;
  const TFS = window.TicketTransferSheet;
  const RS = window.RequestSheet;
  const TCS = window.TourCreatorSheet;
  const RDS = window.RadioSchedulerSheet;
  const AAS = window.ArtistAnalyticsSheet;
  const IS = window.InviteSheet;
  const LEO = window.LiveEventOverlay;
  const LSO = window.LiveShowOverlay;
  const GS = window.GlobalSearch;
  const ES = window.EarningsSheet;
  const PYS = window.PayoutSheet;
  const PSR = window.PostShowRating;
  const PPM = window.PostPurchaseMoment;
  const NP = window.NotifPrimer;
  const FW = window.FeedbackWidget;
  const APS = window.ArtistProfileSheet;
  const SMS = window.SeedMatchSheet;
  const TQRS = window.TicketQRSheet;
  const PMC = window.PostShowMemoryCard;
  const PCS = window.PlaylistCreateSheet;
  const FAS = window.FriendActivitySheet;
  const LT = window.ListenTab;
  const ET = window.EventsTab;
  const PT = window.PagesTab;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 14px 0',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 10px',
      borderRadius: 999,
      border: '1px solid var(--line-2)',
      background: 'var(--bg-2)',
      cursor: 'default'
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 11,
      opacity: i < hypesLeft ? 1 : .15,
      transition: 'opacity .35s'
    }
  }, "\uD83D\uDD25")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.6rem',
      color: 'var(--ink-3)',
      marginLeft: 4,
      letterSpacing: '.05em'
    }
  }, "/wk")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSearchOpen(true),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      padding: 4,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.35-4.35"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setNotifOpen(true);
      setNotifsRead(true);
    },
    style: {
      position: 'relative',
      background: 'none',
      border: 'none',
      color: 'var(--ink-3)',
      cursor: 'pointer',
      padding: 4,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.73 21a2 2 0 0 1-3.46 0"
  })), !notifsRead && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--accent)',
      border: '2px solid var(--bg-2)'
    }
  }))), /*#__PURE__*/React.createElement(BetaBanner, null), /*#__PURE__*/React.createElement(MediaPlayerBar, {
    track: nowPlaying,
    playing: playing,
    onToggle: () => setPlaying(p => !p),
    onExpand: () => setPlayerExpanded(true)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, tab === 'listen' && LT && /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(LT, {
    onToast: showToast
  })), tab === 'events' && ET && /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(ET, {
    onToast: showToast
  })), tab === 'pages' && PT && /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(PT, {
    onToast: showToast
  }))), /*#__PURE__*/React.createElement(BottomTabs, {
    active: tab,
    onTab: setTab,
    playing: playing
  }), playerExpanded && /*#__PURE__*/React.createElement(ExpandedPlayer, {
    track: nowPlaying,
    playing: playing,
    onToggle: () => setPlaying(p => !p),
    onClose: () => setPlayerExpanded(false)
  }), /*#__PURE__*/React.createElement(NotifCenter, {
    open: notifOpen,
    onClose: () => setNotifOpen(false),
    role: role
  }), SS && /*#__PURE__*/React.createElement(SS, {
    open: settingsOpen,
    onClose: () => setSettingsOpen(false)
  }), CS && /*#__PURE__*/React.createElement(CS, {
    open: changelogOpen,
    onClose: () => setChangelogOpen(false)
  }), HS && /*#__PURE__*/React.createElement(HS, {
    open: helpOpen,
    onClose: () => setHelpOpen(false)
  }), TFS && /*#__PURE__*/React.createElement(TFS, {
    open: transferOpen,
    onClose: () => setTransferOpen(false)
  }), RS && /*#__PURE__*/React.createElement(RS, {
    open: requestOpen,
    onClose: () => setRequestOpen(false)
  }), TCS && /*#__PURE__*/React.createElement(TCS, {
    open: tourOpen,
    onClose: () => setTourOpen(false)
  }), RDS && /*#__PURE__*/React.createElement(RDS, {
    open: radioOpen,
    onClose: () => setRadioOpen(false)
  }), AAS && /*#__PURE__*/React.createElement(AAS, {
    open: analyticsOpen,
    onClose: () => setAnalyticsOpen(false)
  }), IS && /*#__PURE__*/React.createElement(IS, {
    open: inviteOpen,
    onClose: () => setInviteOpen(false),
    onToast: showToast
  }), LEO && liveEvent && /*#__PURE__*/React.createElement(LEO, {
    event: liveEvent,
    onClose: () => setLiveEvent(null)
  }), PSR && /*#__PURE__*/React.createElement(PSR, {
    show: postShowRating,
    onClose: () => setPostShowRating(null)
  }), FW && /*#__PURE__*/React.createElement(FW, {
    onToast: showToast
  }), NP && /*#__PURE__*/React.createElement(NP, {
    show: notifPrimer,
    onAllow: () => {
      setNotifPrimer(false);
      localStorage.setItem('ihype_notif_primer_seen', '1');
      showToast('Notifications on ✓');
    },
    onSkip: () => {
      setNotifPrimer(false);
      localStorage.setItem('ihype_notif_primer_seen', '1');
    }
  }), PPM && /*#__PURE__*/React.createElement(PPM, {
    show: postPurchase,
    onClose: () => {
      setPostPurchase(false);
      setTab('events');
    }
  }), APS && /*#__PURE__*/React.createElement(APS, {
    artist: artistProfile,
    onClose: () => setArtistProfile(null),
    onBuy: s => {
      setArtistProfile(null);
    }
  }), SMS && seedMatch && /*#__PURE__*/React.createElement(SMS, {
    match: seedMatch,
    onClose: () => setSeedMatch(null),
    onBuy: () => setSeedMatch(null)
  }), TQRS && /*#__PURE__*/React.createElement(TQRS, {
    ticket: ticketQR,
    onClose: () => setTicketQR(null)
  }), PMC && /*#__PURE__*/React.createElement(PMC, {
    show: memoryCard,
    onClose: () => setMemoryCard(null)
  }), PCS && /*#__PURE__*/React.createElement(PCS, {
    open: playlistCreate,
    onClose: () => setPlaylistCreate(false),
    onCreated: () => {}
  }), FAS && /*#__PURE__*/React.createElement(FAS, {
    open: friendActivity,
    onClose: () => setFriendActivity(false)
  }), radioCreatorOpen && window.RadioShowCreator && React.createElement(window.RadioShowCreator, {
    initialCrate: radioCreatorCrate,
    onClose: () => setRadioCreatorOpen(false),
    onToast: showToast
  }), GS && /*#__PURE__*/React.createElement(GS, {
    open: searchOpen,
    onClose: () => setSearchOpen(false)
  }), ES && /*#__PURE__*/React.createElement(ES, {
    open: earningsOpen,
    onClose: () => setEarningsOpen(false),
    onPayout: () => {
      setEarningsOpen(false);
      setPayoutOpen(true);
    }
  }), PYS && /*#__PURE__*/React.createElement(PYS, {
    open: payoutOpen,
    amount: 17.82,
    onClose: () => setPayoutOpen(false),
    onToast: showToast
  }), LSO && liveEvent && /*#__PURE__*/React.createElement(LSO, {
    event: liveEvent,
    onClose: () => setLiveEvent(null)
  }), offline && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: '#1a1000',
      borderBottom: '1px solid #ffb84a44',
      padding: '8px 16px',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: '#ffb84a',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#ffb84a',
      flexShrink: 0
    }
  }), "Offline \u2014 showing cached content"), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-3)',
      border: '1px solid var(--line)',
      borderRadius: 12,
      padding: '10px 18px',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 100
    }
  }, toast));
}
function DesktopShell() {
  const prefs = getPrefs();
  const [betaOk, setBetaOk] = React.useState(!!localStorage.getItem('ihype_beta_ok'));
  const [onboarded, setOnboarded] = React.useState(!!prefs);
  const [tab, setTab] = React.useState('listen');
  const [playing, setPlaying] = React.useState(true);
  const [nowPlaying, setNowPlaying] = React.useState({
    t: 'Carousel',
    a: 'Midnight Echo',
    tint: '#ff5029'
  });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [changelogOpen, setChangelogOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [radioOpen, setRadioOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [liveEvent, setLiveEvent] = React.useState(null);
  const [postShowRating, setPostShowRating] = React.useState(null);
  const [postPurchase, setPostPurchase] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [artistProfile, setArtistProfile] = React.useState(null);
  const [ticketQR, setTicketQR] = React.useState(null);
  const [memoryCard, setMemoryCard] = React.useState(null);
  const [playlistCreate, setPlaylistCreate] = React.useState(false);
  const [friendActivity, setFriendActivity] = React.useState(false);
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };
  const role = (prefs || {}).role || 'fan';
  React.useEffect(() => {
    const handler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'l' || e.key === 'L') setTab('listen');else if (e.key === 'e' || e.key === 'E') setTab('events');else if (e.key === 'p' || e.key === 'P') setTab('pages');else if (e.key === '/') {
        e.preventDefault();
        window.openIHYPESearch && window.openIHYPESearch();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying(pl => !pl);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  React.useEffect(() => regGlobals({
    setIHYPENowPlaying: t => {
      setNowPlaying(t);
      setPlaying(true);
    },
    openIHYPESettings: () => setSettingsOpen(true),
    openIHYPEChangelog: () => setChangelogOpen(true),
    openIHYPEHelp: () => setHelpOpen(true),
    openIHYPEInvite: () => setInviteOpen(true),
    openIHYPEAnalytics: () => setAnalyticsOpen(true),
    openIHYPETourCreator: () => setTourOpen(true),
    openIHYPERadioScheduler: () => setRadioOpen(true),
    openIHYPERequest: () => setRequestOpen(true),
    openIHYPELiveEvent: ev => setLiveEvent(ev),
    openIHYPEPostShow: s => setPostShowRating(s),
    openIHYPETransfer: () => setTransferOpen(true),
    triggerPostPurchase: () => setPostPurchase(true),
    openIHYPEArtistProfile: a => setArtistProfile(a),
    openIHYPETicketQR: t => setTicketQR(t),
    openIHYPEMemoryCard: s => setMemoryCard(s),
    openIHYPEPlaylistCreate: () => setPlaylistCreate(true),
    openIHYPEFriendActivity: () => setFriendActivity(true),
    setIHYPETab: t => setTab(t)
  }), []);
  if (!betaOk) return /*#__PURE__*/React.createElement(BetaGate, {
    onPass: () => setBetaOk(true)
  });
  if (!onboarded) return /*#__PURE__*/React.createElement(Onboarding, {
    onDone: () => setOnboarded(true)
  });
  const SS = window.SettingsSheet;
  const CS = window.ChangelogSheet;
  const HS = window.HelpSheet;
  const IS = window.InviteSheet;
  const AAS = window.ArtistAnalyticsSheet;
  const TCS = window.TourCreatorSheet;
  const RDS = window.RadioSchedulerSheet;
  const RS = window.RequestSheet;
  const LEO = window.LiveEventOverlay;
  const PSR = window.PostShowRating;
  const PPM = window.PostPurchaseMoment;
  const TFS = window.TicketTransferSheet;
  const APS = window.ArtistProfileSheet;
  const TQRS = window.TicketQRSheet;
  const PMC = window.PostShowMemoryCard;
  const PCS = window.PlaylistCreateSheet;
  const FAS = window.FriendActivitySheet;
  const LT = window.ListenTab;
  const ET = window.EventsTab;
  const PT = window.PagesTab;
  const navItems = [{
    id: 'listen',
    label: 'Listen',
    svg: /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.75",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9 18V5l12-2v13"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "18",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "16",
      r: "3"
    }))
  }, {
    id: 'events',
    label: 'Events',
    svg: /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.75",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"
    }))
  }, {
    id: 'pages',
    label: 'Pages',
    svg: /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.75",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "8",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 20c0-4 3.6-7 8-7s8 3 8 7"
    }))
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--line)',
      padding: '1.25rem 1rem 1rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 900,
      fontSize: '1.3rem',
      letterSpacing: '-.04em',
      marginBottom: '1.5rem',
      color: 'var(--ink)'
    }
  }, "iHYPE"), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, navItems.map(n => {
    const on = tab === n.id;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => setTab(n.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: 'none',
        background: on ? 'rgba(255,80,41,.1)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--ink-2)',
        fontFamily: 'var(--f-b)',
        fontWeight: on ? 700 : 500,
        fontSize: '.9rem',
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, n.svg, n.label);
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.openIHYPESearch && window.openIHYPESearch(),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 10,
      border: 'none',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--f-b)',
      fontWeight: 500,
      fontSize: '.9rem',
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.35-4.35"
  })), "Search"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--bg-2)',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'linear-gradient(135deg,#ff5029,#ff3e9a)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.85rem'
    }
  }, "Robin Vega"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.7rem',
      color: 'var(--ink-3)'
    }
  }, "@robinv \xB7 ", role))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 6
    }
  }, [['$16.20', 'Earned', 'var(--accent)'], ['14', 'Hyped', '#22e5d4']].map(([v, l, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      padding: '8px',
      borderRadius: 8,
      background: 'var(--bg-3)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-d)',
      fontWeight: 800,
      fontSize: '.9rem',
      color: c
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--f-m)',
      fontSize: '.6rem',
      color: 'var(--ink-3)',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      marginTop: 2
    }
  }, l))))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSettingsOpen(true),
    style: {
      width: '100%',
      padding: '8px',
      borderRadius: 8,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink-3)',
      fontFamily: 'var(--f-m)',
      fontSize: '.78rem',
      cursor: 'pointer'
    }
  }, "Settings")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflow: 'hidden'
    }
  }, tab === 'listen' && LT && /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(LT, {
    onToast: showToast
  })), tab === 'events' && ET && /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(ET, {
    onToast: showToast
  })), tab === 'pages' && PT && /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(PT, {
    onToast: showToast
  })))), /*#__PURE__*/React.createElement(BetaBanner, null), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(MediaPlayerBar, {
    track: nowPlaying,
    playing: playing,
    onToggle: () => setPlaying(p => !p),
    onExpand: () => {}
  })), SS && /*#__PURE__*/React.createElement(SS, {
    open: settingsOpen,
    onClose: () => setSettingsOpen(false)
  }), CS && /*#__PURE__*/React.createElement(CS, {
    open: changelogOpen,
    onClose: () => setChangelogOpen(false)
  }), HS && /*#__PURE__*/React.createElement(HS, {
    open: helpOpen,
    onClose: () => setHelpOpen(false)
  }), IS && /*#__PURE__*/React.createElement(IS, {
    open: inviteOpen,
    onClose: () => setInviteOpen(false),
    onToast: showToast
  }), AAS && /*#__PURE__*/React.createElement(AAS, {
    open: analyticsOpen,
    onClose: () => setAnalyticsOpen(false)
  }), TCS && /*#__PURE__*/React.createElement(TCS, {
    open: tourOpen,
    onClose: () => setTourOpen(false)
  }), RDS && /*#__PURE__*/React.createElement(RDS, {
    open: radioOpen,
    onClose: () => setRadioOpen(false)
  }), RS && /*#__PURE__*/React.createElement(RS, {
    open: requestOpen,
    onClose: () => setRequestOpen(false)
  }), TFS && /*#__PURE__*/React.createElement(TFS, {
    open: transferOpen,
    onClose: () => setTransferOpen(false)
  }), LEO && liveEvent && /*#__PURE__*/React.createElement(LEO, {
    event: liveEvent,
    onClose: () => setLiveEvent(null)
  }), PSR && /*#__PURE__*/React.createElement(PSR, {
    show: postShowRating,
    onClose: () => setPostShowRating(null)
  }), PPM && /*#__PURE__*/React.createElement(PPM, {
    show: postPurchase,
    onClose: () => {
      setPostPurchase(false);
      setTab('events');
    }
  }), APS && /*#__PURE__*/React.createElement(APS, {
    artist: artistProfile,
    onClose: () => setArtistProfile(null),
    onBuy: () => setArtistProfile(null)
  }), TQRS && /*#__PURE__*/React.createElement(TQRS, {
    ticket: ticketQR,
    onClose: () => setTicketQR(null)
  }), PMC && /*#__PURE__*/React.createElement(PMC, {
    show: memoryCard,
    onClose: () => setMemoryCard(null)
  }), PCS && /*#__PURE__*/React.createElement(PCS, {
    open: playlistCreate,
    onClose: () => setPlaylistCreate(false),
    onCreated: () => {}
  }), FAS && /*#__PURE__*/React.createElement(FAS, {
    open: friendActivity,
    onClose: () => setFriendActivity(false)
  }), radioCreatorOpen && window.RadioShowCreator && React.createElement(window.RadioShowCreator, {
    initialCrate: radioCreatorCrate,
    onClose: () => setRadioCreatorOpen(false),
    onToast: showToast
  }), GS && /*#__PURE__*/React.createElement(GS, {
    open: searchOpen,
    onClose: () => setSearchOpen(false)
  }), ES && /*#__PURE__*/React.createElement(ES, {
    open: earningsOpen,
    onClose: () => setEarningsOpen(false),
    onPayout: () => {
      setEarningsOpen(false);
      setPayoutOpen(true);
    }
  }), PYS && /*#__PURE__*/React.createElement(PYS, {
    open: payoutOpen,
    amount: 17.82,
    onClose: () => setPayoutOpen(false),
    onToast: showToast
  }), LSO && liveEvent && /*#__PURE__*/React.createElement(LSO, {
    event: liveEvent,
    onClose: () => setLiveEvent(null)
  }), offline && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: '#1a1000',
      borderBottom: '1px solid #ffb84a44',
      padding: '8px 16px',
      fontFamily: 'var(--f-m)',
      fontSize: '.72rem',
      color: '#ffb84a',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#ffb84a',
      flexShrink: 0
    }
  }), "Offline \u2014 showing cached content"), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-3)',
      border: '1px solid var(--line)',
      borderRadius: 12,
      padding: '10px 18px',
      fontFamily: 'var(--f-m)',
      fontSize: '.82rem',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 100
    }
  }, toast));
}
Object.assign(window, {
  MobileShellV2,
  DesktopShell,
  Onboarding
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fan-app/data.js
try { (() => {
// iHYPE mock data — no backend; visual recreation only

// Lightweight analytics stub (logs + persists; swap for real provider at launch)
window.track = function (event, props) {
  try {
    const entry = {
      event,
      props: props || {},
      ts: Date.now(),
      plat: localStorage.getItem('ihype_platform') || 'ios'
    };
    const log = JSON.parse(localStorage.getItem('ihype_events') || '[]');
    log.push(entry);
    if (log.length > 200) log.shift();
    localStorage.setItem('ihype_events', JSON.stringify(log));
    console.log('[track]', event, props || '');
  } catch (e) {}
};
window.IHYPE_DATA = {
  stats: {
    artists: '1.2K',
    fans: '18.4K',
    hypes: '92.1K',
    shows: '37'
  },
  shows: [{
    id: 's1',
    title: 'Midnight Echo — Live at The Echo',
    artist: 'Midnight Echo',
    venue: 'The Echo',
    city: 'Los Angeles',
    date: 'Fri Jun 20 · 9:00 PM',
    price: 18,
    status: 'LIVE',
    hype: 1284,
    tint: '#ff5029'
  }, {
    id: 's2',
    title: 'Wax Tropic + Slow Mover',
    artist: 'Wax Tropic',
    venue: 'Zebulon',
    city: 'Los Angeles',
    date: 'Sat Jun 21 · 8:30 PM',
    price: 22,
    status: 'SCHEDULED',
    hype: 642,
    tint: '#b983ff'
  }, {
    id: 's3',
    title: 'Basement Tapes: Late Set',
    artist: 'Nyla',
    venue: 'The Lash',
    city: 'Los Angeles',
    date: 'Sat Jun 21 · 11:00 PM',
    price: 15,
    status: 'SCHEDULED',
    hype: 318,
    tint: '#22e5d4'
  }, {
    id: 's4',
    title: 'Sunroom — Album Release',
    artist: 'Sunroom',
    venue: 'Gold-Diggers',
    city: 'Los Angeles',
    date: 'Sun Jun 22 · 7:00 PM',
    price: 20,
    status: 'SCHEDULED',
    hype: 877,
    tint: '#ffb84a'
  }],
  artist: {
    name: 'Midnight Echo',
    handle: '@midnightecho',
    city: 'Los Angeles, CA',
    bio: 'Four-piece dream-pop outfit. Reverb, tape loops, and a drum machine named Carl. Booking direct — no agents, no fees.',
    hype: 4821,
    monthly: '12.4K',
    tags: ['dream-pop', 'shoegaze', 'lo-fi'],
    tracks: [{
      t: 'Carousel',
      len: '3:42',
      plays: '48.1K'
    }, {
      t: 'Slow Static',
      len: '4:05',
      plays: '31.7K'
    }, {
      t: 'Paper Walls',
      len: '2:58',
      plays: '22.3K'
    }, {
      t: 'Halogen',
      len: '5:12',
      plays: '18.9K'
    }]
  },
  freeUseLibrary: [{
    id: 'fu1',
    t: 'Carousel',
    a: 'Midnight Echo',
    genre: 'Dream-Pop',
    len: '3:42',
    bpm: 92,
    tint: '#ff5029',
    license: 'free-use'
  }, {
    id: 'fu2',
    t: 'Goldenrod',
    a: 'Nyla',
    genre: 'R&B',
    len: '3:21',
    bpm: 88,
    tint: '#22e5d4',
    license: 'free-use'
  }, {
    id: 'fu3',
    t: 'Heatwave',
    a: 'Wax Tropic',
    genre: 'Electronic',
    len: '4:10',
    bpm: 124,
    tint: '#b983ff',
    license: 'free-use'
  }, {
    id: 'fu4',
    t: 'Paper Walls',
    a: 'Midnight Echo',
    genre: 'Dream-Pop',
    len: '2:58',
    bpm: 84,
    tint: '#ff5029',
    license: 'free-use'
  }, {
    id: 'fu5',
    t: 'Tidewater',
    a: 'Cold Harbor',
    genre: 'Ambient',
    len: '5:30',
    bpm: 70,
    tint: '#5b8cff',
    license: 'free-use'
  }, {
    id: 'fu6',
    t: 'Slow Static',
    a: 'Midnight Echo',
    genre: 'Shoegaze',
    len: '4:05',
    bpm: 78,
    tint: '#ff5029',
    license: 'free-use'
  }, {
    id: 'fu7',
    t: 'Neon Drift',
    a: 'DJ Caro',
    genre: 'Electronic',
    len: '6:12',
    bpm: 128,
    tint: '#b983ff',
    license: 'free-use'
  }, {
    id: 'fu8',
    t: 'Copper Sky',
    a: 'Sunroom',
    genre: 'Indie',
    len: '3:44',
    bpm: 110,
    tint: '#ffb84a',
    license: 'free-use'
  }, {
    id: 'fu9',
    t: 'Late Tape',
    a: 'Robin Vega',
    genre: 'Lo-Fi',
    len: '2:48',
    bpm: 76,
    tint: '#5b8cff',
    license: 'free-use'
  }, {
    id: 'fu10',
    t: 'Halogen',
    a: 'Midnight Echo',
    genre: 'Dream-Pop',
    len: '5:12',
    bpm: 86,
    tint: '#ff5029',
    license: 'free-use'
  }, {
    id: 'fu11',
    t: 'Basement Tape #3',
    a: 'Nyla',
    genre: 'Hip-Hop',
    len: '3:55',
    bpm: 93,
    tint: '#22e5d4',
    license: 'free-use'
  }, {
    id: 'fu12',
    t: 'Glass Room',
    a: 'Cold Harbor',
    genre: 'Ambient',
    len: '7:01',
    bpm: 60,
    tint: '#5b8cff',
    license: 'free-use'
  }, {
    id: 'fu13',
    t: 'After Hours',
    a: 'DJ Caro',
    genre: 'Electronic',
    len: '5:44',
    bpm: 132,
    tint: '#b983ff',
    license: 'free-use'
  }, {
    id: 'fu14',
    t: 'Gold Teeth',
    a: 'Wax Tropic',
    genre: 'Hip-Hop',
    len: '3:28',
    bpm: 96,
    tint: '#b983ff',
    license: 'free-use'
  }, {
    id: 'fu15',
    t: 'Sundowner',
    a: 'Sunroom',
    genre: 'Indie',
    len: '4:20',
    bpm: 102,
    tint: '#ffb84a',
    license: 'free-use'
  }, {
    id: 'fu16',
    t: 'Slow Mover',
    a: 'Wax Tropic',
    genre: 'Electronic',
    len: '4:55',
    bpm: 118,
    tint: '#b983ff',
    license: 'free-use'
  }, {
    id: 'fu17',
    t: 'Open Road',
    a: 'Robin Vega',
    genre: 'Lo-Fi',
    len: '3:10',
    bpm: 80,
    tint: '#5b8cff',
    license: 'free-use'
  }, {
    id: 'fu18',
    t: 'Resonance',
    a: 'Cold Harbor',
    genre: 'Ambient',
    len: '6:30',
    bpm: 65,
    tint: '#5b8cff',
    license: 'free-use'
  }],
  seeds: [{
    artist: 'Nyla',
    track: 'Goldenrod',
    tag: 'NEW NEAR YOU',
    tint: '#22e5d4'
  }, {
    artist: 'Wax Tropic',
    track: 'Heatwave',
    tag: 'RISING',
    tint: '#b983ff'
  }],
  playlists: [{
    id: 'pl1',
    name: 'Late Night LA',
    count: 42,
    mins: 168,
    tint: '#ff5029',
    by: 'You'
  }, {
    id: 'pl2',
    name: 'Tape Loops',
    count: 28,
    mins: 112,
    tint: '#b983ff',
    by: 'You'
  }, {
    id: 'pl3',
    name: 'Pre-show warmup',
    count: 18,
    mins: 71,
    tint: '#22e5d4',
    by: 'You'
  }, {
    id: 'pl4',
    name: 'Hyped this month',
    count: 36,
    mins: 142,
    tint: '#ffb84a',
    by: 'iHYPE',
    auto: true
  }, {
    id: 'pl5',
    name: 'Basement Tapes radio',
    count: 24,
    mins: 96,
    tint: '#5b8cff',
    by: 'Nyla'
  }],
  library: [{
    t: 'Carousel',
    a: 'Midnight Echo',
    len: '3:42',
    tint: '#ff5029'
  }, {
    t: 'Goldenrod',
    a: 'Nyla',
    len: '3:18',
    tint: '#22e5d4'
  }, {
    t: 'Heatwave',
    a: 'Wax Tropic',
    len: '3:48',
    tint: '#b983ff'
  }, {
    t: 'Paper Cup',
    a: 'Sunroom',
    len: '2:58',
    tint: '#ffb84a'
  }, {
    t: 'Slow Static',
    a: 'Midnight Echo',
    len: '4:05',
    tint: '#ff5029'
  }, {
    t: 'Tidewater',
    a: 'Cold Harbor',
    len: '4:11',
    tint: '#5b8cff'
  }],
  searchRecents: ['midnight echo', 'late set', 'shoegaze LA', 'the echo'],
  charts: [{
    rank: 1,
    prev: 2,
    artist: 'Midnight Echo',
    track: 'Carousel',
    hype: 4821,
    trend: [40, 52, 48, 61, 70, 88, 96],
    tint: '#ff5029'
  }, {
    rank: 2,
    prev: 4,
    artist: 'Sunroom',
    track: 'Paper Cup',
    hype: 2960,
    trend: [22, 30, 26, 34, 40, 38, 45],
    tint: '#ffb84a'
  }, {
    rank: 3,
    prev: 1,
    artist: 'Wax Tropic',
    track: 'Heatwave',
    hype: 2740,
    trend: [30, 28, 33, 31, 36, 40, 42],
    tint: '#b983ff'
  }, {
    rank: 4,
    prev: 9,
    artist: 'Nyla',
    track: 'Goldenrod',
    hype: 1320,
    trend: [10, 14, 20, 26, 30, 44, 58],
    tint: '#22e5d4'
  }, {
    rank: 5,
    prev: 5,
    artist: 'Cold Harbor',
    track: 'Tidewater',
    hype: 1104,
    trend: [18, 20, 19, 24, 22, 26, 28],
    tint: '#5b8cff'
  }, {
    rank: 6,
    prev: 3,
    artist: 'Slow Mover',
    track: 'Driftwood',
    hype: 980,
    trend: [44, 40, 38, 34, 30, 29, 27],
    tint: '#ff3e9a'
  }],
  favoriteLocations: [{
    id: 'fl1',
    name: 'The Echo',
    kind: 'Venue',
    city: 'Echo Park, LA',
    upcoming: 4,
    dist: '0.4 mi',
    tint: '#22e5d4'
  }, {
    id: 'fl2',
    name: 'Zebulon',
    kind: 'Venue',
    city: 'Frogtown, LA',
    upcoming: 2,
    dist: '1.2 mi',
    tint: '#b983ff'
  }, {
    id: 'fl3',
    name: 'Gold-Diggers',
    kind: 'Venue',
    city: 'East Hollywood, LA',
    upcoming: 3,
    dist: '2.1 mi',
    tint: '#ffb84a'
  }, {
    id: 'fl4',
    name: 'Los Angeles',
    kind: 'City',
    city: 'Your home scene',
    upcoming: 37,
    dist: '—',
    tint: '#ff5029'
  }],
  radioShows: [{
    id: 'rs1',
    name: 'Late Set',
    host: 'Robin Vega',
    day: 'Fri · 11 PM',
    listeners: '1.3K',
    status: 'LIVE',
    genre: 'lo-fi · after hours',
    tint: '#5b8cff'
  }, {
    id: 'rs2',
    name: 'Basement Tapes',
    host: 'The Lash',
    day: 'Sat · 10 PM',
    listeners: '880',
    status: 'SCHEDULED',
    genre: 'garage · live sets',
    tint: '#22e5d4'
  }, {
    id: 'rs3',
    name: 'Golden Hour',
    host: 'Sunroom',
    day: 'Sun · 6 PM',
    listeners: '640',
    status: 'SCHEDULED',
    genre: 'dream-pop · sunset',
    tint: '#ffb84a'
  }, {
    id: 'rs4',
    name: 'After Dark',
    host: 'Midnight Echo',
    day: 'Sat · 1 AM',
    listeners: '1.1K',
    status: 'LIVE',
    genre: 'shoegaze · late night',
    tint: '#ff5029'
  }, {
    id: 'rs5',
    name: 'Tape Loops',
    host: 'Robin V',
    day: 'Wed · 9 PM',
    listeners: '420',
    status: 'SCHEDULED',
    genre: 'ambient · experiments',
    tint: '#ff3e9a'
  }],
  recommended: [{
    id: 'rec1',
    artist: 'Cold Harbor',
    event: 'Tidewater — Live at Zebulon',
    date: 'Thu Jun 26 · 8:00 PM',
    price: 16,
    reason: 'Because you hyped Midnight Echo',
    tint: '#5b8cff'
  }, {
    id: 'rec2',
    artist: 'Slow Mover',
    event: 'Driftwood Release Show',
    date: 'Fri Jun 27 · 9:30 PM',
    price: 14,
    reason: 'Rising in your Charts',
    tint: '#ff3e9a'
  }, {
    id: 'rec3',
    artist: 'Nyla',
    event: 'Basement Tapes: Late Set',
    date: 'Sat Jun 21 · 11:00 PM',
    price: 15,
    reason: 'On a station you follow',
    tint: '#22e5d4'
  }],
  dj: {
    name: 'Robin Vega',
    handle: '@robinv',
    city: 'Los Angeles, CA',
    listeners: '3.2K',
    onAir: true,
    shows: [{
      id: 'dj1',
      name: 'Late Set',
      day: 'Fri · 11 PM',
      listeners: 1320,
      status: 'LIVE',
      tint: '#5b8cff'
    }, {
      id: 'dj2',
      name: 'Golden Hour',
      day: 'Sun · 6 PM',
      listeners: 840,
      status: 'SCHEDULED',
      tint: '#ffb84a'
    }, {
      id: 'dj3',
      name: 'After Dark',
      day: 'Sat · 1 AM',
      listeners: 610,
      status: 'DRAFT',
      tint: '#ff3e9a'
    }]
  },
  fan: {
    name: 'Robin Vega',
    handle: '@robinv',
    city: 'Los Angeles, CA',
    hypesLeft: 3,
    hypesThisWeek: 2,
    referralEarned: 24.30,
    perks: [{
      icon: 'ticket',
      label: 'Early ticket access',
      sub: 'Hyped artists drop to you first'
    }, {
      icon: 'dollar',
      label: '10% on referrals',
      sub: 'Share a show, earn the promoter cut'
    }, {
      icon: 'radio',
      label: 'Shapes your radio',
      sub: 'Hypes tune your stations'
    }]
  },
  hypedFeed: [{
    id: 'h1',
    artist: 'Midnight Echo',
    track: 'Carousel',
    tint: '#ff5029',
    event: 'Live at The Echo',
    date: 'Fri Jun 20 · 9:00 PM',
    price: 18,
    status: 'JUST DROPPED',
    earlyAccess: true,
    left: 4
  }, {
    id: 'h2',
    artist: 'Nyla',
    track: 'Goldenrod',
    tint: '#22e5d4',
    event: 'Basement Tapes: Late Set',
    date: 'Sat Jun 21 · 11:00 PM',
    price: 15,
    status: 'PRESALE',
    earlyAccess: true,
    left: 12
  }, {
    id: 'h3',
    artist: 'Sunroom',
    track: 'Paper Cup',
    tint: '#ffb84a',
    event: 'Album Release',
    date: 'Sun Jun 22 · 7:00 PM',
    price: 20,
    status: 'ON SALE',
    earlyAccess: false,
    left: 28
  }],
  demand: [{
    artist: 'Midnight Echo',
    local: 2140,
    trend: [40, 52, 48, 61, 70, 88, 96],
    up: '+38%',
    tint: '#ff5029'
  }, {
    artist: 'Nyla',
    local: 1320,
    trend: [10, 14, 20, 26, 30, 44, 58],
    up: '+61%',
    tint: '#22e5d4'
  }, {
    artist: 'Wax Tropic',
    local: 980,
    trend: [30, 28, 33, 31, 36, 40, 42],
    up: '+12%',
    tint: '#b983ff'
  }, {
    artist: 'Sunroom',
    local: 760,
    trend: [22, 30, 26, 34, 40, 38, 45],
    up: '+19%',
    tint: '#ffb84a'
  }],
  receipt: {
    show: 'Midnight Echo — Live at The Echo',
    date: 'Fri Jun 20, 2026',
    tickets: 218,
    face: 18,
    gross: 3924
  },
  offers: [{
    id: 'o1',
    venue: 'The Echo',
    city: 'Los Angeles',
    date: 'Fri Jun 27',
    cap: 300,
    price: 18,
    note: 'Saw your 2,140 local hypes — want you headlining a Friday. Backline provided.',
    tint: '#22e5d4',
    when: '2h ago'
  }, {
    id: 'o2',
    venue: 'Zebulon',
    city: 'Los Angeles',
    date: 'Sat Jul 12',
    cap: 220,
    price: 20,
    note: 'Late slot, killer room. We handle promo.',
    tint: '#b983ff',
    when: '1d ago'
  }],
  fanReceipts: [{
    id: 'r1',
    artist: 'Midnight Echo',
    event: 'Live at The Echo',
    date: 'May 30, 2026',
    price: 18,
    qty: 2,
    tint: '#ff5029'
  }, {
    id: 'r2',
    artist: 'Sunroom',
    event: 'Album Release',
    date: 'May 12, 2026',
    price: 20,
    qty: 1,
    tint: '#ffb84a'
  }],
  promoter: {
    name: 'Robin Vega',
    handle: '@robinv',
    earnedAllTime: 412.80,
    pending: 86.40,
    clicks: 1840,
    conversion: '7.2%',
    links: [{
      show: 'Midnight Echo — The Echo',
      code: 'robinv-echo',
      clicks: 612,
      sold: 44,
      earned: 79.20,
      tint: '#ff5029'
    }, {
      show: 'Nyla — Basement Tapes',
      code: 'robinv-nyla',
      clicks: 488,
      sold: 31,
      earned: 46.50,
      tint: '#22e5d4'
    }, {
      show: 'Sunroom — Album Release',
      code: 'robinv-sun',
      clicks: 740,
      sold: 58,
      earned: 116.00,
      tint: '#ffb84a'
    }]
  },
  friends: [{
    name: 'Dev R',
    tint: '#b983ff'
  }, {
    name: 'Mara K',
    tint: '#22e5d4'
  }, {
    name: 'Theo P',
    tint: '#ffb84a'
  }, {
    name: 'Sun L',
    tint: '#ff5029'
  }],
  notifications: {
    fan: [{
      id: 'nf1',
      icon: 'ticket',
      tone: 'var(--accent)',
      title: 'Tickets dropped',
      body: 'Midnight Echo — Live at The Echo. You get first access.',
      when: '12m',
      unread: true
    }, {
      id: 'nf2',
      icon: 'dollar',
      tone: '#22e5d4',
      title: 'You earned $3.60',
      body: 'A friend bought a ticket through your link.',
      when: '2h',
      unread: true
    }, {
      id: 'nf3',
      icon: 'sprout',
      tone: '#b983ff',
      title: '2 rising artists near you',
      body: 'New Seeds matched to your taste.',
      when: '1d',
      unread: false
    }, {
      id: 'nf4',
      icon: 'radio',
      tone: '#5b8cff',
      title: 'Nyla is on air',
      body: 'Late Set radio just went live.',
      when: '2d',
      unread: false
    }],
    artist: [{
      id: 'na1',
      icon: 'ticket',
      tone: '#22e5d4',
      title: 'New booking offer',
      body: 'The Echo wants you Fri Jun 27 — 300 cap, $18.',
      when: '2h',
      unread: true
    }, {
      id: 'na2',
      icon: 'flame',
      tone: 'var(--accent)',
      title: '+214 hypes this week',
      body: "You're trending #1 on the LA demand radar.",
      when: '1d',
      unread: true
    }, {
      id: 'na3',
      icon: 'dollar',
      tone: '#22e5d4',
      title: 'Payout sent · $1,872',
      body: 'Your 70% from The Echo cleared.',
      when: '3d',
      unread: false
    }],
    venue: [{
      id: 'nv1',
      icon: 'check',
      tone: '#22e5d4',
      title: 'Midnight Echo accepted',
      body: 'Fri Jun 27 is confirmed — now on sale.',
      when: '1h',
      unread: true
    }, {
      id: 'nv2',
      icon: 'arrowUp',
      tone: '#5b8cff',
      title: 'Nyla +61% locally',
      body: 'Trending in your area — book the room early.',
      when: '1d',
      unread: true
    }, {
      id: 'nv3',
      icon: 'dollar',
      tone: '#22e5d4',
      title: 'Payout sent · $1,872',
      body: 'Your 70% from the Jun 20 show cleared.',
      when: '3d',
      unread: false
    }],
    promoter: [{
      id: 'np1',
      icon: 'dollar',
      tone: '#22e5d4',
      title: 'You earned $116.00',
      body: '58 tickets sold through your Sunroom link.',
      when: '4h',
      unread: true
    }, {
      id: 'np2',
      icon: 'flame',
      tone: 'var(--accent)',
      title: 'Your link is hot',
      body: '740 clicks on the Sunroom show this week.',
      when: '1d',
      unread: true
    }, {
      id: 'np3',
      icon: 'ticket',
      tone: '#b983ff',
      title: 'New show to push',
      body: 'Wax Tropic added a date near you.',
      when: '2d',
      unread: false
    }],
    dj: [{
      id: 'nd1',
      icon: 'radio',
      tone: '#5b8cff',
      title: 'Late Set hit 1.3K live',
      body: 'Your Friday station is your biggest yet.',
      when: '20m',
      unread: true
    }, {
      id: 'nd2',
      icon: 'flame',
      tone: 'var(--accent)',
      title: 'Heatwave got 84 hypes',
      body: 'A track you spun is climbing the charts.',
      when: '3h',
      unread: true
    }, {
      id: 'nd3',
      icon: 'user',
      tone: '#b983ff',
      title: '+212 followers this week',
      body: 'Listeners are subscribing to your stations.',
      when: '1d',
      unread: false
    }]
  }
};

// Helper: look up artist data by name, with fallback
window.lookupArtist = function (name, tint) {
  const D = window.IHYPE_DATA;
  if (D.artist && D.artist.name === name) return Object.assign({}, D.artist, {
    tint: tint || D.artist.tint || '#ff5029'
  });
  const show = (D.shows || []).find(function (s) {
    return s.artist === name;
  });
  const seed = (D.seeds || []).find(function (s) {
    return s.artist === name;
  });
  return {
    name: name,
    handle: '@' + name.toLowerCase().replace(/\s+/g, ''),
    city: show && show.city || 'Los Angeles, CA',
    tint: tint || show && show.tint || '#ff5029',
    tags: seed && seed.tags || [],
    bio: 'Independent artist on iHYPE.',
    tracks: (D.library || []).filter(function (t) {
      return t.a === name;
    }).map(function (t, i) {
      return {
        t: t.t,
        len: t.len,
        plays: ['48.1K', '31.7K', '22.3K', '18.9K', '14.2K'][i] || '10.1K'
      };
    })
  };
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fan-app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/ops/ops.jsx
try { (() => {
// iHYPE · iH/OPS — Operator Console
const T = {
  bg: '#0a0805',
  bg2: '#100d09',
  bg3: '#1a1612',
  bg4: '#221c16',
  ink: '#f0ebe5',
  ink2: '#9e9080',
  ink3: '#5a5048',
  ink4: '#3a342e',
  line: 'rgba(255,255,255,.06)',
  line2: 'rgba(255,255,255,.14)',
  ac: '#ff5029',
  fan: '#b983ff',
  venue: '#22e5d4',
  dj: '#ff3e9a',
  blue: '#7fb3ff',
  warn: '#ffb84a',
  good: '#22e5d4',
  bad: '#ff4545',
  fd: "'Syne',sans-serif",
  fb: "'DM Sans',sans-serif",
  fm: "'JetBrains Mono',monospace"
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const I = {
  queue: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "4",
    rx: "1.5",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "10",
    width: "18",
    height: "4",
    rx: "1.5",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "17",
    width: "18",
    height: "4",
    rx: "1.5",
    stroke: "currentColor",
    strokeWidth: "1.6"
  })),
  platform: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 17l6-6 4 4 8-9",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })),
  accounts: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 010 7.75M21 20c0-3.5-2.7-6-6-6",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  })),
  log: /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 12h6M9 8h6M9 16h4",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 20V4a1 1 0 011-1h8l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1z",
    stroke: "currentColor",
    strokeWidth: "1.6"
  })),
  check: /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12l4 4L19 7",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })),
  x: /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6L6 18",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  })),
  warn: /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 9v4M12 17h.01M10.3 3.6L2.6 18a1 1 0 00.87 1.5h17.1a1 1 0 00.87-1.5L13.7 3.6a1 1 0 00-1.74 0z",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  })),
  clock: /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v5l3 3",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }))
};
const NAV = [{
  k: 'queue',
  label: 'Queue',
  icon: I.queue
}, {
  k: 'platform',
  label: 'Platform',
  icon: I.platform
}, {
  k: 'accounts',
  label: 'Accounts',
  icon: I.accounts
}, {
  k: 'log',
  label: 'Log',
  icon: I.log
}];
const TYPE_C = {
  Artist: T.ac,
  Venue: T.venue,
  DJ: T.dj,
  'Music Store': T.warn,
  'Merch': T.fan,
  '3rd-Party': T.blue
};

// ── Data ──────────────────────────────────────────────────────────────────────
const QUEUE_DATA = [{
  id: 'ADV-2847',
  type: 'Artist',
  name: 'The Midnight',
  copy: '"Nocturnal" — North American tour 2026',
  body: '24 dates across US + Canada. Tickets on sale June 24.',
  buyer: 'pass',
  music: 'pass',
  copy2: 'pass',
  submitted: '2m ago'
}, {
  id: 'ADV-2848',
  type: 'Venue',
  name: 'Empty Bottle',
  copy: 'New show announced · July 12',
  body: 'Doors open 8pm · $15 advance / $18 door · 21+',
  buyer: 'pass',
  music: 'pass',
  copy2: 'pass',
  submitted: '5m ago'
}, {
  id: 'ADV-2849',
  type: '3rd-Party',
  name: 'MusicGear.co',
  copy: 'Flash sale — 40% off effects pedals',
  body: 'Fender, Boss, TC Electronic. Free shipping orders $50+.',
  buyer: 'warn',
  music: 'pass',
  copy2: 'pass',
  submitted: '9m ago'
}, {
  id: 'ADV-2850',
  type: '3rd-Party',
  name: 'CryptoTune',
  copy: 'Earn crypto while listening to music',
  body: 'Join 50k+ listeners earning $TUNE tokens daily.',
  buyer: 'fail',
  music: 'fail',
  copy2: 'pass',
  submitted: '12m ago'
}, {
  id: 'ADV-2851',
  type: 'DJ',
  name: 'Jam Productions',
  copy: 'Summer Fest — 3 days, 4 stages',
  body: 'Aug 14–16 · Millennium Park · Chicago · Free day-passes.',
  buyer: 'pass',
  music: 'pass',
  copy2: 'pass',
  submitted: '18m ago'
}, {
  id: 'ADV-2852',
  type: 'Artist',
  name: 'Soccer Mommy',
  copy: '"Sometimes, Forever" vinyl reissue',
  body: 'Limited edition pressing with 3 bonus tracks. Out July 5.',
  buyer: 'pass',
  music: 'pass',
  copy2: 'warn',
  submitted: '24m ago'
}];
const LOG_DATA = [{
  id: 'ADV-2843',
  action: 'APPROVED',
  by: 'System',
  time: '08:42',
  type: 'Artist',
  name: 'Hovvdy'
}, {
  id: 'ADV-2844',
  action: 'REJECTED',
  by: 'System',
  time: '08:39',
  type: '3rd-Party',
  name: 'CryptoWave',
  reason: 'Non-musical product category'
}, {
  id: 'ADV-2845',
  action: 'APPROVED',
  by: 'System',
  time: '08:36',
  type: 'Venue',
  name: 'Sleeping Village'
}, {
  id: 'ADV-2846',
  action: 'FLAGGED',
  by: 'Manual',
  time: '08:31',
  type: '3rd-Party',
  name: 'EnergyMix Pro',
  reason: 'Buyer verification incomplete'
}, {
  id: 'ADV-2841',
  action: 'APPROVED',
  by: 'System',
  time: '08:24',
  type: 'Artist',
  name: 'Lush (UK)'
}, {
  id: 'ADV-2840',
  action: 'REJECTED',
  by: 'System',
  time: '08:19',
  type: '3rd-Party',
  name: 'SportsBet.io',
  reason: 'Non-music industry: gambling'
}];
const ACCOUNTS_DATA = [{
  name: 'The Midnight',
  type: 'Artist',
  status: 'Active',
  campaigns: 3,
  spend: '$1,240',
  joined: 'Jan 2026'
}, {
  name: 'Empty Bottle',
  type: 'Venue',
  status: 'Active',
  campaigns: 5,
  spend: '$3,820',
  joined: 'Mar 2025'
}, {
  name: 'Jam Productions',
  type: 'DJ',
  status: 'Active',
  campaigns: 2,
  spend: '$890',
  joined: 'Nov 2025'
}, {
  name: 'MusicGear.co',
  type: '3rd-Party',
  status: 'Pending',
  campaigns: 1,
  spend: '$0',
  joined: 'Jun 2026'
}, {
  name: 'Reverb.com',
  type: '3rd-Party',
  status: 'Active',
  campaigns: 4,
  spend: '$5,610',
  joined: 'Aug 2025'
}, {
  name: 'Sleeping Village',
  type: 'Venue',
  status: 'Active',
  campaigns: 2,
  spend: '$640',
  joined: 'Feb 2026'
}, {
  name: 'CryptoTune',
  type: '3rd-Party',
  status: 'Banned',
  campaigns: 0,
  spend: '$0',
  joined: 'Jun 2026'
}];

// ── Primitives ────────────────────────────────────────────────────────────────
function Eyebrow({
  children,
  c = T.ink3,
  style: s
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 9,
      letterSpacing: '.18em',
      textTransform: 'uppercase',
      color: c,
      ...s
    }
  }, children);
}
function GateDot({
  r
}) {
  const c = r === 'pass' ? T.good : r === 'warn' ? T.warn : T.bad;
  const ic = r === 'pass' ? I.check : r === 'warn' ? I.warn : I.x;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 18,
      height: 18,
      borderRadius: 4,
      background: `${c}18`,
      border: `1px solid ${c}40`,
      color: c
    }
  }, ic);
}
function TypeBadge({
  type
}) {
  const c = TYPE_C[type] || T.ink3;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.fm,
      fontSize: 8,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: c,
      background: `${c}15`,
      padding: '2px 7px',
      borderRadius: 4
    }
  }, type);
}
function ActionBtn({
  children,
  accent = T.ac,
  ghost,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      padding: '6px 14px',
      background: ghost ? 'transparent' : accent,
      color: ghost ? T.ink : T.bg,
      border: ghost ? `1px solid ${T.line2}` : 'none',
      borderRadius: 6,
      fontFamily: T.fm,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '.08em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, children);
}

// ── Queue Screen ──────────────────────────────────────────────────────────────
function QueueScreen() {
  const [sel, setSel] = React.useState(0);
  const [items, setItems] = React.useState(QUEUE_DATA);
  const item = items[sel];
  const decide = (id, action) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSel(s => Math.max(0, s - (s >= items.length - 1 ? 1 : 0)));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minHeight: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 300,
      borderRight: `1px solid ${T.line}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      borderBottom: `1px solid ${T.line}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ac
  }, "PENDING"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 18,
      color: T.ink
    }
  }, items.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, items.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 9,
      letterSpacing: '.14em',
      color: T.ink3
    }
  }, "QUEUE CLEAR"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 22,
      color: T.good,
      marginTop: 10
    }
  }, "\u2713")), items.map((it, i) => {
    const allPass = it.buyer === 'pass' && it.music === 'pass' && it.copy2 === 'pass';
    const hasFail = it.buyer === 'fail' || it.music === 'fail' || it.copy2 === 'fail';
    const flagC = hasFail ? T.bad : it.buyer === 'warn' || it.copy2 === 'warn' ? T.warn : T.ink3;
    return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      onClick: () => setSel(i),
      style: {
        padding: '12px 16px',
        borderBottom: `1px solid ${T.line}`,
        cursor: 'pointer',
        background: i === sel ? T.bg3 : 'transparent',
        borderLeft: `2px solid ${i === sel ? T.ac : 'transparent'}`,
        transition: 'background 100ms'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(TypeBadge, {
      type: it.type
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 8,
        color: T.ink3,
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, I.clock, it.submitted)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fb,
        fontSize: 12,
        fontWeight: 500,
        color: T.ink,
        marginTop: 6,
        lineHeight: 1.4,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical'
      }
    }, it.copy), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 9,
        color: T.ink3,
        marginTop: 4
      }
    }, it.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        marginTop: 7,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(GateDot, {
      r: it.buyer
    }), /*#__PURE__*/React.createElement(GateDot, {
      r: it.music
    }), /*#__PURE__*/React.createElement(GateDot, {
      r: it.copy2
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.fm,
        fontSize: 8,
        color: flagC,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        marginLeft: 4
      }
    }, hasFail ? 'AUTO-REJECT' : it.buyer === 'warn' || it.copy2 === 'warn' ? 'REVIEW' : 'CLEAR')));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, !item ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Select a submission")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(TypeBadge, {
    type: item.type
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ink3
  }, item.id, " \xB7 ", item.submitted)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 20,
      color: T.ink,
      marginTop: 8,
      letterSpacing: '-.015em'
    }
  }, item.copy), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fb,
      fontSize: 13,
      color: T.ink2,
      marginTop: 4
    }
  }, item.name, " \xB7 ", item.body))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `1px solid ${T.line}`,
      borderRadius: 10
    }
  }, [['Buyer vetting', item.buyer], ['Music-only relevance', item.music], ['Copyright firewall', item.copy2]].map(([label, r], i) => {
    const c = r === 'pass' ? T.good : r === 'warn' ? T.warn : T.bad;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: i < 2 ? `1px solid ${T.line}` : 'none'
      }
    }, /*#__PURE__*/React.createElement(GateDot, {
      r: r
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        fontFamily: T.fb,
        fontSize: 13,
        color: T.ink
      }
    }, label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 9,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: c
      }
    }, r.toUpperCase()));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `1px solid ${T.line2}`,
      borderRadius: 10,
      padding: 16,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Creative preview"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 16,
      color: T.ink,
      marginTop: 8,
      letterSpacing: '-.01em'
    }
  }, item.copy), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fb,
      fontSize: 12,
      color: T.ink2,
      marginTop: 4,
      lineHeight: 1.5
    }
  }, item.body), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      background: `linear-gradient(90deg,transparent,${T.ac},transparent)`,
      animation: 'opsPulse 2s ease-in-out infinite',
      animationIterationCount: 'infinite'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      paddingTop: 4
    }
  }, /*#__PURE__*/React.createElement(ActionBtn, {
    accent: T.good,
    onClick: () => decide(item.id, 'approve')
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'inherit',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(I.check, {}), "\xA0Approve")), /*#__PURE__*/React.createElement(ActionBtn, {
    accent: T.bad,
    onClick: () => decide(item.id, 'reject')
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'inherit',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(I.x, {}), "\xA0Reject")), /*#__PURE__*/React.createElement(ActionBtn, {
    ghost: true,
    onClick: () => decide(item.id, 'flag')
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'inherit',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(I.warn, {}), "\xA0Flag for review"))))));
}

// ── Platform Screen ───────────────────────────────────────────────────────────
const SPARK = [40, 52, 61, 48, 72, 80, 68, 91, 85, 104, 96, 112, 88, 130, 122, 108, 140, 128, 152, 138, 168, 155, 172, 160, 180, 165, 190, 178, 200, 188];
function PlatformScreen() {
  const stats = [{
    label: 'Submissions today',
    value: '1,247',
    detail: '↑ 12% vs yesterday',
    c: T.ac
  }, {
    label: 'Clearance rate',
    value: '94%',
    detail: 'Auto-cleared in <60s',
    c: T.good
  }, {
    label: 'Active campaigns',
    value: '38',
    detail: 'Across all tiers',
    c: T.fan
  }, {
    label: 'Avg review time',
    value: '42ms',
    detail: 'HYPE Screen latency',
    c: T.blue
  }, {
    label: 'Rejected today',
    value: '74',
    detail: '6% rejection rate',
    c: T.bad
  }, {
    label: 'Queue depth',
    value: '6',
    detail: 'Awaiting manual review',
    c: T.warn
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ac
  }, "PLATFORM HEALTH"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '-.02em',
      color: T.ink,
      marginTop: 5
    }
  }, "Operator dashboard")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 10
    }
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '14px 16px',
      border: `1px solid ${T.line}`,
      borderRadius: 10,
      background: T.bg2
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ink3
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 26,
      letterSpacing: '-.015em',
      marginTop: 8,
      color: T.ink
    }
  }, s.value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 9,
      color: s.c,
      marginTop: 5,
      letterSpacing: '.06em'
    }
  }, s.detail)))), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${T.line}`,
      borderRadius: 10,
      background: T.bg2,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '11px 16px',
      borderBottom: `1px solid ${T.line}`,
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 700,
      fontSize: 13,
      color: T.ink
    }
  }, "Submission volume \xB7 30 days"), /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ink3
  }, "HYPE SCREEN ACTIVITY")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 10px'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: 64,
    viewBox: `0 0 ${SPARK.length * 4} 64`,
    preserveAspectRatio: "none",
    style: {
      display: 'block'
    }
  }, SPARK.map((v, i) => {
    const max = 200,
      bh = v / max * 60;
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: i * 4,
      y: 64 - bh,
      width: 3,
      height: bh,
      fill: T.ac,
      opacity: 0.3 + v / max * 0.7
    });
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ink4
  }, "MAY 21"), /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ink4
  }, "JUN 20")))));
}

// ── Accounts Screen ───────────────────────────────────────────────────────────
function AccountsScreen() {
  const statusC = {
    Active: T.good,
    Pending: T.warn,
    Banned: T.bad
  };
  const [q, setQ] = React.useState('');
  const filtered = ACCOUNTS_DATA.filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || a.type.toLowerCase().includes(q.toLowerCase()) || a.status.toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.blue
  }, "ADVERTISER ACCOUNTS"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '-.02em',
      color: T.ink,
      marginTop: 5
    }
  }, "Accounts")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 30,
      padding: '0 12px',
      background: T.bg3,
      border: `1px solid ${T.line}`,
      borderRadius: 6,
      minWidth: 220
    }
  }, I.search(11, T.ink3), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search accounts\u2026",
    style: {
      background: 'transparent',
      border: 'none',
      outline: 'none',
      fontFamily: T.fm,
      fontSize: 11,
      color: T.ink,
      width: '100%'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${T.line}`,
      borderRadius: 10,
      background: T.bg2,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
      padding: '8px 16px',
      borderBottom: `1px solid ${T.line}`
    }
  }, ['Account', 'Type', 'Status', 'Campaigns', 'Total spend', 'Joined'].map(h => /*#__PURE__*/React.createElement(Eyebrow, {
    key: h,
    c: T.ink3
  }, h))), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 24px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 18,
      color: T.ink3,
      marginBottom: 6
    }
  }, "No accounts found"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 9,
      color: T.ink4,
      letterSpacing: '.1em'
    }
  }, "Try a different search term")), filtered.map((a, i) => {
    const sc = statusC[a.status] || T.ink3;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
        padding: '11px 16px',
        borderBottom: i < filtered.length - 1 ? `1px solid ${T.line}` : 'none',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fb,
        fontSize: 13,
        fontWeight: 500,
        color: T.ink
      }
    }, a.name), /*#__PURE__*/React.createElement(TypeBadge, {
      type: a.type
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 9,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: sc
      }
    }, a.status), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fd,
        fontWeight: 700,
        fontSize: 14,
        color: T.ink
      }
    }, a.campaigns), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fd,
        fontWeight: 700,
        fontSize: 14,
        color: T.ink
      }
    }, a.spend), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 9,
        color: T.ink3
      }
    }, a.joined));
  })));
}

// ── Log Screen ────────────────────────────────────────────────────────────────
function LogScreen() {
  const ac = {
    APPROVED: T.good,
    REJECTED: T.bad,
    FLAGGED: T.warn
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    c: T.ink3
  }, "AUDIT TRAIL"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '-.02em',
      color: T.ink,
      marginTop: 5
    }
  }, "Decision log")), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${T.line}`,
      borderRadius: 10,
      background: T.bg2,
      overflow: 'hidden'
    }
  }, LOG_DATA.map((l, i) => {
    const c = ac[l.action] || T.ink3;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 16px',
        borderBottom: i < LOG_DATA.length - 1 ? `1px solid ${T.line}` : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 9,
        color: T.ink3,
        flexShrink: 0,
        width: 44
      }
    }, l.time), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 9,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: c,
        background: `${c}15`,
        padding: '3px 8px',
        borderRadius: 4,
        flexShrink: 0
      }
    }, l.action), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fb,
        fontSize: 12,
        fontWeight: 500,
        color: T.ink
      }
    }, l.name), l.reason && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 9,
        color: T.bad,
        marginTop: 2,
        letterSpacing: '.04em'
      }
    }, "Reason: ", l.reason)), /*#__PURE__*/React.createElement(TypeBadge, {
      type: l.type
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 8,
        color: T.ink3
      }
    }, l.id), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.fm,
        fontSize: 8,
        color: T.ink3
      }
    }, "by ", l.by));
  })));
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function App() {
  const [scr, setScr] = React.useState(() => {
    try {
      return localStorage.getItem('ihype-ops-scr') || 'queue';
    } catch {
      return 'queue';
    }
  });
  const [clock, setClock] = React.useState(new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }));
  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })), 1000);
    return () => clearInterval(t);
  }, []);
  const go = k => {
    setScr(k);
    try {
      localStorage.setItem('ihype-ops-scr', k);
    } catch {}
  };
  const SCREENS = {
    queue: /*#__PURE__*/React.createElement(QueueScreen, null),
    platform: /*#__PURE__*/React.createElement(PlatformScreen, null),
    accounts: /*#__PURE__*/React.createElement(AccountsScreen, null),
    log: /*#__PURE__*/React.createElement(LogScreen, null)
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: T.bg,
      color: T.ink,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 42,
      borderBottom: `1px solid ${T.line}`,
      background: T.bg2,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 14,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 16,
      letterSpacing: '-.02em'
    }
  }, "i", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ac
    }
  }, "H"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ink3
    }
  }, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ac
    }
  }, "OPS")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 9,
      letterSpacing: '.12em',
      padding: '3px 8px',
      border: `1px solid ${T.good}40`,
      borderRadius: 4,
      color: T.good,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: T.good,
      display: 'inline-block',
      animation: 'opsPulse 2s ease-in-out infinite'
    }
  }), "LIVE"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 9,
      color: T.ink3,
      letterSpacing: '.1em',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, I.clock, "\xA0", clock), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 9,
      color: T.ink3,
      padding: '3px 10px',
      borderRadius: 4,
      background: T.bg3,
      border: `1px solid ${T.line}`
    }
  }, "Single operator \xB7 Automated admin")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minHeight: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 88,
      borderRight: `1px solid ${T.line}`,
      background: T.bg2,
      padding: '12px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      flexShrink: 0
    }
  }, NAV.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.k,
    onClick: () => go(it.k),
    style: {
      padding: '10px 6px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 5,
      cursor: 'pointer',
      color: it.k === scr ? T.ink : T.ink3,
      background: it.k === scr ? T.bg3 : 'transparent',
      borderLeft: it.k === scr ? `2px solid ${T.ac}` : '2px solid transparent',
      transition: 'all 100ms'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, it.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.fm,
      fontSize: 8,
      letterSpacing: '.12em',
      textTransform: 'uppercase'
    }
  }, it.label), it.k === 'queue' && QUEUE_DATA.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: T.ac,
      color: T.bg,
      fontFamily: T.fd,
      fontWeight: 800,
      fontSize: 9,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      marginTop: -22,
      marginLeft: 28
    }
  }, QUEUE_DATA.length)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, SCREENS[scr] || /*#__PURE__*/React.createElement(QueueScreen, null))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ops/ops.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.SkeletonText = __ds_scope.SkeletonText;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Toggle = __ds_scope.Toggle;

})();
