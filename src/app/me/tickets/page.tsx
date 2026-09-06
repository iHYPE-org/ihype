import { redirect } from 'next/navigation';

// One hop, straight to the wallet. This used to bounce through /tickets and
// then /app/me?section=tickets — three redirects for one URL in sent email.
export default function MeTicketsRedirect() { redirect('/app/tickets'); }
