import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialDescriptorFuture,
} from '@simplewebauthn/types';
import { db } from '@/lib/db';

function getRpInfo() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ihype.org';
  const url = new URL(appUrl);
  return { rpID: url.hostname, rpName: 'iHYPE', origin: appUrl };
}

export async function getPasskeyRegistrationOptions(userId: string, userName: string) {
  const { rpID, rpName } = getRpInfo();
  const existing = await db.passkey.findMany({ where: { userId }, select: { credentialId: true } });
  const excludeCredentials = existing.map(p => ({
    id: Uint8Array.from(Buffer.from(p.credentialId, 'base64url')),
    type: 'public-key' as const,
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
    userName,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  return options;
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const { rpID, origin } = getRpInfo();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) return false;

  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  await db.passkey.create({
    data: {
      userId,
      credentialId: Buffer.from(credentialID).toString('base64url'),
      publicKey: Buffer.from(credentialPublicKey),
      counter: BigInt(counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: (response.response.transports ?? []).join(','),
    },
  });

  return true;
}

export async function getPasskeyAuthenticationOptions(userId?: string) {
  const { rpID } = getRpInfo();

  let allowCredentials: PublicKeyCredentialDescriptorFuture[] | undefined;
  if (userId) {
    const passkeys = await db.passkey.findMany({ where: { userId }, select: { credentialId: true, transports: true } });
    allowCredentials = passkeys.map(p => ({
      id: Uint8Array.from(Buffer.from(p.credentialId, 'base64url')),
      type: 'public-key' as const,
    } as PublicKeyCredentialDescriptorFuture));
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials,
  });

  return options;
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
) {
  const { rpID, origin } = getRpInfo();

  const passkey = await db.passkey.findUnique({ where: { credentialId: response.id } });
  if (!passkey) return null;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: Uint8Array.from(Buffer.from(passkey.credentialId, 'base64url')),
      credentialPublicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports ? (passkey.transports.split(',') as import('@simplewebauthn/types').AuthenticatorTransportFuture[]) : undefined,
    },
  });

  if (!verification.verified) return null;

  await db.passkey.update({
    where: { credentialId: passkey.credentialId },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  return passkey.userId;
}
