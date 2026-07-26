---
name: ihype-design
description: Use this skill to generate well-branded interfaces and assets for iHYPE, the music fan engagement platform. Contains design guidelines, color/type/spacing tokens, fonts, UI kit components, and full interactive prototypes for the Android App and Desktop Workbench surfaces.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

Key surfaces:
- **Android App** (`ui_kits/android_app/index.html`) — Fan-facing mobile app. Dark, 390px wide. Bottom nav: Home · Seeds · Shows · Charts · You.
- **Workbench** (`ui_kits/workbench/index.html`) — Artist/Venue/Promoter dashboard. Desktop, full-viewport. Left rail: Home · Seeds · Charts · Shows · Govern · Settings.

Core tokens to use: `--bg-base` (#0a0805), `--accent` (#ff5029), role colors Fan `#b983ff` / Artist `#ff5029` / Venue `#22e5d4` / Promoter `#ff3e9a`. Type: Syne 800 for display, DM Sans for body, JetBrains Mono for eyebrows/metadata.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
