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
