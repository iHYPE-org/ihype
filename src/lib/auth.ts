// next-auth is pinned to 5.0.0-beta.31 — do not bump without reading the beta
// changelog for session/jwt callback shape changes, adapter interface changes,
// and cookie config renames. @auth/prisma-adapter must be bumped together.
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { authConfig } from '@/lib/auth.config';
import { sendGenericEmail } from '@/lib/mailer';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: {
        challengeId: { label: 'Challenge ID', type: 'text' },
        otp: { label: 'Code', type: 'text' }
      },
      async authorize(credentials, request) {
        if (!credentials?.challengeId || !credentials?.otp) return null;

        const clientAddress = readClientAddress(request);
        const rateLimit = await consumeRateLimit(`otp-verify:${clientAddress}`, {
          limit: 10,
          windowMs: 15 * 60 * 1000
        });
        if (!rateLimit.allowed) return null;

        const challenge = await db.mfaChallenge.findUnique({
          where: { token: String(credentials.challengeId) },
          include: { user: true }
        });

        if (!challenge || !challenge.secretCiphertext) return null;
        if (challenge.expiresAt < new Date()) {
          await db.mfaChallenge.delete({ where: { id: challenge.id } });
          return null;
        }

        const isValid = await bcrypt.compare(String(credentials.otp), challenge.secretCiphertext);
        if (!isValid) return null;

        await db.mfaChallenge.delete({ where: { id: challenge.id } });

        // Suspicious login detection: alert if country differs from last known login country.
        const currentCountry = (request as { headers?: { get?: (k: string) => string | null } }).headers?.get?.('cf-ipcountry') ?? null;
        if (currentCountry && challenge.user.lastLoginCountry && challenge.user.lastLoginCountry !== currentCountry) {
          const userEmail = challenge.user.email;
          const userName = challenge.user.name?.trim() || userEmail || 'iHYPE user';
          if (userEmail) {
            sendGenericEmail({
              to: userEmail,
              subject: 'New login from a different country — iHYPE',
              text: [
                `Hi ${userName},`,
                '',
                `We detected a login to your iHYPE account from a new country (${currentCountry}).`,
                `Your previous login was from ${challenge.user.lastLoginCountry}.`,
                '',
                'If this was you, no action is needed.',
                'If you did not log in, please change your account credentials immediately.',
                '',
                '— iHYPE'
              ].join('\n'),
              html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
                  <h2 style="margin:0 0 12px;">New login from a different country</h2>
                  <p>Hi ${userName},</p>
                  <p>We detected a login to your iHYPE account from <strong>${currentCountry}</strong>. Your previous login was from <strong>${challenge.user.lastLoginCountry}</strong>.</p>
                  <p>If this was you, no action is needed. If you did not log in, please change your account credentials immediately.</p>
                  <p style="color:#5b657a;font-size:12px;">— iHYPE</p>
                </div>
              `
            }).catch(() => {});
          }
        }

        // Update last login country and timestamp.
        db.user.update({
          where: { id: challenge.user.id },
          data: {
            lastLoginCountry: currentCountry ?? undefined,
            lastLoginAt: new Date()
          }
        }).catch(() => {});

        return {
          id: challenge.user.id,
          email: challenge.user.email,
          name: challenge.user.name,
          image: challenge.user.image,
          role: challenge.user.role
        };
      }
    }),
    Google({})
  ]
});
