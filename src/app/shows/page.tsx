import { redirect } from 'next/navigation';

/** Retired — the events surface is the MAP module now. See /app. */
export default function ShowsPage() {
  redirect('/app/map');
}
