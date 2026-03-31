function parseBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (value == null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

const demoIdentifiers = new Set([
  'fan',
  'fan@ihype.org',
  'artist',
  'artist@ihype.org',
  'promoter',
  'promoter@ihype.org',
  'venue',
  'venue@ihype.org'
]);

export function areDemoLoginsEnabled() {
  return parseBooleanFlag(
    process.env.FEATURE_ENABLE_DEMO_LOGINS,
    process.env.NODE_ENV !== 'production'
  );
}

export function isDemoIdentifier(identifier: string | null | undefined) {
  if (!identifier) {
    return false;
  }

  return demoIdentifiers.has(identifier.trim().toLowerCase());
}

export function isDemoUser(user: {
  email?: string | null;
  username?: string | null;
}) {
  return isDemoIdentifier(user.email) || isDemoIdentifier(user.username);
}

export function isReservedPlatformEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return email.trim().toLowerCase().endsWith('@ihype.org');
}

export function isProductionSeedingAllowed() {
  return parseBooleanFlag(process.env.ALLOW_PRODUCTION_SEEDING, false);
}
