import { redirect } from 'next/navigation';

export default function DashboardAlias() {
  redirect('/app/me');
}
