import { redirect } from 'next/navigation';

// The generic creator workbench, retired with /home above. Its former
// responsibilities are the MUSIC module (discovery, radio), /events/new (event
// creation) and each role's own profile page.
export default function StudioRedirect() {
  redirect('/app/map');
}
