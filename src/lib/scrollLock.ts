let lockCount = 0;

/**
 * Reference-counted html/body scroll lock. Multiple independent callers
 * (MobileQuickGrid's own grid overlay, MobileAppShell's outer carousel) can
 * each hold a lock at once — the class only comes off once every holder has
 * released, so one releasing early doesn't reopen scroll out from under
 * another that still needs it locked.
 */
export function acquireScrollLock() {
  lockCount += 1;
  document.documentElement.classList.add('mqg-scroll-lock');
  document.body.classList.add('mqg-scroll-lock');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.documentElement.classList.remove('mqg-scroll-lock');
      document.body.classList.remove('mqg-scroll-lock');
    }
  };
}
