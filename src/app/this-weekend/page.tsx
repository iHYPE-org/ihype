import { redirect } from 'next/navigation';

export default function ThisWeekendAlias() {
  redirect('/app/map?layer=events');
}
