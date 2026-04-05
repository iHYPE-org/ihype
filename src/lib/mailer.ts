import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

let transporter: nodemailer.Transporter | null = null;

function parseSmtpSecureFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function isPasswordResetEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM);
}

function getTransporter() {
  if (!isPasswordResetEmailConfigured()) {
    throw new Error('SMTP is not configured for password reset email delivery.');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: parseSmtpSecureFlag(env.SMTP_SECURE),
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD
            }
          : undefined
    });
  }

  return transporter;
}

type PasswordResetEmailInput = {
  email: string;
  code: string;
  name?: string | null;
  expiresInMinutes: number;
};

type IssuedTicketEmailInput = {
  email: string;
  name?: string | null;
  showTitle: string;
  venueName?: string | null;
  eventOpensAtLabel?: string | null;
  totalChargeLabel: string;
  tickets: Array<{
    label: string;
    serializedId: string;
    verificationUrl: string;
    qrCodeDataUrl?: string | null;
  }>;
};

export async function sendPasswordResetPasscodeEmail({
  email,
  code,
  name,
  expiresInMinutes
}: PasswordResetEmailInput) {
  if (!isPasswordResetEmailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[password-reset] ${email} -> ${code} (valid ${expiresInMinutes} minutes)`);
      return { mode: 'log' as const };
    }

    throw new Error('Password reset email delivery is not configured.');
  }

  const resolvedName = name?.trim() || 'there';
  const transport = getTransporter();

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'iHYPE password reset passcode',
    text: [
      `Hi ${resolvedName},`,
      '',
      `Your iHYPE password reset passcode is ${code}.`,
      `It expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request this change, you can ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
        <p style="margin:0 0 16px;">Hi ${resolvedName},</p>
        <p style="margin:0 0 16px;">Your iHYPE password reset passcode is:</p>
        <div style="margin:0 0 20px;padding:18px 20px;border-radius:16px;background:#10182a;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.28em;text-align:center;">
          ${code}
        </div>
        <p style="margin:0 0 12px;">It expires in ${expiresInMinutes} minutes.</p>
        <p style="margin:0;color:#5b657a;">If you did not request this change, you can safely ignore this email.</p>
      </div>
    `
  });

  return { mode: 'smtp' as const };
}

export async function sendIssuedTicketEmail({
  email,
  name,
  showTitle,
  venueName,
  eventOpensAtLabel,
  totalChargeLabel,
  tickets
}: IssuedTicketEmailInput) {
  if (!isPasswordResetEmailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[ticket-email] ${email} -> ${showTitle} (${tickets.length} ticket${tickets.length === 1 ? '' : 's'})`
      );
      return { mode: 'log' as const };
    }

    throw new Error('Ticket email delivery is not configured.');
  }

  const resolvedName = name?.trim() || 'there';
  const transport = getTransporter();
  const ticketLines = tickets
    .map((ticket) => `${ticket.label}: ${ticket.serializedId} | ${ticket.verificationUrl}`)
    .join('\n');

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: `iHYPE tickets for ${showTitle}`,
    text: [
      `Hi ${resolvedName},`,
      '',
      `Your ticket${tickets.length === 1 ? ' is' : 's are'} ready for ${showTitle}.`,
      venueName ? `Venue: ${venueName}` : null,
      eventOpensAtLabel ? `Event time: ${eventOpensAtLabel}` : null,
      `Charge: ${totalChargeLabel}`,
      '',
      'Ticket details:',
      ticketLines,
      '',
      'Present the QR-coded ticket at entry. Each ticket is single-use.'
    ]
      .filter(Boolean)
      .join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#10182a;">
        <p style="margin:0 0 16px;">Hi ${resolvedName},</p>
        <p style="margin:0 0 16px;">Your ticket${tickets.length === 1 ? ' is' : 's are'} ready for <strong>${showTitle}</strong>.</p>
        <div style="margin:0 0 18px;padding:16px 18px;border-radius:18px;background:#10182a;color:#ffffff;">
          ${venueName ? `<p style="margin:0 0 8px;"><strong>Venue:</strong> ${venueName}</p>` : ''}
          ${eventOpensAtLabel ? `<p style="margin:0 0 8px;"><strong>Event time:</strong> ${eventOpensAtLabel}</p>` : ''}
          <p style="margin:0;"><strong>Charge:</strong> ${totalChargeLabel}</p>
        </div>
        <div style="display:grid;gap:14px;">
          ${tickets
            .map(
              (ticket) => `
                <div style="padding:16px 18px;border-radius:18px;border:1px solid #d6deea;background:#f8fbff;">
                  <p style="margin:0 0 8px;font-weight:700;">${ticket.label}</p>
                  <p style="margin:0 0 8px;"><strong>ID:</strong> ${ticket.serializedId}</p>
                  <p style="margin:0 0 12px;"><a href="${ticket.verificationUrl}" style="color:#1f6feb;">Verify ticket</a></p>
                  ${ticket.qrCodeDataUrl ? `<img src="${ticket.qrCodeDataUrl}" alt="QR code for ${ticket.label}" style="width:160px;height:160px;border-radius:14px;border:1px solid #d6deea;background:#ffffff;padding:8px;" />` : ''}
                </div>
              `
            )
            .join('')}
        </div>
        <p style="margin:18px 0 0;color:#5b657a;">Present the QR-coded ticket at entry. Each ticket is single-use.</p>
      </div>
    `
  });

  return { mode: 'smtp' as const };
}
