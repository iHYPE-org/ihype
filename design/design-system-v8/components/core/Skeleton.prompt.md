# Skeleton / SkeletonText

Shimmer-animated loading placeholders. Use while data is fetching.

```jsx
// Single block
<Skeleton width="100%" height={14} />
<Skeleton width={48} height={48} radius={12} />

// Text block (n lines, last line shorter)
<SkeletonText lines={3} lastWidth="60%" />
```

## Notable variants
- `width` / `height` — number (px) or CSS string (`"100%"`)
- `radius` — border-radius in px (default 6)
- `SkeletonText` — compound: renders `lines` stacked Skeletons, last at `lastWidth`
- Requires `ihype-shimmer` @keyframes (included in `tokens/motion.css`)
