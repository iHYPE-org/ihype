import { uploadArtistMediaToR2 } from '@/lib/r2';

export function isBlobMediaStorageConfigured() {
  // R2 is always available in CF Workers; in local dev check for env vars
  return Boolean(
    process.env.CF_ACCOUNT_ID || process.env.R2_ACCESS_KEY_ID
  );
}

export async function uploadArtistMediaToBlob({
  file,
  hexId,
  profileId,
}: {
  file: File;
  hexId: string;
  profileId: string;
}) {
  const result = await uploadArtistMediaToR2({ file, hexId, profileId });
  return {
    provider: result.provider,
    key: result.key,
    url: result.url,
  };
}
