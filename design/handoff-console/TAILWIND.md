# Tailwind bridge

Only relevant if the repo uses Tailwind. Skip otherwise.

## The problem

Tailwind is the most common single cause of drift in a token-based design,
because `bg-amber-50` is *right there* and `var(--bg-base)` is not. The
implementer is not being lazy — the tool is steering.

## The fix

Make the tokens the *only* Tailwind palette. Delete the default one. Then
`bg-base` is the path of least resistance and `bg-amber-50` doesn't exist.

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    // NOT 'extend' — a full replace. The default palette must not survive.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      base:    'var(--bg-base)',
      surface: 'var(--bg-surface)',
      raised:  'var(--bg-raised)',
      overlay: 'var(--bg-overlay)',

      ink:   { 1: 'var(--ink-1)', 2: 'var(--ink-2)', 3: 'var(--ink-3)', 4: 'var(--ink-4)' },

      accent:      'var(--accent)',        // fill only
      'accent-text': 'var(--accent-text)', // the word
      'ink-on-accent': 'var(--ink-on-accent)',

      walnut: { DEFAULT: 'var(--walnut)', 2: 'var(--walnut-2)', 3: 'var(--walnut-3)' },
      'on-walnut': { DEFAULT: 'var(--ink-on-walnut)', 2: 'var(--ink-on-walnut-2)', 3: 'var(--ink-on-walnut-3)' },

      brass: { DEFAULT: 'var(--brass)', deep: 'var(--brass-deep)' },
      lamp:  'var(--lamp)',
      ash:   { DEFAULT: 'var(--ash)', 2: 'var(--ash-2)' },

      map: { void: 'var(--map-void)', ink: 'var(--map-ink)', line: 'var(--map-line)', pin: 'var(--map-pin)' },

      role: {
        fan: 'var(--role-fan)', artist: 'var(--role-artist)',
        venue: 'var(--role-venue)', advertiser: 'var(--role-advertiser)',
        promoter: 'var(--role-promoter)', // the 10% slice. NOT an account type.
      },

      line: 'var(--line)', 'line-2': 'var(--line-2)',
      success: 'var(--success)', warning: 'var(--warning)',
      error: 'var(--color-error)', info: 'var(--color-info)', live: 'var(--live)',
    },

    spacing: {
      0: '0', px: '1px',
      1: 'var(--space-1)',  2: 'var(--space-2)',  3: 'var(--space-3)',
      4: 'var(--space-4)',  5: 'var(--space-5)',  6: 'var(--space-6)',
      8: 'var(--space-8)',  10: 'var(--space-10)',
      12: 'var(--space-12)', 16: 'var(--space-16)',
    },

    borderRadius: {
      none: '0',
      panel: 'var(--radius-panel)',   // 3px — cards, rows, stats
      sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)', '2xl': 'var(--radius-2xl)', '3xl': 'var(--radius-3xl)',
      trigger: 'var(--radius-trigger)',
      pill: 'var(--radius-pill)', full: 'var(--radius-full)',
    },

    fontFamily: {
      display: 'var(--font-display)',  // Instrument Serif
      body:    'var(--font-body)',     // Work Sans
      mono:    'var(--font-mono)',     // JetBrains Mono
    },

    fontSize: {
      // No size below --text-base for content. xs is mono eyebrows only.
      xs: 'var(--text-xs)',  sm: 'var(--text-sm)',  base: 'var(--text-base)',
      md: 'var(--text-md)',  lg: 'var(--text-lg)',  xl: 'var(--text-xl)',
      '2xl': 'var(--text-2xl)', '3xl': 'var(--text-3xl)',
    },

    boxShadow: {
      card: 'var(--shadow-card)', raised: 'var(--shadow-raised)',
      play: 'var(--shadow-play)', album: 'var(--shadow-album)',
      glow: 'var(--shadow-glow)', trigger: 'var(--shadow-trigger)',
      none: 'none',
    },

    screens: { sm: '480px', console: '620px', md: '768px', lg: '1024px', xl: '1280px' },

    transitionTimingFunction: {
      DEFAULT: 'var(--ease-default)', spring: 'var(--ease-spring)',
      out: 'var(--ease-out)', sharp: 'var(--ease-sharp)',
    },
    transitionDuration: {
      fast: 'var(--duration-fast)', DEFAULT: 'var(--duration-default)',
      medium: 'var(--duration-medium)', slow: 'var(--duration-slow)',
    },
  },
};
```

## Two things this deliberately does not solve

**Arbitrary values.** `bg-[#ff5029]` still compiles. Add a lint rule:

```js
{ selector: "Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]",
  message: "Arbitrary hex in a Tailwind class — use a token utility." }
```

**Material discipline.** Tailwind cannot know that `text-ink-1` on
`bg-walnut` is wrong. That stays a review item — it's #1 on the PR checklist
in `RULES.md` for exactly this reason.

## Do not use Tailwind for the console materials

`.walnut-panel`, `.tuner-dial`, `.mmm-console`, `.walnut-plate` and
`.map-parchment` are multi-layer background stacks with blend modes and
inset shadow pairs. They are unreadable as utility strings and unmaintainable
once written. Use the classes from the bundle.
