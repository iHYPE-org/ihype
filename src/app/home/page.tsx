import { redirect } from 'next/navigation';

// /home is a compatibility alias. Old links and bookmarks go directly to the
// canonical Music · Map · Me landing surface; no previous shell renders here.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  redirect('/app/map');
}
