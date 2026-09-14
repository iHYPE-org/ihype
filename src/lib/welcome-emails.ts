import { sendMarketingEmail } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';

export async function sendDay3NudgeEmail(user: { id: string; email: string; name: string | null }) {
  return sendMarketingEmail(user.id, {
    to: user.email,
    subject: 'Complete your iHYPE profile',
    text: `Hey ${user.name ?? 'there'}, your iHYPE profile is waiting! Add a bio and connect with fans.\n\nAdd your bio: https://ihype.org/app/me/profiles`,
    html: `<p>Hey ${escapeHtml(user.name ?? 'there')}, your iHYPE profile is waiting! Add a bio and connect with fans.</p><p><a href="https://ihype.org/app/me/profiles">Add your bio →</a></p>`,
  });
}

export async function sendDay7NudgeEmail(user: { id: string; email: string; name: string | null }) {
  return sendMarketingEmail(user.id, {
    to: user.email,
    subject: 'Discover shows near you on iHYPE',
    text: `Hey ${user.name ?? 'there'}, there are shows happening near you on iHYPE. Check them out!\n\nFind shows: https://ihype.org/app/map?layer=events`,
    html: `<p>Hey ${escapeHtml(user.name ?? 'there')}, there are shows happening near you on iHYPE. Check them out!</p><p><a href="https://ihype.org/app/map?layer=events">Find shows →</a></p>`,
  });
}
