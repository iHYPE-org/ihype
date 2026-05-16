import nodemailer from 'nodemailer';
import { recordEmailDelivery } from '@/lib/audit';
import { env } from '@/lib/env';

let transporter: nodemailer.Transporter | null = null;

function parseSmtpSecureFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function isSmtpEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM);
}

function getEmailFrom() {
  return env.EMAIL_FROM || env.SMTP_FROM;
}

export function isResendEmailConfigured() {
  return Boolean(env.RESEND_API_KEY && getEmailFrom());
}

export function isEmailDeliveryConfigured() {
  return isResendEmailConfigured() || isSmtpEmailConfigured();
}

function getTransporter() {
  if (!isSmtpEmailConfigured()) {
    throw new Error('SMTP is not configured for email delivery.');
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

type ConfiguredEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendGenericEmail(input: ConfiguredEmailInput) {
  if (!isEmailDeliveryConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[generic-email] ${input.to} :: ${input.subject}`);
      return { mode: 'log' as const };
    }
    throw new Error('Email delivery is not configured.');
  }
  const provider = await sendConfiguredEmail(input);
  return { mode: provider };
}

async function sendConfiguredEmail(input: ConfiguredEmailInput) {
  const from = getEmailFrom();
  if (!from) {
    throw new Error('Email sender is not configured.');
  }

  // Prefer Resend's HTTPS API when available. It avoids SMTP credential drift
  // and works well in Vercel serverless functions.
  if (isResendEmailConfigured()) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const nestedError = payload.error;
      const message =
        typeof payload.message === 'string'
          ? payload.message
          : nestedError && typeof nestedError === 'object' && 'message' in nestedError && typeof nestedError.message === 'string'
            ? nestedError.message
          : typeof payload.error === 'string'
            ? payload.error
            : `HTTP ${response.status}`;
      throw new Error(`Resend email delivery failed: ${message}`);
    }

    return 'resend' as const;
  }

  const transport = getTransporter();
  await transport.sendMail({
    from,
    ...input
  });

  return 'smtp' as const;
}

type LoginOtpEmailInput = {
  email: string;
  name?: string | null;
  otp: string;
};

export async function sendLoginOtpEmail({ email, name, otp }: LoginOtpEmailInput) {
  const resolvedName = name?.trim() || 'there';

  if (!isEmailDeliveryConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[login-otp] ${email} -> ${otp}`);
      await recordEmailDelivery({ type: 'login-otp', recipient: email, status: 'LOGGED', provider: 'console' });
      return { mode: 'log' as const };
    }
    throw new Error('SMTP is not configured for OTP email delivery.');
  }

  try {
    const provider = await sendConfiguredEmail({
      to: email,
      subject: 'Your iHYPE sign-in code',
      text: [
      `Hi ${resolvedName},`,
      '',
      `Your iHYPE sign-in code is ${otp}.`,
      'It expires in 10 minutes. Do not share it.',
      '',
      'If you did not request this, you can safely ignore this email.'
    ].join('\n'),
      html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
        <p style="margin:0 0 16px;">Hi ${resolvedName},</p>
        <p style="margin:0 0 16px;">Your iHYPE sign-in code is:</p>
        <div style="margin:0 0 20px;padding:18px 20px;border-radius:16px;background:#10182a;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:0.35em;text-align:center;">
          ${otp}
        </div>
        <p style="margin:0 0 12px;">Expires in 10 minutes. Do not share this code.</p>
        <p style="margin:0;color:#5b657a;">If you did not try to sign in to iHYPE, you can safely ignore this email.</p>
      </div>
    `
    });
    await recordEmailDelivery({ type: 'login-otp', recipient: email, status: 'SENT', provider });
  } catch (error) {
    await recordEmailDelivery({
      type: 'login-otp',
      recipient: email,
      status: 'FAILED',
      provider: isResendEmailConfigured() ? 'resend' : 'smtp',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  return { mode: isResendEmailConfigured() ? ('resend' as const) : ('smtp' as const) };
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
  if (!isEmailDeliveryConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[password-reset] ${email} -> ${code} (valid ${expiresInMinutes} minutes)`);
      await recordEmailDelivery({ type: 'password-reset', recipient: email, status: 'LOGGED', provider: 'console' });
      return { mode: 'log' as const };
    }

    throw new Error('Password reset email delivery is not configured.');
  }

  const resolvedName = name?.trim() || 'there';

  try {
    const provider = await sendConfiguredEmail({
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
    await recordEmailDelivery({ type: 'password-reset', recipient: email, status: 'SENT', provider });
  } catch (error) {
    await recordEmailDelivery({
      type: 'password-reset',
      recipient: email,
      status: 'FAILED',
      provider: isResendEmailConfigured() ? 'resend' : 'smtp',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  return { mode: isResendEmailConfigured() ? ('resend' as const) : ('smtp' as const) };
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
  if (!isEmailDeliveryConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[ticket-email] ${email} -> ${showTitle} (${tickets.length} ticket${tickets.length === 1 ? '' : 's'})`
      );
      await recordEmailDelivery({ type: 'ticket', recipient: email, status: 'LOGGED', provider: 'console' });
      return { mode: 'log' as const };
    }

    throw new Error('Ticket email delivery is not configured.');
  }

  const resolvedName = name?.trim() || 'there';
  const ticketLines = tickets
    .map((ticket) => `${ticket.label}: ${ticket.serializedId} | ${ticket.verificationUrl}`)
    .join('\n');

  try {
    const provider = await sendConfiguredEmail({
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
    await recordEmailDelivery({ type: 'ticket', recipient: email, status: 'SENT', provider });
  } catch (error) {
    await recordEmailDelivery({
      type: 'ticket',
      recipient: email,
      status: 'FAILED',
      provider: isResendEmailConfigured() ? 'resend' : 'smtp',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  return { mode: isResendEmailConfigured() ? ('resend' as const) : ('smtp' as const) };
}
