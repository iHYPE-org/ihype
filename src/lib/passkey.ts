import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';

function getRpInfo() {
  const appUrl = getBaseUrl();
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
  name?: string,
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
      name: name?.trim().slice(0, 80) || null,
    },
  });

  return true;
}

export async function getPasskeyAuthenticationOptions(userId?: string) {
  const { rpID } = getRpInfo();

  let allowCredentials: { id: Uint8Array; type: 'public-key'; transports?: AuthenticatorTransportFuture[] }[] | undefined;
  if (userId) {
    const passkeys = await db.passkey.findMany({ where: { userId }, select: { credentialId: true, transports: true } });
    allowCredentials = passkeys.map(p => ({
      id: Uint8Array.from(Buffer.from(p.credentialId, 'base64url')),
      type: 'public-key' as const,
    }));
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

  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
    select: { credentialId: true, publicKey: true, counter: true, transports: true, userId: true },
  });
  if (!passkey) return null;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: Uint8Array.from(Buffer.from(passkey.credentialId, 'base64url')),
      credentialPublicKey: new Uint8Array(Buffer.isBuffer(passkey.publicKey) ? passkey.publicKey : Buffer.from(passkey.publicKey as unknown as ArrayBuffer)),
      counter: Number(passkey.counter),
      transports: passkey.transports ? (passkey.transports.split(',') as AuthenticatorTransportFuture[]) : undefined,
    },
  });

  if (!verification.verified) return null;

  await db.passkey.update({
    where: { credentialId: passkey.credentialId },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  return passkey.userId;
}
