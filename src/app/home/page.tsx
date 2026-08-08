import { redirect } from 'next/navigation';

// /home is a legacy alias for the pre-redesign Workbench, which v8 retired
// outright (ROUTE_TEMPLATE_MAP.md, Removed: templates/workbench/). It forwarded
// to /listen until that surface was retired too; both now land in the
// Music · Map · Me shell, which is the only app shell.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  redirect('/app/map');
}
