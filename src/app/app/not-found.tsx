import { MmmMissing } from '@/components/mmm/MmmMissing';

/**
 * The not-found boundary for `/app/*`, for URLs that match no route at all.
 *
 * Pages that discover a missing row mid-render should RETURN `<MmmMissing />`
 * rather than call `notFound()` — see that component for why (the async layout
 * has already flushed, so throwing renders the shell twice). This boundary is
 * for the case where nothing has streamed and it is the only renderer.
 */
export default function MmmNotFound() {
  return <MmmMissing />;
}
