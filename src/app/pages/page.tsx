import { redirect } from 'next/navigation';

/** Retired — page management lives under ME now. See /app. */
export default function PagesPage() {
  redirect('/app/me');
}
