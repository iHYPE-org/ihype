iHYPE i18n backup — includes legal body copy
date: 2026-07-26
languages: hi, ru, it, ko, zh, es, fr, pt, ar, de, ja
keys per language: 1468 (1400 UI + 68 legal body blocks)

Contents:
  <lang>.js.txt      per-locale dictionary chunks
  i18n.js.txt        i18n core/loader
  Legal.dc.html.txt  legal template (Privacy / Terms / Charter / DMCA)

Files use a .js.txt / .html.txt extension so the design-system
compiler does not try to compile them as project source.

Restore: strip the trailing .txt and copy <lang>.js into lib/i18n-data/,
i18n.js into lib/, Legal.dc.html into templates/legal/.

NOTE: translated legal text is provided for convenience only. The
English version is the legally binding text and each locale shows a
notice to that effect. Have counsel review before launch.
