# Tabs

Horizontal tab navigation with active underline indicator and optional count badge.

```jsx
const [tab, setTab] = React.useState('hypes');
<Tabs
  tabs={[{ id:'hypes', label:'Hypes', count:127 }, { id:'shows', label:'Shows', count:14 }]}
  active={tab}
  onChange={setTab}
/>
```

## Notable variants
- `count` — numeric badge next to label (Syne 800, accent when active)
- `accent` — override the active indicator color
- Pairs with `Card` — put `Tabs` inside the card header, content below
