const usernamePattern = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return usernamePattern.test(normalizeUsername(value));
}

export function getUsernameValidationMessage() {
  return 'Username must be 3-30 characters and use letters, numbers, dots, dashes, or underscores.';
}
