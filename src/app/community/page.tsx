import { redirect } from 'next/navigation';

export default function CommunityAlias() {
  redirect('/app/me?section=about');
}
