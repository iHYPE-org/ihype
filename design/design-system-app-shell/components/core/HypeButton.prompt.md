# HypeButton

The platform's namesake mechanic — tap to cast a HYPE. A flame toggle with a live count, a scale-pop and expanding-ring animation on activation. Use everywhere a fan can hype an artist, track, or show: Discover cards, Show Detail, Track Detail, Profile Page.

```jsx
const [active, setActive] = React.useState(false);
const [count, setCount] = React.useState(4821);
<HypeButton
  active={active}
  count={count.toLocaleString()}
  onToggle={() => { setActive(a => !a); setCount(c => c + (active ? -1 : 1)); }}
/>
```

Out-of-budget state (fans get a weekly hype budget — see `IHYPE_HYPE_BRIDGE` in the fan app):

```jsx
<HypeButton active={false} count="1,204" disabled disabledReason="0 hypes left — resets Monday" onToggle={() => {}} />
```

Notable props:
- `size` — `sm` | `md` | `lg` (default `md`). Use `sm` in dense list rows, `lg` on a hero/profile page.
- `roleColor` — override the flame color to match a role-scoped context (defaults to brand accent `#ff5029`).
- `trend` — optional momentum readout after the count, e.g. `"▲ 340/hr"`. Use it wherever recent velocity is known (a trending rail, a live show) — the demand-signal mechanic is what makes HYPE different from a plain like count, so surface it whenever you have the data.
- The component owns only the tap animation (pop + ring) — count math and the weekly hype-budget limit are the caller's responsibility.

Do not re-implement the flame icon or count inline — every hype affordance in the app should go through this component so the tap feel (and disabled-budget state) is consistent everywhere HYPE appears.
