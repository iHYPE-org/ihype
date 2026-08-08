(function(){
  if (window.__ihypeThemeLoaded) return; window.__ihypeThemeLoaded = true;
  var KEY = 'ihype-theme';
  function apply(t) { document.documentElement.setAttribute('data-theme', t); }
  function get() { try { return localStorage.getItem(KEY) || 'dark'; } catch(e) { return 'dark'; } }
  function set(t) { try { localStorage.setItem(KEY, t); } catch(e) {} apply(t); window.dispatchEvent(new CustomEvent('ihype-theme-change', { detail: { theme: t } })); }
  window.ihypeTheme = get();
  apply(window.ihypeTheme);
  window.ihypeSetTheme = function(t) { window.ihypeTheme = t; set(t); };
  window.ihypeToggleTheme = function() { window.ihypeSetTheme(window.ihypeTheme === 'light' ? 'dark' : 'light'); };
})();
