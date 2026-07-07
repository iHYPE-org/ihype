import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { readClientAddress } from '@/lib/request-meta';

type LoginUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  lastLoginCountry: string | null;
};

const ADMIN_ALERT_EMAIL = 'admin@ihype.org';

// Notifies admin@ihype.org every time an ADMIN-role account signs in — an
// audit trail, not a credential; the account's own passkey/magic-link is
// what actually gates access.
function notifyAdminLogin(user: LoginUser, request: Request) {
  if (user.role !== 'ADMIN') return;

  const country = request.headers.get('cf-ipcountry') ?? 'unknown';
  const ip = readClientAddress(request) ?? 'unknown';
  const when = new Date().toISOString();
  const who = user.name?.trim() || user.email || user.id;

  sendGenericEmail({
    to: ADMIN_ALERT_EMAIL,
    subject: `Admin login — ${who}`,
    text: [
      `Admin account login recorded.`,
      '',
      `Account: ${who}${user.email ? ` (${user.email})` : ''}`,
      `Time: ${when}`,
      `Country: ${country}`,
      `IP: ${ip}`,
      '',
      'This is an automated audit notification — no action needed if this was expected.',
      '',
      '— iHYPE'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
        <h2 style="margin:0 0 12px;">Admin login recorded</h2>
        <p><strong>Account:</strong> ${who}${user.email ? ` (${user.email})` : ''}</p>
        <p><strong>Time:</strong> ${when}</p>
        <p><strong>Country:</strong> ${country}</p>
        <p><strong>IP:</strong> ${ip}</p>
        <p style="color:#5b657a;font-size:12px;">Automated audit notification — no action needed if this was expected.</p>
      </div>
    `
  }).catch((e: unknown) => { console.error('[login-security] admin-login alert failed', e); });
}

// Alerts a user by email when a login comes from a different country than
// their last known login, then records the new country/timestamp. Called
// from every real sign-in path (magic link, passkey) — there is no
// password/OTP path left to also wire this into.
export async function checkAndRecordLogin(user: LoginUser, request: Request) {
  notifyAdminLogin(user, request);

  const currentCountry = request.headers.get('cf-ipcountry');

  if (currentCountry && user.lastLoginCountry && user.lastLoginCountry !== currentCountry && user.email) {
    const userName = user.name?.trim() || user.email;
    sendGenericEmail({
      to: user.email,
      subject: 'New login from a different country — iHYPE',
      text: [
        `Hi ${userName},`,
        '',
        `We detected a login to your iHYPE account from a new country (${currentCountry}).`,
        `Your previous login was from ${user.lastLoginCountry}.`,
        '',
        'If this was you, no action is needed.',
        'If you did not log in, remove any passkeys you do not recognize from Settings and contact admin@ihype.org.',
        '',
        '— iHYPE'
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
          <h2 style="margin:0 0 12px;">New login from a different country</h2>
          <p>Hi ${userName},</p>
          <p>We detected a login to your iHYPE account from <strong>${currentCountry}</strong>. Your previous login was from <strong>${user.lastLoginCountry}</strong>.</p>
          <p>If this was you, no action is needed. If you did not log in, remove any passkeys you do not recognize from Settings and contact admin@ihype.org.</p>
          <p style="color:#5b657a;font-size:12px;">— iHYPE</p>
        </div>
      `
    }).catch((e: unknown) => { console.error('[login-security] country-change email failed', e); });
  }

  db.user.update({
    where: { id: user.id },
    data: {
      lastLoginCountry: currentCountry ?? undefined,
      lastLoginAt: new Date()
    }
  }).catch((e: unknown) => { console.error('[login-security] last-login update failed', e); });
}
