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

type TicketEmailTicket = {
  label: string;
  serializedId: string;
  verificationUrl: string;
  qrCodeDataUrl: string;
};

type TicketIssuedEmailInput = {
  email: string;
  name?: string | null;
  showTitle: string;
  venueName?: string | null;
  eventOpensAtLabel?: string | null;
  totalChargeLabel: string;
  tickets: TicketEmailTicket[];
};

export async function sendIssuedTicketEmail({
  email,
  name,
  showTitle,
  venueName,
  eventOpensAtLabel,
  totalChargeLabel,
  tickets
}: TicketIssuedEmailInput) {
  if (!isPasswordResetEmailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[ticket-email] ${email} -> ${showTitle} (${tickets.length} ticket${tickets.length === 1 ? '' : 's'})`);
      return { mode: 'log' as const };
    }

    throw new Error('Ticket email delivery is not configured.');
  }

  const resolvedName = name?.trim() || 'there';
  const transport = getTransporter();
  const ticketLines = tickets
    .map((ticket) => `${ticket.label}: ${ticket.serializedId} -> ${ticket.verificationUrl}`)
    .join('\n');
  const ticketCards = tickets
    .map(
      (ticket) => `
        <div style="padding:16px;border:1px solid rgba(16,24,42,0.1);border-radius:18px;margin:0 0 16px;">
          <p style="margin:0 0 10px;font-weight:700;">${ticket.label}</p>
          <img alt="${ticket.label} QR code" src="${ticket.qrCodeDataUrl}" style="width:180px;height:180px;border-radius:14px;display:block;margin:0 0 10px;" />
          <p style="margin:0 0 6px;">Serialized ticket: <strong>${ticket.serializedId}</strong></p>
          <p style="margin:0;"><a href="${ticket.verificationUrl}">${ticket.verificationUrl}</a></p>
        </div>
      `
    )
    .join('');

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: `iHYPE tickets for ${showTitle}`,
    text: [
      `Hi ${resolvedName},`,
      '',
      `Your ticket${tickets.length === 1 ? '' : 's'} for ${showTitle} ${venueName ? `at ${venueName}` : ''} ${eventOpensAtLabel ? `are now active for ${eventOpensAtLabel}.` : 'are now active.'}`,
      `Total charge: ${totalChargeLabel}`,
      '',
      ticketLines,
      '',
      'Keep each QR code ready at entry. Tickets are single-use tokens. If you need to resell at face value, contact the venue so it can reassign the ticket to the new owner.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#10182a;">
        <p style="margin:0 0 16px;">Hi ${resolvedName},</p>
        <p style="margin:0 0 16px;">
          Your ticket${tickets.length === 1 ? '' : 's'} for <strong>${showTitle}</strong>${venueName ? ` at <strong>${venueName}</strong>` : ''} ${eventOpensAtLabel ? `are now active for ${eventOpensAtLabel}.` : 'are now active.'}
        </p>
        <p style="margin:0 0 20px;">Total charge: <strong>${totalChargeLabel}</strong></p>
        ${ticketCards}
        <p style="margin:18px 0 0;color:#5b657a;">
          Each QR code is a single-use ticket token. If you need to resell at face value, contact the venue so it can reassign the ticket to the new owner.
        </p>
      </div>
    `
  });

  return { mode: 'smtp' as const };
}
