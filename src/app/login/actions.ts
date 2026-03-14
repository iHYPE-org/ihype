'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';

export type LoginActionState = {
  error: string | null;
  identifier: string;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const identifier = String(formData.get('identifier') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('callbackUrl') ?? '/auth/landing');

  if (!identifier || !password) {
    return {
      error: 'Enter your email or username and password.',
      identifier
    };
  }

  try {
    await signIn('credentials', {
      identifier,
      password,
      redirectTo
    });

    return {
      error: null,
      identifier
    };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        return {
          error: 'Invalid email, username, or password.',
          identifier
        };
      }

      return {
        error: 'Sign in failed. Please try again.',
        identifier
      };
    }

    throw error;
  }
}
