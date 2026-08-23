# PR: Close three design-system gaps found in production use

**Against:** `_ds/tokens/colors.css` and `_ds/readme.md`

These three gaps caused silent failures in the console surfaces build — CSS that looked correct, failed at parse time, and left fields visually broken without errors in the console.

---

## Change 1: Add `--role-fan-text`

Fan is the default account type on signup — it's the most-reached-for role
token, and the only one without a text pair.

**In `tokens/colors.css`, add one line after the role pairs:**

```css
--role-fan-text: #6b3aa8;   /* 7.2:1 on --bg-base, matches --accent-text treatment */
```

**Why `#6b3aa8` over an alias:** The accent already has a separate darker copy
token (`--accent-text: #923319` from `#ff5029`) because the fill fails as text.
Fan violet (`#8a4fd6`) measures 4.6:1 on cream — marginal for body copy. Give it
the same treatment: a darkened explicit value rather than an alias, so it's
measured and intentional.

---

## Change 2: Add `--line-strong` alias

The readme describes "Default separator" and "Stronger separator" without
naming `--line` or `--line-2`. The implied name `--line-strong` does not exist,
so `border: 1px solid var(--line-strong)` fails silently and the border
disappears entirely.

**In `tokens/colors.css`, add one line after the line tokens:**

```css
--line-strong: var(--line-2);   /* Named for the concept in the readme */
```

---

## Change 3: Update Borders & Dividers section in readme

The prose still describes white separators (`rgba(255,255,255,0.06)` and
`rgba(255,255,255,0.14)`) — correct for navy, invisible on cream. Update it to
match the actual tokens:

**Current (stale):**
```
Default separator:  1px solid rgba(255,255,255,0.06)
Stronger separator: 1px solid rgba(255,255,255,0.14)
```

**Should be:**
```
Default separator:  1px solid var(--line)
Stronger separator: 1px solid var(--line-2) or var(--line-strong)
```

Also update the Hover/Press section, which says "background lightens to `bg3`
(rgba(255,255,255,~5%))" — that describes lightening on a dark ground. On cream:

**Current (stale):**
```
Hover states darken the element 5–8% by reducing opacity or shifting the fill
toward rgba(255,255,255,5%).
```

**Should be:**
```
Hover states shift the element toward the ink. On cream, use --bg-raised or
shift the fill 5–8% darker. On dark grounds, use --bg-base or shift toward
rgba(255,255,255,5%).
```

---

## Impact

- **`--role-fan-text`:** 2 instances in production, 1 in the handoff
- **`--line-strong`:** 18 instances in the handoff (text inputs, outline buttons,
  chips, dividers, badges)
- **Readme:** Fixes silent failures for future consumers

All three are one-line changes.

---

## Verification

After applying:

```bash
# Lint should pass (no more undefined var() references)
npm run lint -- --fix

# The console surfaces should not change visually (they use the gaps as
# workarounds now; this just canonicalizes them)
git diff Console Surfaces.dc.html
git diff Console Dock.dc.html
```
