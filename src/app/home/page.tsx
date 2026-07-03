import { redirect } from 'next/navigation';

// /home is a legacy alias for the pre-redesign Workbench. The Workbench
// system (WorkbenchShellV2/WorkbenchMobile) has been superseded by the
// Listen/Events/Pages design — this route now just forwards old links
// and bookmarks to the new canonical destination.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  redirect('/listen');
}
