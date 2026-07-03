function isAllowedImageProtocol(value: string) {
  return (
    value.startsWith('/') ||
    value.startsWith('https://') ||
    /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(value) ||
    value.startsWith('blob:')
  );
}

function isAllowedVideoProtocol(value: string) {
  return (
    value.startsWith('/') ||
    value.startsWith('https://') ||
    /^data:video\/(?:mp4|webm|ogg);base64,/i.test(value) ||
    value.startsWith('blob:')
  );
}

export function isSafeImageInput(value?: string | null) {
  if (!value) {
    return true;
  }

  return isAllowedImageProtocol(value.trim());
}

export function isSafeVideoInput(value?: string | null) {
  if (!value) {
    return true;
  }

  return isAllowedVideoProtocol(value.trim());
}

export function getSafeImageUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return isAllowedImageProtocol(trimmedValue) ? trimmedValue : null;
}

export function getSafeVideoUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return isAllowedVideoProtocol(trimmedValue) ? trimmedValue : null;
}
