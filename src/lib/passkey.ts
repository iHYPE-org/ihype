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
} from '@simplewebauthn/server';
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
  const excludeCredentials = existing.map((passkey) => ({
    id: passkey.credentialId,
    type: 'public-key' as const,
  }));

  return generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });
}

export async function verifyPasskeyRegistrationResponse(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const { rpID, origin } = getRpInfo();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) return null;

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: BigInt(credential.counter),
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: (response.response.transports ?? []).join(',') || null,
  };
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  name?: string,
) {
  const verified = await verifyPasskeyRegistrationResponse(response, expectedChallenge);
  if (!verified) return false;

  await db.passkey.create({
    data: {
      userId,
      ...verified,
      name: name?.trim().slice(0, 80) || null,
    },
  });

  return true;
}

export async function getPasskeyAuthenticationOptions(userId?: string) {
  const { rpID } = getRpInfo();

  let allowCredentials:
    | { id: string; type: 'public-key'; transports?: AuthenticatorTransportFuture[] }[]
    | undefined;
  if (userId) {
    const passkeys = await db.passkey.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });
    allowCredentials = passkeys.map((passkey) => ({
      id: passkey.credentialId,
      type: 'public-key' as const,
      transports: passkey.transports
        ? (passkey.transports.split(',') as AuthenticatorTransportFuture[])
        : undefined,
    }));
  }

  return generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials,
  });
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
) {
  const { rpID, origin } = getRpInfo();

  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
    select: {
      credentialId: true,
      publicKey: true,
      counter: true,
      transports: true,
      userId: true,
    },
  });
  if (!passkey) return null;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(
        Buffer.isBuffer(passkey.publicKey)
          ? passkey.publicKey
          : Buffer.from(passkey.publicKey as unknown as ArrayBuffer),
      ),
      counter: Number(passkey.counter),
      transports: passkey.transports
        ? (passkey.transports.split(',') as AuthenticatorTransportFuture[])
        : undefined,
    },
  });

  if (!verification.verified) return null;

  await db.passkey.update({
    where: { credentialId: passkey.credentialId },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  return passkey.userId;
}
