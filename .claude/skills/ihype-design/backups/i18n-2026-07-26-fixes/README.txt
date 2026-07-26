iHYPE i18n BUG FIXES backup
date: 2026-07-26
files: 15

Two bug classes fixed, both caused silent English fallback despite
complete translations existing in all 11 languages.

BUG 1 — stale labels (7 files)
  renderVals() ran before the async locale chunk applied, so t() fell
  back to English defaults and baked them into component state. Fixed
  by adding an 'ihype-i18n-change' listener that calls forceUpdate():
    Legal, Payouts, TrustPolicy, BookingInbox, ShowDetail,
    EventCreate, RoleDashboard

BUG 2 — missing i18n include (8 files)
  ds-base.js loads only CSS + _ds_bundle.js, NOT i18n. These files had
  live data-i18n markup / ihypeT calls but window.ihypeT was undefined.
  Fixed by adding <script src="../../lib/i18n.js"></script>:
    advertiser-signup, event-cancel, ops-console, support-tickets,
    track-detail, transparency, verify   (added to helmet)
    fan-app/index.html                   (added to head; the .dc.html
                                          is only an iframe wrapper)

Files use .txt so the design-system compiler skips them.
Restore: strip the trailing .txt, convert __ back to /, place under templates/.

STILL UNVERIFIED: none of these fixes have been visually confirmed in a
non-English locale. See todos 79 and 80.
