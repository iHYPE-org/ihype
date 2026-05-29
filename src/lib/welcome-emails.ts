import { sendEmailToUser } from '@/lib/mailer';

export async function sendWelcomeEmail(user: { id: string; email: string; name: string | null }) {
  return sendEmailToUser(user.id, {
    to: user.email,
    subject: 'Welcome to iHYPE 🎵',
    text: `Hey ${user.name ?? 'there'}, welcome to iHYPE! Start by exploring Seeds to discover new music.\n\nOpen iHYPE: https://ihype.org/home`,
    html: `<p>Hey ${user.name ?? 'there'}, welcome to iHYPE! Start by exploring Seeds to discover new music.</p><p><a href="https://ihype.org/home">Open iHYPE →</a></p>`,
  });
}

export async function sendDay3NudgeEmail(user: { id: string; email: string; name: string | null }) {
  return sendEmailToUser(user.id, {
    to: user.email,
    subject: 'Complete your iHYPE profile',
    text: `Hey ${user.name ?? 'there'}, your iHYPE profile is waiting! Add a bio and connect with fans.\n\nGo to iHYPE: https://ihype.org/home`,
    html: `<p>Hey ${user.name ?? 'there'}, your iHYPE profile is waiting! Add a bio and connect with fans.</p><p><a href="https://ihype.org/home">Go to iHYPE →</a></p>`,
  });
}

export async function sendDay7NudgeEmail(user: { id: string; email: string; name: string | null }) {
  return sendEmailToUser(user.id, {
    to: user.email,
    subject: 'Discover shows near you on iHYPE',
    text: `Hey ${user.name ?? 'there'}, there are shows happening near you on iHYPE. Check them out!\n\nFind shows: https://ihype.org/home`,
    html: `<p>Hey ${user.name ?? 'there'}, there are shows happening near you on iHYPE. Check them out!</p><p><a href="https://ihype.org/home">Find shows →</a></p>`,
  });
}
