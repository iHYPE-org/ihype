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
  const call = (fn, ...a) => { try { const w = win(); if (w && typeof w[fn] === 'function') w[fn](...a); } catch (e) {} };
  const data = () => { try { return win().IHYPE_DATA; } catch (e) { return null; } };

  // Bypass the beta gate + onboarding inside the demo iframe so the tour lands
  // straight in the app. Seed flags, then reload once (guard prevents a loop).
  frame.addEventListener('load', () => {
    try {
      const ls = win().localStorage;
      if (!ls.getItem('ihype_beta_ok')) {
        ls.setItem('ihype_beta_ok', '1');
        ls.setItem('ihype_onboarded_v2', JSON.stringify({ role: 'fan', city: 'Los Angeles', genres: ['dream-pop', 'lo-fi', 'electronic'] }));
        win().location.reload();
      }
    } catch (e) { /* cross-origin guard */ }
  });

  // Tour steps. dur = ms on screen before auto-advance.
  const STEPS = [
    {
      label: 'Welcome',
      title: 'iHYPE in 90 seconds',
      body: 'Artist-owned live music. Fans hype who they love, buy tickets direct, and earn by promoting — with 70% of every ticket locked to the artist. Let’s walk the app.',
      dur: 6500,
      run() { call('closeIHYPESheets'); call('setIHYPETab', 'listen'); },
    },
    {
      label: 'Listen & hype',
      title: 'Hype the artists you believe in',
      body: 'The Listen tab is discovery. Each 🔥 is a fan backing a rising artist — every fan gets a weekly hype budget, so attention can’t be bought.',
      dur: 7000,
      run() { call('closeIHYPESheets'); call('setIHYPETab', 'listen'); },
    },
    {
      label: 'Artist page',
      title: 'Real artists, verified',
      body: 'Tap any artist for their page — tracks, upcoming shows, and a verified ✓ badge. This is where hype turns into a following.',
      dur: 7500,
      run() {
        call('setIHYPETab', 'listen');
        const w = win();
        const a = w && w.lookupArtist && w.lookupArtist('Midnight Echo', '#ff5029');
        if (a) call('openIHYPEArtistProfile', a);
      },
    },
    {
      label: 'Events',
      title: 'Tickets, direct from the artist',
      body: 'No scalper markup, no 30% fees. Every event ships with a frozen charter — 70% to the artist, locked the moment tickets go on sale.',
      dur: 7000,
      run() { call('closeIHYPESheets'); call('setIHYPETab', 'events'); },
    },
    {
      label: 'Live show',
      title: 'When the artist goes live',
      body: 'A LIVE show flips the app into the moment — real-time listener count, a hype pulse, and live chat. This is the iHYPE heartbeat.',
      dur: 7500,
      run() {
        call('setIHYPETab', 'events');
        const D = data();
        const live = D && D.shows && (D.shows.find(s => s.status === 'LIVE') || D.shows[0]);
        if (live) call('openIHYPELiveEvent', live);
      },
    },
    {
      label: 'Earn',
      title: 'Promote a show, earn a cut',
      body: 'Any fan or DJ can share a referral link and earn up to 10% of the gate they drive — paid from its own dedicated 10% slice — iHYPE takes 0%.',
      dur: 7500,
      run() { call('closeIHYPESheets'); call('setIHYPETab', 'events'); call('openIHYPEEarnings'); },
    },
    {
      label: 'Your pages',
      title: 'Your home on iHYPE',
      body: 'Pages holds your profile, your crate, your playlists, and — for DJs — the radio studio and earnings. One account, four roles.',
      dur: 7000,
      run() { call('closeIHYPESheets'); call('setIHYPETab', 'pages'); },
    },
    {
      label: 'Join the beta',
      title: 'That’s iHYPE.',
      body: 'Built for desktop, mobile web, iOS, and Android from one codebase. Closed beta is live — join at admin@ihype.org. Replay the tour anytime.',
      dur: 99999,
      run() { call('closeIHYPESheets'); call('setIHYPETab', 'listen'); },
      last: true,
    },
  ];

  let idx = -1, timer = null, rafID = null, paused = false, started = false, ready = false;

  // Build the step list
  STEPS.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'si';
    row.innerHTML = `<div class="dot">${i + 1}</div><div class="t">${s.label}</div>`;
    row.onclick = () => { if (ready) goto(i); };
    elList.appendChild(row);
  });
  const rows = [...elList.children];

  function renderList() {
    rows.forEach((r, i) => {
      r.classList.toggle('on', i === idx);
      r.classList.toggle('done', i < idx);
      r.querySelector('.dot').textContent = i < idx ? '✓' : (i + 1);
    });
  }

  function clearTimers() { clearTimeout(timer); cancelAnimationFrame(rafID); }

  function runProgress(dur) {
    elFill.style.width = '0%';
    if (dur > 90000) { elFill.style.width = '100%'; return; } // last step: no countdown
    const start = performance.now();
    const tick = now => {
      if (paused) { return; }
      const p = Math.min(1, (now - start) / dur);
      elFill.style.width = (p * 100) + '%';
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
    elCount.textContent = (idx + 1) + ' / ' + STEPS.length;
    elNext.textContent = s.last ? 'Replay tour ↻' : 'Next →';
    renderList();
    try { s.run(); } catch (e) {}
    if (!paused) runProgress(s.dur);
    if (!s.last && !paused) timer = setTimeout(() => goto(idx + 1), s.dur);
  }

  elNext.onclick = () => {
    if (!started) { started = true; goto(0); return; }
    const s = STEPS[idx];
    if (s.last) { idx = -1; started = true; goto(0); return; }
    goto(idx + 1);
  };

  elPause.onclick = () => {
    paused = !paused;
    elPause.textContent = paused ? '▶' : '❚❚';
    if (paused) { clearTimers(); }
    else if (started) { runProgress(STEPS[idx].dur); if (!STEPS[idx].last) timer = setTimeout(() => goto(idx + 1), STEPS[idx].dur * (1 - parseFloat(elFill.style.width) / 100 || 1)); }
  };

  // Wait for the embedded app to finish mounting (globals available)
  elTitle.textContent = 'Loading the app…';
  elBody.textContent = 'Spinning up the iHYPE fan app in the iOS frame.';
  elNext.disabled = true; elNext.style.opacity = '.5';
  let waited = 0;
  const poll = setInterval(() => {
    waited += 200;
    if ((win() && typeof win().setIHYPETab === 'function') || waited > 9000) {
      clearInterval(poll);
      ready = true;
      elNext.disabled = false; elNext.style.opacity = '1';
      elTitle.textContent = 'iHYPE in 90 seconds';
      elBody.textContent = 'A guided, auto-advancing tour of the fan app. Press Start — or click any step on the left to jump.';
      elCount.textContent = '0 / ' + STEPS.length;
    }
  }, 200);
})();
