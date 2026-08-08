(function(){
  if (window.__ihypeThemeToggleLoaded) return; window.__ihypeThemeToggleLoaded = true;
  function ensureTheme(){ if (!window.ihypeToggleTheme) { var s=document.createElement('script'); s.src=(document.currentScript&&document.currentScript.src||'').replace('theme-toggle.js','theme.js'); document.head.appendChild(s); } }
  ensureTheme();
  function icon(){ return (window.ihypeTheme==='light') ? '\u2600\uFE0F' : '\uD83C\uDF19'; }
  function build(){
    if (document.getElementById('ihypeThemeToggle')) return;
    var b = document.createElement('button');
    b.id = 'ihypeThemeToggle';
    b.setAttribute('aria-label','Toggle light/dark theme');
    b.textContent = icon();
    b.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999;width:40px;height:40px;border-radius:50%;border:1px solid var(--line-2,rgba(255,255,255,.16));background:var(--bg-raised,#1a1612);color:var(--ink-1,#f0ebe5);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.25);transition:transform .15s ease';
    document.body.appendChild(b);
  }
  function sync(){ var b=document.getElementById('ihypeThemeToggle'); if (b) b.textContent = icon(); }
  document.addEventListener('click', function(e){ var b=e.target.closest&&e.target.closest('#ihypeThemeToggle'); if (b) { window.ihypeToggleTheme&&window.ihypeToggleTheme(); sync(); } });
  window.addEventListener('ihype-theme-change', sync);
  var tries=0; var timer=setInterval(function(){ if (document.body) { build(); sync(); } if (document.getElementById('ihypeThemeToggle') || ++tries>40) clearInterval(timer); }, 100);
})();
