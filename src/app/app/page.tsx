import { redirect } from 'next/navigation';

// MAP is the shell's default surface.
export default function MmmIndex() {
  redirect('/app/map');
}
