import { redirect } from 'next/navigation';

export default function TicketsAlias() {
  redirect('/app/me?section=tickets');
}
