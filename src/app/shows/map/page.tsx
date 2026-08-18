import { redirect } from 'next/navigation';

export default function ShowsMapAlias() {
  redirect('/app/map?layer=events');
}
