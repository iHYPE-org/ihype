import {
  deleteFromR2,
  isR2StorageAvailable,
  uploadArtistMediaToR2,
} from '@/lib/r2';

export function isBlobMediaStorageConfigured() {
  return Boolean(process.env.R2_PUBLIC_BASE_URL);
}

export async function isBlobMediaStorageAvailable() {
  return isR2StorageAvailable();
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

export async function deleteArtistMediaFromBlob(storageKey: string) {
  await deleteFromR2(storageKey);
}
